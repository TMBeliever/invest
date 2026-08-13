import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.quote_hub import quote_hub

logger = logging.getLogger(__name__)
router = APIRouter()

@router.websocket("/ws/quotes")
async def websocket_quotes_endpoint(websocket: WebSocket):
    await quote_hub.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")
            codes = data.get("codes", [])
            
            if action == "subscribe":
                await quote_hub.subscribe(websocket, codes)
            elif action == "unsubscribe":
                await quote_hub.unsubscribe(websocket, codes)
            elif action == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        quote_hub.disconnect(websocket)
    except Exception as err:
        logger.error(f"[WS] 异常断开: {err}")
        quote_hub.disconnect(websocket)
