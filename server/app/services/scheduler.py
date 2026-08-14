import asyncio
import datetime
import logging
from typing import Set
from app.data.storage import storage_db
from app.services.intelligence.sentinel_risk import sentinel_risk_generator
from app.services.intelligence.morning_radar import morning_radar_generator
from app.services.intelligence.closing_review import closing_review_generator
from app.services.dispatcher.router import dispatch_router
from app.schemas.intelligence import Severity

logger = logging.getLogger(__name__)

class SchedulerService:
    def __init__(self):
        self._running = False
        self._task: asyncio.Task = None
        self._last_morning_date: str = ""
        self._last_closing_date: str = ""
        self._last_scan_slot: str = ""
        self._pushed_sentinel_keys: Set[str] = set()

    async def start(self):
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())
        logger.info("⏰ [SchedulerService] 智能研报与风险哨兵后台调度器已启动")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("⏰ [SchedulerService] 后台调度器已停止")

    async def _loop(self):
        while self._running:
            try:
                now = datetime.datetime.now()
                today_str = now.strftime("%Y-%m-%d")
                hour = now.hour
                minute = now.minute
                current_slot = f"{today_str}_{hour}_{minute}"

                # ─── 1. 早盘前瞻推送 (工作日 08:45 ~ 09:15) ─────────────
                if (hour == 8 and minute >= 45) or (hour == 9 and minute <= 15):
                    if self._last_morning_date != today_str:
                        self._last_morning_date = today_str
                        await self._run_morning_radar(today_str)

                # ─── 2. 每日收盘复盘推送 (工作日 15:30 ~ 16:30) ───────────
                if hour == 15 and minute >= 30:
                    if self._last_closing_date != today_str:
                        self._last_closing_date = today_str
                        await self._run_closing_review(today_str)

                # ─── 3. 风险哨兵定期巡检 (盘中 10:00, 14:00, 15:35 各执行 1 次) ─────
                if hour in (10, 14, 15) and minute in (0, 35):
                    if self._last_scan_slot != current_slot:
                        self._last_scan_slot = current_slot
                        await self._scan_all_users_sentinel(today_str)

            except Exception as e:
                logger.error(f"[SchedulerService] 调度循环异常: {e}")

            # 每 60 秒检查一次
            await asyncio.sleep(60)

    async def _run_morning_radar(self, today_str: str):
        logger.info(f"🌅 [Scheduler] 触发每日早盘前瞻全自动生成与推送 ({today_str})...")
        try:
            payload = await morning_radar_generator.generate()
            with storage_db._get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT user_id FROM user_subscriptions WHERE enable_morning_radar = 1")
                rows = cursor.fetchall()
                for row in rows:
                    u_id = row[0]
                    await dispatch_router.dispatch(payload, user_id=u_id)
        except Exception as e:
            logger.error(f"[Scheduler] 早盘推送失败: {e}")

    async def _run_closing_review(self, today_str: str):
        logger.info(f"🌆 [Scheduler] 触发每日收盘复盘全自动生成与推送 ({today_str})...")
        try:
            payload = await closing_review_generator.generate()
            with storage_db._get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT user_id FROM user_subscriptions WHERE enable_closing_review = 1")
                rows = cursor.fetchall()
                for row in rows:
                    u_id = row[0]
                    await dispatch_router.dispatch(payload, user_id=u_id)
        except Exception as e:
            logger.error(f"[Scheduler] 收盘复盘推送失败: {e}")

    async def _scan_all_users_sentinel(self, today_str: str):
        """扫描所有持仓用户的风险哨兵，发现重要风险且未推送过的，即时推送"""
        try:
            with storage_db._get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT DISTINCT user_id FROM assets WHERE user_id IS NOT NULL")
                users = [r[0] for r in cursor.fetchall()]

            for u_id in users:
                alerts = await sentinel_risk_generator.scan_and_generate_alerts(u_id)
                for a in alerts:
                    if a.severity in (Severity.WARNING, Severity.CRITICAL):
                        rule_code = a.structured_metrics.get("rule_code", "")
                        push_key = f"{today_str}:{u_id}:{rule_code}"
                        if push_key not in self._pushed_sentinel_keys:
                            self._pushed_sentinel_keys.add(push_key)
                            logger.info(f"🚨 [Scheduler] 触发用户 [{u_id}] 风险哨兵推送: {a.title}")
                            await dispatch_router.dispatch(a, user_id=u_id)
        except Exception as e:
            logger.error(f"[Scheduler] 巡检哨兵风险异常: {e}")

scheduler_service = SchedulerService()
