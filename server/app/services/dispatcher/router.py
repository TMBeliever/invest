from typing import Optional, Dict, Any, List
from app.schemas.intelligence import IntelligencePayload, ReportType
from app.services.dispatcher.base import BaseChannelAdapter
from app.services.dispatcher.in_app import InAppAdapter
from app.services.dispatcher.feishu import FeishuAdapter
from app.services.dispatcher.wechat import WeChatAdapter
from app.services.dispatcher.email import EmailAdapter
from app.services.dispatcher.telegram import TelegramAdapter
from app.data.storage import storage_db

class DispatchRouter:
    def __init__(self):
        self.adapters: Dict[str, BaseChannelAdapter] = {
            "IN_APP": InAppAdapter(),
            "FEISHU": FeishuAdapter(),
            "WECHAT": WeChatAdapter(),
            "EMAIL": EmailAdapter(),
            "TELEGRAM": TelegramAdapter(),
        }

    async def dispatch(self, payload: IntelligencePayload, user_id: Optional[str] = None, force_channels: Optional[List[str]] = None) -> Dict[str, bool]:
        """
        统一分发路由器：
        1. 针对个人哨兵预警，获取其个性化订阅配置与 Webhook URL
        2. 针对全员研报，获取开启订阅的所有用户列表分别发送
        3. 始终默认落库 IN_APP 站内信
        """
        results: Dict[str, bool] = {}

        # 1. 始终优先落库站内信
        in_app_ok = await self.adapters["IN_APP"].send(payload, {})
        results["IN_APP"] = in_app_ok

        effective_user_id = user_id or payload.user_id

        if not effective_user_id:
            # 全员公共研报广播场景：暂时直接落库
            return results

        # 2. 读取用户的订阅配置
        sub_config = storage_db.get_user_subscription(effective_user_id)

        # 检查该报告类型是否被用户开启
        if payload.report_type == ReportType.MORNING_RADAR and not sub_config.get("enable_morning_radar", True):
            return results
        if payload.report_type == ReportType.CLOSING_REVIEW and not sub_config.get("enable_closing_review", True):
            return results
        if payload.report_type == ReportType.SENTINEL_ALERT and not sub_config.get("enable_sentinel_alert", True):
            return results

        channels = force_channels or sub_config.get("channel_types") or ["IN_APP"]

        # 3. 按渠道依次分发
        for ch in channels:
            if ch == "IN_APP":
                continue # 已在前面执行
            adapter = self.adapters.get(ch.upper())
            if adapter:
                ok = await adapter.send(payload, sub_config)
                results[ch.upper()] = ok

        return results

dispatch_router = DispatchRouter()
