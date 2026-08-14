import asyncio
import requests
from typing import Dict, Any
from app.services.dispatcher.base import BaseChannelAdapter
from app.schemas.intelligence import IntelligencePayload, Severity

class FeishuAdapter(BaseChannelAdapter):
    channel_name = "FEISHU"

    def _get_header_color(self, severity: Severity) -> str:
        if severity == Severity.CRITICAL:
            return "red"
        elif severity == Severity.WARNING:
            return "orange"
        elif severity == Severity.OPPORTUNITY:
            return "green"
        return "blue"

    async def send(self, payload: IntelligencePayload, target_config: Dict[str, Any]) -> bool:
        webhook_url = target_config.get("feishu_webhook_url")
        if not webhook_url:
            return False

        header_color = self._get_header_color(payload.severity)
        
        # 构建飞书富文本互动卡片 elements
        elements = []
        
        # 摘要导读
        if payload.summary:
            elements.append({
                "tag": "div",
                "text": {
                    "tag": "lark_md",
                    "content": f"**💡 导读摘要**\n{payload.summary}"
                }
            })
            elements.append({"tag": "hr"})

        # Markdown 正文
        elements.append({
            "tag": "div",
            "text": {
                "tag": "lark_md",
                "content": payload.markdown_content[:1800] # 防止单块过长
            }
        })

        # 方案选项 A/B/C 展示
        if payload.decision_options:
            elements.append({"tag": "hr"})
            elements.append({
                "tag": "div",
                "text": {
                    "tag": "lark_md",
                    "content": "**🎯 InvestScope 决策方案建议：**"
                }
            })
            for opt in payload.decision_options:
                elements.append({
                    "tag": "div",
                    "text": {
                        "tag": "lark_md",
                        "content": f"• **{opt.name}** `[{opt.tag}]`\n{opt.analysis}"
                    }
                })

        # 底部备注
        elements.append({"tag": "hr"})
        elements.append({
            "tag": "note",
            "elements": [
                {
                    "tag": "plain_text",
                    "content": f"InvestScope 高胜率决策智库 · {payload.created_at}"
                }
            ]
        })

        card_payload = {
            "msg_type": "interactive",
            "card": {
                "config": {
                    "wide_screen_mode": True
                },
                "header": {
                    "template": header_color,
                    "title": {
                        "tag": "plain_text",
                        "content": payload.title
                    }
                },
                "elements": elements
            }
        }

        def _do_post():
            try:
                resp = requests.post(webhook_url, json=card_payload, timeout=8.0)
                if resp.status_code == 200:
                    data = resp.json()
                    return data.get("StatusCode") == 0 or data.get("code") == 0
                return False
            except Exception as e:
                print(f"[FeishuAdapter] Failed to post webhook: {e}")
                return False

        return await asyncio.to_thread(_do_post)
