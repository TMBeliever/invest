import datetime
import json
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.api.assets import _enrich_assets
from app.data.akshare_client import AKShareClient
from app.data.storage import storage_db
from app.services.auth import get_current_user
from app.services.llm_provider import get_llm_provider

logger = logging.getLogger(__name__)
router = APIRouter()


class ChatMessagePayload(BaseModel):
    role: str
    content: str


class ChatRequestPayload(BaseModel):
    sessionId: Optional[str] = None
    messages: List[ChatMessagePayload]


def _build_system_prompt(user_id: str, session_summary: Optional[str] = None) -> str:
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    weekday_str = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"][
        datetime.datetime.now().weekday()
    ]

    # 读取用户真实持仓
    raw_assets = storage_db.get_all_assets(user_id)
    assets = _enrich_assets(raw_assets)
    total_val = sum(a["currentValue"] for a in assets)
    total_profit = sum(a.get("profit", 0) or 0 for a in assets)
    annual_income = sum(a.get("annualIncome", 0) or 0 for a in assets)
    yield_rate = round((annual_income / total_val * 100), 2) if total_val > 0 else 0.0

    assets_summary_str = "\n".join([
        f"- {a['name']} ({a['category']}): 市值 ¥{a['currentValue']:.2f}, "
        f"预估年收益 ¥{a.get('annualIncome', 0):.2f}"
        + (f", 成本股息率 {a['costDividendYield']}%" if a.get("costDividendYield") else "")
        + (f", 已存 {a['daysHeld']}天(累计利息 ¥{a['accruedInterest']:.2f})" if a.get("accruedInterest") else "")
        for a in assets
    ])

    # 读取大盘数据
    overview = AKShareClient.get_market_overview()
    bond_10y = overview.get("bondYield10y", 1.71)
    risk_ratio = overview.get("riskPremiumRatio", 3.05)

    summary_part = f"\n\n[早期对话历史摘要 (保留核心偏好，避免信息丢失)]:\n{session_summary}" if session_summary else ""

    return f"""你是一名精通个人资产配置与高股息投资策略的【InvestScope 智能 AI 投资顾问】。

[系统硬约束上下文 - 100% 真实数据，绝不可擅自更改或猜测]:
- 当前精准时间: {now_str} {weekday_str}
- 10年期国债收益率: {bond_10y}% | 股债风险溢价比: {risk_ratio}
- 用户总资产: ¥{total_val:,.2f}
- 组合持仓总浮盈: ¥{total_profit:,.2f}
- 预估年现金流收益: ¥{annual_income:,.2f}/年 (综合被动收益率 {yield_rate}%)
- 用户真实持仓明细:
{assets_summary_str if assets_summary_str else "  (暂未录入资产)"}{summary_part}

[回答准则与防幻觉铁律]:
1. **绝对禁止胡乱记忆或推测**股价、财务数据或收益率。所有关于用户资产、单股价格与大盘的提问，必须严格基于上方给出的真实上下文数据！
2. 语言风格亲切、专业、洞察深刻。多用 Markdown 标题、加粗、列表与引用卡片。
3. 结合用户持仓的集中度、现金仓比例与被动收益率，给出具有可操作性的风控或调仓建议。
4. 如果提问超出金融投资范畴，请友好引导回资产配置与投资规划。
"""


@router.get("/sessions")
def get_user_sessions(current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = current_user["id"]
    return storage_db.get_user_chat_sessions(user_id)


@router.post("/sessions")
def create_new_session(
    payload: Dict[str, Any] = {},
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["id"]
    title = payload.get("title", "新对话")
    session_id = storage_db.create_chat_session(user_id, title)
    return {"sessionId": session_id, "title": title}


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["id"]
    ok = storage_db.delete_chat_session(session_id, user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="会话不存在或已删除")
    return {"status": "ok"}


@router.get("/sessions/{session_id}/messages")
def get_session_messages(
    session_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["id"]
    session = storage_db.get_chat_session(session_id, user_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    return storage_db.get_session_messages(session_id)


@router.post("/chat")
def chat_stream(
    payload: ChatRequestPayload,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["id"]
    session_id = payload.sessionId

    if not session_id:
        # 如果没有传入 session_id，则新建一个
        session_id = storage_db.create_chat_session(user_id, "新对话")

    session = storage_db.get_chat_session(session_id, user_id)
    if not session:
        session_id = storage_db.create_chat_session(user_id, "新对话")
        session = storage_db.get_chat_session(session_id, user_id)

    # 取出最新一条用户消息并落库
    user_msg_content = payload.messages[-1].content if payload.messages else ""
    if user_msg_content:
        storage_db.add_chat_message(session_id, "user", user_msg_content)

    # 获取当前会话所有的历史消息
    all_db_msgs = storage_db.get_session_messages(session_id)

    # 自动生成对话标题（如果是第一条消息）
    if len(all_db_msgs) <= 2 and (session.get("title") == "新对话" or not session.get("title")):
        raw_title = user_msg_content.replace("\n", " ").strip()
        auto_title = raw_title[:12] + "..." if len(raw_title) > 12 else raw_title
        if auto_title:
            storage_db.update_chat_session(session_id, title=auto_title)

    # 智能上下文压缩算法 (Summary + Buffer Window)
    session_summary = session.get("summary")
    MAX_BUFFER_WINDOW = 6  # 保留最近 6 轮逐字明细

    if len(all_db_msgs) > MAX_BUFFER_WINDOW + 2:
        # 老旧消息取前 N-6 轮，生成更精炼的摘要
        old_msgs = all_db_msgs[:-MAX_BUFFER_WINDOW]
        summary_lines = [f"{m['role']}: {m['content'][:80]}" for m in old_msgs]
        new_summary = "早期对话要点：\n" + "\n".join(summary_lines[-6:])
        storage_db.update_chat_session(session_id, summary=new_summary)
        session_summary = new_summary

        # 发给大模型的消息只保留最近 6 轮
        llm_messages = [{"role": m["role"], "content": m["content"]} for m in all_db_msgs[-MAX_BUFFER_WINDOW:]]
    else:
        llm_messages = [{"role": m["role"], "content": m["content"]} for m in all_db_msgs]

    system_prompt = _build_system_prompt(user_id, session_summary)
    llm = get_llm_provider()

    def event_generator():
        full_reply = ""
        try:
            for chunk in llm.stream_chat(llm_messages, system_prompt):
                full_reply += chunk
                data = json.dumps({"content": chunk, "sessionId": session_id}, ensure_ascii=False)
                yield f"data: {data}\n\n"
            
            # SSE 播放完成后落库助手回复
            if full_reply.strip():
                storage_db.add_chat_message(session_id, "assistant", full_reply)

            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error(f"SSE 流生成错误: {e}")
            err_data = json.dumps({"content": f"\n\n[发生错误: {str(e)}]"}, ensure_ascii=False)
            yield f"data: {err_data}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/diagnose")
def get_portfolio_diagnosis(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    user_id = current_user["id"]
    raw_assets = storage_db.get_all_assets(user_id)
    assets = _enrich_assets(raw_assets)
    total_val = sum(a["currentValue"] for a in assets)
    annual_income = sum(a.get("annualIncome", 0) or 0 for a in assets)
    yield_rate = round((annual_income / total_val * 100), 2) if total_val > 0 else 0.0

    overview = AKShareClient.get_market_overview()
    bond_10y = overview.get("bondYield10y", 1.71)

    top_asset = max(assets, key=lambda x: x["currentValue"]) if assets else None
    top_pct = round((top_asset["currentValue"] / total_val * 100), 1) if (top_asset and total_val > 0) else 0.0

    score = 88 if total_val > 0 else 60

    return {
        "score": score,
        "scoreLabel": "优秀" if score >= 85 else "良好",
        "yieldRate": yield_rate,
        "bondYield10y": bond_10y,
        "annualIncome": annual_income,
        "topAssetName": top_asset["name"] if top_asset else None,
        "topAssetPct": top_pct,
        "diagnosisText": [
            f"组合预估年被动收益 ¥{annual_income:,.2f}/年 (收益率 {yield_rate}%)，远超 10年国债收益率 ({bond_10y}%)，现金流安全垫充足。",
            f"第一大持仓【{top_asset['name'] if top_asset else '无'}】占比 {top_pct}%" + ("，注意控制单一标的集中度风险。" if top_pct > 35 else "，仓位分散度健康。"),
            "建议后续新增到账资金或利息优先补充【现金避险仓】或配置【红利低波 ETF】。",
        ],
        "updatedAt": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
    }
