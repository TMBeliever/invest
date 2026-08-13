import asyncio
import logging
from typing import Dict, Set, Any
from fastapi import WebSocket

from app.data.akshare_client import _batch_tencent_quote

logger = logging.getLogger(__name__)


def is_ashare_trading_time() -> bool:
    """简易判断是否属于交易/备战时段"""
    import datetime
    # UTC+8
    now = datetime.datetime.utcnow() + datetime.timedelta(hours=8)
    if now.weekday() >= 5:  # 周末
        return False
    minutes = now.hour * 60 + now.minute
    # 09:00 - 15:30 包含盘前集合竞价与盘后数据结算
    return 9 * 60 <= minutes <= 15 * 60 + 30


class QuoteHub:
    """
    行情订阅分发中心 (Subscription Registry)
    后端的全局单例，集中管理所有客户端订阅的股票代码。
    统一去重后通过 30只/批 的批量接口高效抓取，再根据行情 Diff 增量推送给前端。
    """

    def __init__(self):
        self._subscriptions: Dict[WebSocket, Set[str]] = {}
        self._last_snapshot: Dict[str, Dict[str, Any]] = {}
        self._task: asyncio.Task | None = None
        self._running = False

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self._subscriptions[websocket] = set()
        logger.info(f"[QuoteHub] 新客户端连接，当前连接数: {len(self._subscriptions)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self._subscriptions:
            del self._subscriptions[websocket]
            logger.info(f"[QuoteHub] 客户端断开，当前连接数: {len(self._subscriptions)}")

    async def subscribe(self, websocket: WebSocket, codes: list[str]):
        if websocket not in self._subscriptions:
            self._subscriptions[websocket] = set()
        for code in codes:
            c = code.strip()
            if c:
                self._subscriptions[websocket].add(c)
        
        # 订阅建立后，如果已有快照，立即补发当前已有行情
        instant_data = {
            c: self._last_snapshot[c]
            for c in self._subscriptions[websocket]
            if c in self._last_snapshot
        }
        if instant_data:
            await websocket.send_json({"type": "quote_update", "data": instant_data})

    async def unsubscribe(self, websocket: WebSocket, codes: list[str]):
        if websocket in self._subscriptions:
            for code in codes:
                self._subscriptions[websocket].discard(code.strip())

    def get_all_subscribed_codes(self) -> Set[str]:
        all_codes = set()
        for codes in self._subscriptions.values():
            all_codes.update(codes)
        return all_codes

    async def start(self):
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._poll_loop())
        logger.info("[QuoteHub] 定时行情推送轮询服务已启动")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("[QuoteHub] 定时行情推送轮询服务已停止")

    async def _poll_loop(self):
        while self._running:
            try:
                all_codes = self.get_all_subscribed_codes()
                if all_codes:
                    # 在线程池中执行同步的 HTTP 批量拉取，不阻塞 asyncio 事件循环
                    loop = asyncio.get_event_loop()
                    new_snapshot = await loop.run_in_executor(
                        None, _batch_tencent_quote, list(all_codes)
                    )

                    # 计算 Diff，仅挑选发生改变的字段/股票
                    changed_data: Dict[str, Dict[str, Any]] = {}
                    for code, quote in new_snapshot.items():
                        old_quote = self._last_snapshot.get(code)
                        if old_quote is None or old_quote.get("price") != quote.get("price"):
                            changed_data[code] = quote

                    # 更新内存中的最新快照
                    self._last_snapshot.update(new_snapshot)

                    # 分发给各个对应订阅的 WebSocket 连接
                    if changed_data:
                        disconnected = []
                        for ws, user_codes in list(self._subscriptions.items()):
                            user_updates = {
                                c: changed_data[c]
                                for c in user_codes
                                if c in changed_data
                            }
                            if user_updates:
                                try:
                                    await ws.send_json({
                                        "type": "quote_update",
                                        "data": user_updates
                                    })
                                except Exception as e:
                                    logger.warning(f"[QuoteHub] 发送给客户端失败，标记断开: {e}")
                                    disconnected.append(ws)

                        for ws in disconnected:
                            self.disconnect(ws)

            except Exception as err:
                logger.error(f"[QuoteHub] 轮询异常: {err}")

            # 盘中 2 秒推一次，非盘中 10 秒
            interval = 2 if is_ashare_trading_time() else 10
            await asyncio.sleep(interval)


quote_hub = QuoteHub()
