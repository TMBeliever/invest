import asyncio
import requests
from typing import Dict, Any
from app.services.dispatcher.base import BaseChannelAdapter
from app.schemas.intelligence import IntelligencePayload, Severity

class WeChatAdapter(BaseChannelAdapter):
    channel_name = "WECHAT"

    async def send(self, payload: IntelligencePayload, target_config: Dict[str, Any]) -> bool:
        webhook_url = target_config.get("wechat_webhook_url")
        if not webhook_url:
            return False

        # 构造企业微信 Markdown 格式内容
        severity_prefix = "🟢" if payload.severity == Severity.OPPORTUNITY else ("🔴" if payload.severity == Severity.CRITICAL else ("🟡" if payload.severity == Severity.WARNING else "🔵"))
        
        md_text = f"### {severity_prefix} {payload.title}\n\n"
        if payload.summary:
            md_text += f"> {payload.summary}\n\n"
        
        md_text += f"{payload.markdown_content}\n\n"

        if payload.decision_options:
            md_text += "**🎯 推荐应对方案：**\n"
            for opt in payload.decision_options:
                md_text += f"> **{opt.name}** ({opt.tag})\n> {opt.analysis}\n\n"

        md_text += f"\n<font color=\"comment\">InvestScope 投资决策智库 · {payload.created_at}</font>"

        wechat_payload = {
            "msg_type": "markdown",
            "markdown": {
                "content": md_text
            }
        }

        def _do_post():
            try:
                resp = requests.post(webhook_url, json=wechat_payload, timeout=8.0)
                if resp.status_code == 200:
                    data = resp.json()
                    return data.get("errcode") == 0
                return False
            except Exception as e:
                print(f"[WeChatAdapter] Failed to post webhook: {e}")
                return False

        return await asyncio.to_thread(_do_post)
