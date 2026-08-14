from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Dict, Any, Optional
import datetime

from app.api.auth import get_current_user
from app.schemas.intelligence import (
    IntelligencePayload,
    ReportType,
    UserSubscriptionConfig,
    PushTestRequest,
    Severity,
    DecisionOption,
)
from app.data.storage import storage_db
from app.services.intelligence.sentinel_risk import sentinel_risk_generator
from app.services.intelligence.morning_radar import morning_radar_generator
from app.services.intelligence.closing_review import closing_review_generator
from app.services.dispatcher.router import dispatch_router

router = APIRouter(prefix="/api/intelligence", tags=["intelligence"])

# ─── 1. 组合智能哨兵与风险预警 ──────────────────────────────────

@router.get("/sentinel-alerts")
async def get_sentinel_alerts(
    status: Optional[str] = None,
    refresh: bool = Query(False, description="是否强制重新运行深度风控扫描"),
    current_user: dict = Depends(get_current_user)
):
    """
    获取当前用户的风险哨兵与决策预警。
    极速快路径：默认直接读取 SQLite 数据库，毫秒级响应 (0ms)。
    当传入 refresh=true 或库中尚无告警时，在非阻塞线程中增量扫描并持久化。
    """
    user_id = current_user["id"]

    # 1. 检查数据库中现有告警
    alerts = storage_db.get_user_sentinel_alerts(user_id, status=status)

    # 2. 仅在显式请求刷新 或 首次访问无告警时执行扫描 (带 60 秒防抖)
    if refresh or len(alerts) == 0:
        try:
            fresh_alerts = await sentinel_risk_generator.scan_and_generate_alerts(user_id, force=refresh)
            for alert in fresh_alerts:
                storage_db.save_sentinel_alert({
                    "id": alert.id,
                    "user_id": user_id,
                    "rule_code": alert.structured_metrics.get("rule_code", "GENERIC_RISK"),
                    "category": alert.structured_metrics.get("category", "RISK"),
                    "severity": alert.severity.value,
                    "symbol": alert.symbol,
                    "symbol_name": alert.symbol_name,
                    "title": alert.title,
                    "summary": alert.summary,
                    "markdown_content": alert.markdown_content,
                    "structured_metrics": alert.structured_metrics,
                    "decision_options": [opt.model_dump() for opt in alert.decision_options] if alert.decision_options else [],
                })
            alerts = storage_db.get_user_sentinel_alerts(user_id, status=status)
        except Exception as e:
            print(f"[SentinelAlerts] Error during fresh scan: {e}")

    return {
        "total_active_alerts": len([a for a in alerts if a.get("status") in ("UNREAD", "ACKNOWLEDGED")]),
        "alerts": alerts
    }

@router.post("/sentinel-alerts/{alert_id}/acknowledge")
async def acknowledge_sentinel_alert(
    alert_id: str,
    current_user: dict = Depends(get_current_user)
):
    """标记告警为【已阅】"""
    user_id = current_user["id"]
    ok = storage_db.update_sentinel_alert_status(alert_id, user_id, "ACKNOWLEDGED")
    if not ok:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"success": True, "status": "ACKNOWLEDGED"}

@router.post("/sentinel-alerts/{alert_id}/dismiss")
async def dismiss_sentinel_alert(
    alert_id: str,
    current_user: dict = Depends(get_current_user)
):
    """主动忽略/关闭此条告警"""
    user_id = current_user["id"]
    ok = storage_db.update_sentinel_alert_status(alert_id, user_id, "DISMISSED")
    if not ok:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"success": True, "status": "DISMISSED"}

# ─── 2. 每日早盘前瞻与收盘复盘研报 ───────────────────────────────

@router.get("/reports/latest")
async def get_latest_report(
    report_type: ReportType = Query(..., description="MORNING_RADAR | CLOSING_REVIEW | SECTOR_INSIGHT"),
    current_user: dict = Depends(get_current_user)
):
    """
    获取今日最新研报：若今天已生成则秒级返回缓存，若无则按需自动生成一份。
    """
    today_str = datetime.datetime.now().strftime("%Y-%m-%d")
    cached = storage_db.get_latest_intelligence_report(report_type.value, today_str)
    if cached:
        return cached

    # 实时按需生成
    payload: IntelligencePayload
    if report_type == ReportType.MORNING_RADAR:
        payload = await morning_radar_generator.generate()
    elif report_type == ReportType.CLOSING_REVIEW:
        payload = await closing_review_generator.generate()
    else:
        payload = await morning_radar_generator.generate()

    # 落库并返回
    await dispatch_router.dispatch(payload, user_id=current_user["id"], force_channels=["IN_APP"])
    cached = storage_db.get_latest_intelligence_report(report_type.value, today_str)
    return cached or payload.model_dump()

@router.post("/reports/generate")
async def force_generate_report(
    report_type: ReportType = Query(..., description="MORNING_RADAR | CLOSING_REVIEW"),
    push_to_subscribed: bool = Query(False, description="是否同时推送到用户绑定的外部渠道"),
    current_user: dict = Depends(get_current_user)
):
    """
    【强制刷新生成】最新研报，并可按需触发多渠道推送。
    若未配置外部渠道 Webhook，会明确提示前往系统设置配置。
    """
    user_id = current_user["id"]
    payload: IntelligencePayload
    if report_type == ReportType.MORNING_RADAR:
        payload = await morning_radar_generator.generate()
    else:
        payload = await closing_review_generator.generate()

    sub_config = storage_db.get_user_subscription(user_id)
    feishu_url = (sub_config.get("feishu_webhook_url") or "").strip()
    wechat_url = (sub_config.get("wechat_webhook_url") or "").strip()
    email_addr = (sub_config.get("email_address") or "").strip()
    tg_token = (sub_config.get("telegram_bot_token") or "").strip()
    tg_chat = (sub_config.get("telegram_chat_id") or "").strip()
    has_external_config = bool(feishu_url or wechat_url or email_addr or (tg_token and tg_chat))

    # 1. 始终落库站内信
    results = await dispatch_router.dispatch(payload, user_id=user_id, force_channels=["IN_APP"])

    pushed_channels = []
    failed_channels = []

    # 2. 若用户点击了推送到外部渠道
    if push_to_subscribed:
        if not has_external_config:
            return {
                "success": False,
                "has_external_config": False,
                "message": "您尚未在【系统设置】中配置飞书、微信或 Telegram 推送渠道，无法完成外部推送。请先前往配置！",
                "report": payload.model_dump(),
                "dispatch_results": results
            }

        # 触发外部推送
        ext_results = await dispatch_router.dispatch(payload, user_id=user_id)
        for ch, ok in ext_results.items():
            if ch != "IN_APP":
                if ok:
                    pushed_channels.append(ch)
                else:
                    failed_channels.append(ch)

        if not pushed_channels and failed_channels:
            return {
                "success": False,
                "has_external_config": True,
                "message": f"外部推送失败 ({', '.join(failed_channels)})，请检查 Webhook/Token 地址或网络连通性！",
                "report": payload.model_dump(),
                "dispatch_results": ext_results
            }

    return {
        "success": True,
        "has_external_config": has_external_config,
        "pushed_channels": pushed_channels,
        "message": f"已成功推送至 {', '.join(pushed_channels)} 渠道！" if pushed_channels else "研报已成功重新生成！",
        "report": payload.model_dump(),
        "dispatch_results": results
    }

@router.get("/reports")
async def list_reports(
    report_type: Optional[ReportType] = None,
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """获取历史研报列表"""
    r_type = report_type.value if report_type else None
    reports = storage_db.get_intelligence_reports(report_type=r_type, limit=limit)
    return {"reports": reports}

# ─── 3. 用户推送与订阅偏好配置 ───────────────────────────────────

@router.get("/subscription")
async def get_subscription(current_user: dict = Depends(get_current_user)):
    """获取用户的订阅偏好与 Webhook 配置"""
    user_id = current_user["id"]
    return storage_db.get_user_subscription(user_id)

@router.post("/subscription")
async def save_subscription(
    config: UserSubscriptionConfig,
    current_user: dict = Depends(get_current_user)
):
    """保存用户的订阅偏好与 Webhook 配置"""
    user_id = current_user["id"]
    config.user_id = user_id
    storage_db.save_user_subscription(user_id, config.model_dump())
    return {"success": True, "subscription": storage_db.get_user_subscription(user_id)}

@router.post("/test-push")
async def test_push_notification(
    req: PushTestRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    【一键发送测试卡片】验证飞书 / 企微 / 邮箱 / Telegram 连通性。
    """
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    test_payload = IntelligencePayload(
        id=f"test-{datetime.datetime.now().timestamp()}",
        report_type=ReportType.SENTINEL_ALERT,
        severity=Severity.OPPORTUNITY,
        user_id=current_user["id"],
        title="🧪 InvestScope 多渠道智能推送连通性测试成功！",
        summary="恭喜！您的推送渠道已成功打通。系统将在每日固定时段与突发风险时为您精准推送高价值投资决策情报。",
        markdown_content="""### 🚀 决策中台连通性测试
- **测试用户**：`""" + current_user.get("username", "Owner") + """`
- **推送通道**：`""" + req.channel.upper() + """`
- **目标地址**：`""" + req.target_url_or_email + """`
- **测试时间**：""" + now_str + """

#### 🎯 后续将为您自动推送：
1. **每日早盘前瞻 (08:45)**：全球宏观、隔夜外盘、黄金大宗与 ERP 胜率；
2. **每日收盘复盘 (15:30)**：A股大盘、申万 31 行业涨跌与红利资产表现；
3. **组合智能哨兵**：持仓隐形行业超标、股息利差收窄与重大风险排雷。""",
        decision_options=[
            DecisionOption(
                key="TEST_A",
                name="【通道运行正常，无需调整】",
                tag="测试方案",
                analysis="通道响应毫秒级，排版卡片与格式解析完全正常。",
                action_type="HOLD"
            )
        ],
        created_at=now_str
    )

    channel_key = req.channel.upper()
    target_config = {}
    if channel_key == "FEISHU":
        target_config["feishu_webhook_url"] = req.target_url_or_email
    elif channel_key == "WECHAT":
        target_config["wechat_webhook_url"] = req.target_url_or_email
    elif channel_key == "EMAIL":
        target_config["email_address"] = req.target_url_or_email
    elif channel_key == "TELEGRAM":
        target_config["telegram_bot_token"] = req.telegram_bot_token or req.target_url_or_email
        target_config["telegram_chat_id"] = req.telegram_chat_id
        target_config["telegram_api_host"] = req.telegram_api_host or "https://api.telegram.org"

    adapter = dispatch_router.adapters.get(channel_key)
    if not adapter:
        raise HTTPException(status_code=400, detail=f"Unsupported channel: {req.channel}")

    ok = await adapter.send(test_payload, target_config)
    if not ok:
        raise HTTPException(status_code=500, detail=f"Failed to send test message to {req.channel}. Please check URL or network.")

    return {
        "success": True,
        "message": f"Test message sent successfully to {req.channel}!",
        "channel": req.channel
    }
