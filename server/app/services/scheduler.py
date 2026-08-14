import asyncio
import datetime
import logging
from typing import Set, Dict, Any, List, Optional
from app.data.storage import storage_db
from app.services.intelligence.sentinel_risk import sentinel_risk_generator
from app.services.intelligence.opportunity_patrol import opportunity_patrol_generator
from app.services.intelligence.morning_radar import morning_radar_generator
from app.services.intelligence.closing_review import closing_review_generator
from app.services.dispatcher.router import dispatch_router
from app.schemas.intelligence import Severity

logger = logging.getLogger(__name__)

class SchedulerService:
    def __init__(self):
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._pushed_keys: Set[str] = set()

    async def start(self):
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())
        logger.info("⏰ [SchedulerService] 智能研报、风险哨兵与机会雷达后台动态调度器已启动")

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
                current_hm = now.strftime("%H:%M")
                hour = now.hour
                minute = now.minute

                # 清理非当天的防抖缓存 (避免内存无限增长)
                self._pushed_keys = {k for k in self._pushed_keys if k.startswith(today_str)}

                # 获取所有配置了订阅偏好的用户列表
                with storage_db._get_conn() as conn:
                    cursor = conn.cursor()
                    cursor.execute("SELECT DISTINCT user_id FROM user_subscriptions WHERE user_id IS NOT NULL")
                    sub_users = [r[0] for r in cursor.fetchall()]

                # 若尚未有记录，默认纳管资产库中的所有用户
                if not sub_users:
                    with storage_db._get_conn() as conn:
                        cursor = conn.cursor()
                        cursor.execute("SELECT DISTINCT user_id FROM assets WHERE user_id IS NOT NULL")
                        sub_users = [r[0] for r in cursor.fetchall()]

                for u_id in sub_users:
                    cfg = storage_db.get_user_subscription(u_id)

                    # ─── 1. 动态早盘前瞻调度 (按用户设定的 HH:MM 触发) ─────────
                    if cfg.get("enable_morning_radar", True):
                        target_mr_time = str(cfg.get("morning_radar_time") or "08:45").strip()
                        mr_key = f"{today_str}:MR:{u_id}"
                        if current_hm == target_mr_time and mr_key not in self._pushed_keys:
                            self._pushed_keys.add(mr_key)
                            logger.info(f"🌅 [Scheduler] 触发用户 [{u_id}] 早盘前瞻推送 (设定时间: {target_mr_time})...")
                            try:
                                payload = await morning_radar_generator.generate()
                                await dispatch_router.dispatch(payload, user_id=u_id)
                            except Exception as e:
                                logger.error(f"[Scheduler] 早盘推送失败 [{u_id}]: {e}")

                    # ─── 2. 动态收盘复盘调度 (按用户设定的 HH:MM 触发) ─────────
                    if cfg.get("enable_closing_review", True):
                        target_cr_time = str(cfg.get("closing_review_time") or "15:30").strip()
                        cr_key = f"{today_str}:CR:{u_id}"
                        if current_hm == target_cr_time and cr_key not in self._pushed_keys:
                            self._pushed_keys.add(cr_key)
                            logger.info(f"🌆 [Scheduler] 触发用户 [{u_id}] 收盘复盘推送 (设定时间: {target_cr_time})...")
                            try:
                                payload = await closing_review_generator.generate()
                                await dispatch_router.dispatch(payload, user_id=u_id)
                            except Exception as e:
                                logger.error(f"[Scheduler] 收盘推送失败 [{u_id}]: {e}")

                    # ─── 3. 风险哨兵与机会巡视动态频次判定 ─────────────────────
                    freq = cfg.get("patrol_scan_frequency") or "INTERVAL_30MIN"
                    should_scan = False

                    # 仅在盘中及收盘时段执行 (09:30 ~ 16:00)
                    if 9 <= hour <= 16:
                        if freq == "INTERVAL_30MIN" and minute in (0, 30):
                            should_scan = True
                        elif freq == "INTERVAL_60MIN" and minute == 0:
                            should_scan = True
                        elif freq == "TIMES_1030_1430" and ((hour == 10 and minute == 30) or (hour == 14 and minute == 30)):
                            should_scan = True

                    if should_scan:
                        scan_slot_key = f"{today_str}:{u_id}:SCAN:{hour}:{minute}"
                        if scan_slot_key not in self._pushed_keys:
                            self._pushed_keys.add(scan_slot_key)

                            # 3.1 风险哨兵巡检
                            if cfg.get("enable_sentinel_alert", True):
                                try:
                                    alerts = await sentinel_risk_generator.scan_and_generate_alerts(u_id)
                                    for a in alerts:
                                        if a.severity in (Severity.WARNING, Severity.CRITICAL):
                                            rule_code = a.structured_metrics.get("rule_code", "")
                                            risk_key = f"{today_str}:RISK:{u_id}:{rule_code}"
                                            if risk_key not in self._pushed_keys:
                                                self._pushed_keys.add(risk_key)
                                                logger.info(f"🚨 [Scheduler] 触发用户 [{u_id}] 风险哨兵推送: {a.title}")
                                                await dispatch_router.dispatch(a, user_id=u_id)
                                except Exception as e:
                                    logger.error(f"[Scheduler] 巡检风险异常 [{u_id}]: {e}")

                            # 3.2 机会巡视雷达
                            if cfg.get("enable_opportunity_patrol", True):
                                try:
                                    opps = await opportunity_patrol_generator.scan_and_generate_opportunities(u_id)
                                    for op in opps:
                                        op_rule = op.structured_metrics.get("rule_code", "")
                                        op_symbol = op.symbol or "GLOBAL"
                                        op_key = f"{today_str}:OPP:{u_id}:{op_rule}:{op_symbol}"
                                        if op_key not in self._pushed_keys:
                                            self._pushed_keys.add(op_key)
                                            logger.info(f"🎯 [Scheduler] 触发用户 [{u_id}] 机会雷达推送: {op.title}")
                                            await dispatch_router.dispatch(op, user_id=u_id)
                                except Exception as e:
                                    logger.error(f"[Scheduler] 巡检机会异常 [{u_id}]: {e}")

            except Exception as e:
                logger.error(f"[SchedulerService] 调度循环异常: {e}")

            # 每 60 秒检查一次时钟
            await asyncio.sleep(60)

scheduler_service = SchedulerService()
