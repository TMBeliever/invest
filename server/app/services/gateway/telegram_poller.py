import asyncio
import logging
import requests
from typing import Dict, Any, Optional
from app.data.storage import storage_db
from app.services.gateway.schemas import InboundMessage, PlatformType
from app.services.gateway.orchestrator import gateway_orchestrator

logger = logging.getLogger(__name__)

class TelegramBotPollerService:
    """
    Telegram 双向长轮询交互服务：
    免公网 IP，在本地或任意服务器后台异步轮询 Telegram 用户发给 Bot 的消息，
    直连 Agentic AI 决策中台并秒级回复。
    """
    def __init__(self):
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._offsets: Dict[str, int] = {}  # bot_token -> last_update_id

    async def start(self):
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._poll_loop())
        logger.info("✈️ [Telegram Bot Gateway] 双向交互轮询服务已启动！")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("🛑 [Telegram Bot Gateway] 双向交互服务已停止。")

    async def _poll_loop(self):
        while self._running:
            try:
                # 获取当前所有已配置了 Telegram Bot Token 的用户记录
                bot_configs = await asyncio.to_thread(storage_db.get_active_telegram_bot_configs)
                if not bot_configs:
                    # 暂无用户配置 Telegram Bot，静默等待
                    await asyncio.sleep(8)
                    continue

                for cfg in bot_configs:
                    token = (cfg.get("telegram_bot_token") or "").strip()
                    api_host = (cfg.get("telegram_api_host") or "https://api.telegram.org").strip().rstrip("/")
                    if not token:
                        continue

                    offset = self._offsets.get(token, 0)

                    # 发起长轮询请求 (在工作线程中执行，不阻塞主事件循环)
                    updates = await asyncio.to_thread(self._fetch_updates, api_host, token, offset)
                    for upd in updates:
                        upd_id = upd.get("update_id", 0)
                        self._offsets[token] = max(self._offsets.get(token, 0), upd_id + 1)

                        msg = upd.get("message")
                        if not msg:
                            continue

                        text = msg.get("text")
                        if not text:
                            continue

                        chat_id = str(msg.get("chat", {}).get("id", ""))
                        sender_id = str(msg.get("from", {}).get("id", ""))
                        username = msg.get("from", {}).get("username") or msg.get("from", {}).get("first_name", "")

                        # 构造通用入站消息
                        inbound = InboundMessage(
                            platform=PlatformType.TELEGRAM,
                            sender_id=sender_id,
                            chat_id=chat_id,
                            text=text,
                            sender_name=username,
                            raw_payload=upd,
                        )

                        # 发送 "正在输入 (typing...)" 状态
                        await asyncio.to_thread(self._send_chat_action, api_host, token, chat_id, "typing")

                        # 交付通用 Agent 网关调度器处理
                        outbound = await gateway_orchestrator.handle_inbound(inbound)

                        # 发送回复消息
                        reply_html = outbound.html or outbound.text
                        await asyncio.to_thread(self._send_reply, api_host, token, chat_id, reply_html)

                await asyncio.sleep(1)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[TelegramBotPoller] 轮询异常: {e}")
                await asyncio.sleep(5)

    def _fetch_updates(self, api_host: str, token: str, offset: int) -> list:
        url = f"{api_host}/bot{token}/getUpdates"
        params = {"offset": offset, "timeout": 4, "limit": 10}
        try:
            resp = requests.get(url, params=params, timeout=10.0)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok"):
                    return data.get("result", [])
            elif resp.status_code == 409:
                # Webhook 冲突，删除旧 webhook 后继续
                try:
                    requests.get(f"{api_host}/bot{token}/deleteWebhook", timeout=5.0)
                except Exception:
                    pass
        except Exception as e:
            logger.debug(f"[TelegramBotPoller] fetchUpdates network: {e}")
        return []

    def _send_chat_action(self, api_host: str, token: str, chat_id: str, action: str = "typing"):
        try:
            url = f"{api_host}/bot{token}/sendChatAction"
            requests.post(url, json={"chat_id": chat_id, "action": action}, timeout=3.0)
        except Exception:
            pass

    def _send_reply(self, api_host: str, token: str, chat_id: str, text_html: str):
        url = f"{api_host}/bot{token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text_html,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }
        try:
            resp = requests.post(url, json=payload, timeout=10.0)
            if resp.status_code != 200:
                # 若 HTML 解析有不合规标签，自动降级为纯文本重发
                clean_text = text_html.replace("<b>", "").replace("</b>", "").replace("<code>", "").replace("</code>", "").replace("<blockquote>", "").replace("</blockquote>", "").replace("<i>", "").replace("</i>", "")
                requests.post(url, json={"chat_id": chat_id, "text": clean_text}, timeout=10.0)
        except Exception as e:
            logger.error(f"[TelegramBotPoller] 发送回复失败: {e}")

telegram_bot_service = TelegramBotPollerService()
