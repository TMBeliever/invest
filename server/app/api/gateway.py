import logging
from typing import Any, Dict
from fastapi import APIRouter, Request, HTTPException
from app.services.gateway.schemas import InboundMessage, PlatformType, OutboundResponse
from app.services.gateway.orchestrator import gateway_orchestrator

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/webhook/{platform}")
async def universal_gateway_webhook(platform: str, request: Request) -> Dict[str, Any]:
    """
    通用多平台双向 Agent Webhook 接收网关：
    支持来自 Telegram、飞书、企业微信、Discord、Slack 等任意平台的 Webhook 事件推送。
    """
    platform_upper = platform.upper()
    try:
        payload = await request.json()
    except Exception:
        payload = {}

    logger.info(f"🌐 [Gateway Webhook Inbound] Platform={platform_upper}, Payload Keys={list(payload.keys())}")

    # 1. 飞书事件处理与 Challenge 校验
    if platform_upper == "FEISHU":
        if "challenge" in payload:
            return {"challenge": payload["challenge"]}
        
        event = payload.get("event", {})
        msg = event.get("message", {})
        sender = event.get("sender", {}).get("sender_id", {}).get("open_id", "feishu_user")
        text = msg.get("content", "")
        # 飞书文本格式解析
        if isinstance(text, str) and text.startswith("{"):
            import json
            try:
                text = json.loads(text).get("text", "")
            except Exception:
                pass

        inbound = InboundMessage(
            platform=PlatformType.FEISHU,
            sender_id=sender,
            chat_id=msg.get("chat_id", sender),
            text=text,
            raw_payload=payload
        )
        outbound = await gateway_orchestrator.handle_inbound(inbound)
        return {"status": "ok", "reply": outbound.model_dump()}

    # 2. Telegram Webhook 模式处理
    elif platform_upper == "TELEGRAM":
        msg = payload.get("message", {})
        text = msg.get("text", "")
        chat_id = str(msg.get("chat", {}).get("id", ""))
        sender_id = str(msg.get("from", {}).get("id", ""))
        
        if not text or not chat_id:
            return {"ok": True}

        inbound = InboundMessage(
            platform=PlatformType.TELEGRAM,
            sender_id=sender_id,
            chat_id=chat_id,
            text=text,
            raw_payload=payload
        )
        outbound = await gateway_orchestrator.handle_inbound(inbound)
        return {"ok": True, "reply": outbound.model_dump()}

    # 3. 通用自定义平台
    else:
        text = payload.get("text") or payload.get("content") or payload.get("message") or ""
        sender_id = str(payload.get("sender_id") or payload.get("user_id") or "custom_user")
        chat_id = str(payload.get("chat_id") or sender_id)

        inbound = InboundMessage(
            platform=PlatformType.CUSTOM,
            sender_id=sender_id,
            chat_id=chat_id,
            text=text,
            raw_payload=payload
        )
        outbound = await gateway_orchestrator.handle_inbound(inbound)
        return {"status": "ok", "reply": outbound.model_dump()}
