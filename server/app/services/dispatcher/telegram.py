import asyncio
import requests
import html
import logging
from typing import Dict, Any
from app.services.dispatcher.base import BaseChannelAdapter
from app.schemas.intelligence import IntelligencePayload, Severity

logger = logging.getLogger(__name__)

class TelegramAdapter(BaseChannelAdapter):
    channel_name = "TELEGRAM"

    def _format_html_message(self, payload: IntelligencePayload) -> str:
        icon = "🟢" if payload.severity == Severity.OPPORTUNITY else ("🔴" if payload.severity == Severity.CRITICAL else ("🟡" if payload.severity == Severity.WARNING else "🔵"))
        
        # 标题
        title_escaped = html.escape(payload.title)
        msg = f"<b>{icon} {title_escaped}</b>\n\n"

        # 摘要导读
        if payload.summary:
            summary_escaped = html.escape(payload.summary)
            msg += f"<blockquote>💡 <b>核心导读：</b>\n{summary_escaped}</blockquote>\n\n"

        # 正文 (提取 Markdown 标题和要点转为 HTML 易读格式)
        clean_lines = []
        for line in payload.markdown_content.split("\n"):
            trimmed = line.strip()
            if not trimmed or trimmed.startswith("---") or trimmed.startswith("|"):
                continue
            if trimmed.startswith("### "):
                clean_lines.append(f"\n<b>{html.escape(trimmed.replace('### ', ''))}</b>")
            elif trimmed.startswith("- **") or trimmed.startswith("* **"):
                clean_lines.append(f"• {html.escape(trimmed.replace('**', '').replace('- ', '').replace('* ', ''))}")
            elif trimmed.startswith("1. ") or trimmed.startswith("2. ") or trimmed.startswith("3. "):
                clean_lines.append(f"{html.escape(trimmed.replace('**', ''))}")
            else:
                clean_lines.append(html.escape(trimmed.replace('**', '').replace('`', '')))

        content_text = "\n".join(clean_lines[:30]) # 防止超长
        msg += f"{content_text}\n\n"

        # 3 套决策方案
        if payload.decision_options:
            msg += "<b>🎯 InvestScope 决策应对方案：</b>\n"
            for opt in payload.decision_options:
                opt_name = html.escape(opt.name)
                opt_tag = html.escape(opt.tag)
                opt_analysis = html.escape(opt.analysis)
                msg += f"• <b>{opt_name}</b> <code>[{opt_tag}]</code>\n  {opt_analysis}\n\n"

        msg += f"<i>InvestScope 投资决策智库 · {payload.created_at}</i>"
        return msg

    async def send(self, payload: IntelligencePayload, target_config: Dict[str, Any]) -> bool:
        bot_token = (target_config.get("telegram_bot_token") or "").strip()
        chat_id = (target_config.get("telegram_chat_id") or "").strip()
        api_host = (target_config.get("telegram_api_host") or "https://api.telegram.org").strip().rstrip("/")

        if not bot_token or not chat_id:
            logger.warning("[TelegramAdapter] Missing bot_token or chat_id")
            return False

        msg_html = self._format_html_message(payload)
        url = f"{api_host}/bot{bot_token}/sendMessage"

        req_payload = {
            "chat_id": chat_id,
            "text": msg_html,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }

        def _do_send():
            try:
                resp = requests.post(url, json=req_payload, timeout=10.0)
                if resp.status_code == 200:
                    data = resp.json()
                    return bool(data.get("ok"))
                else:
                    logger.error(f"[TelegramAdapter] Send failed with status {resp.status_code}: {resp.text}")
                    return False
            except Exception as e:
                logger.error(f"[TelegramAdapter] Send exception: {e}")
                return False

        return await asyncio.to_thread(_do_send)
