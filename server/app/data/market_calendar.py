import datetime
import logging
import requests
from typing import Dict, Any, Optional, Set
import akshare as ak

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# 1. A 股官方交易日历缓存（24 小时刷新一次）
# ─────────────────────────────────────────────
_TRADE_DATES_CACHE: Set[str] = set()
_TRADE_DATES_FETCHED_AT: float = 0.0
_TRADE_DATES_CACHE_TTL: float = 86400.0  # 24 hours


def _refresh_trade_calendar_if_needed() -> Set[str]:
    global _TRADE_DATES_CACHE, _TRADE_DATES_FETCHED_AT
    now_ts = datetime.datetime.now().timestamp()
    if _TRADE_DATES_CACHE and (now_ts - _TRADE_DATES_FETCHED_AT) < _TRADE_DATES_CACHE_TTL:
        return _TRADE_DATES_CACHE

    try:
        df = ak.tool_trade_date_hist_sina()
        if df is not None and not df.empty and "trade_date" in df.columns:
            # 转换为 YYYY-MM-DD 格式集合
            dates = {str(d).split(" ")[0].strip() for d in df["trade_date"].dropna()}
            _TRADE_DATES_CACHE = dates
            _TRADE_DATES_FETCHED_AT = now_ts
            logger.info(f"成功加载 A 股交易日历，共 {len(dates)} 个交易日")
            return _TRADE_DATES_CACHE
    except Exception as e:
        logger.warning(f"获取 A 股交易日历失败，使用周末兜底算法: {e}")

    return _TRADE_DATES_CACHE


def is_trade_day(dt: Optional[datetime.date] = None) -> bool:
    """判断指定日期是否为 A 股交易日（自动规避周末、元旦、春节、清明、劳动、端午、中秋、国庆等休市日）"""
    if dt is None:
        dt = datetime.date.today()

    date_str = dt.strftime("%Y-%m-%d")
    trade_dates = _refresh_trade_calendar_if_needed()

    if trade_dates:
        return date_str in trade_dates

    # 兜底算法：周一至周五为交易日
    return dt.weekday() < 5


def get_market_status(now: Optional[datetime.datetime] = None) -> Dict[str, Any]:
    """
    返回当前市场交易阶段状态机与文案
    - PRE_MARKET: 盘前 (00:00 - 09:15)
    - INTRADAY: 盘中实时交易中 (09:15 - 15:00)
    - POST_MARKET: 今日已收盘 (15:00 - 24:00)
    - CLOSED: 休市日 (周末或法定节假日)
    """
    if now is None:
        now = datetime.datetime.now()

    today = now.date()
    trade_day = is_trade_day(today)

    if not trade_day:
        return {
            "isTradingDay": False,
            "session": "CLOSED",
            "statusText": "今日休市 (周末/节假日)",
            "canTrade": False,
        }

    now_time = now.time()
    t_0915 = datetime.time(9, 15)
    t_1500 = datetime.time(15, 0)

    if now_time < t_0915:
        return {
            "isTradingDay": True,
            "session": "PRE_MARKET",
            "statusText": "盘前未开市 (09:30 开盘)",
            "canTrade": False,
        }
    elif now_time <= t_1500:
        return {
            "isTradingDay": True,
            "session": "INTRADAY",
            "statusText": "交易中 (盘中实时行情)",
            "canTrade": True,
        }
    else:
        return {
            "isTradingDay": True,
            "session": "POST_MARKET",
            "statusText": "今日已收盘 (已锁定收盘价)",
            "canTrade": False,
        }


# ─────────────────────────────────────────────
# 2. 实时外汇汇率（USD/CNY, HKD/CNY，带 1 小时缓存与稳健默认降级）
# ─────────────────────────────────────────────
_FX_CACHE: Dict[str, float] = {"USD": 7.20, "HKD": 0.92, "CNY": 1.0}
_FX_FETCHED_AT: float = 0.0
_FX_CACHE_TTL: float = 3600.0  # 1 hour


def get_live_fx_rates() -> Dict[str, float]:
    """获取最新离岸人民币汇率 (USD/CNY, HKD/CNY)"""
    global _FX_CACHE, _FX_FETCHED_AT
    now_ts = datetime.datetime.now().timestamp()
    if (now_ts - _FX_FETCHED_AT) < _FX_CACHE_TTL and _FX_FETCHED_AT > 0:
        return _FX_CACHE.copy()

    try:
        headers = {"Referer": "https://finance.sina.com.cn"}
        r = requests.get("https://hq.sinajs.cn/list=fx_susdcnh,fx_shkdcnh", headers=headers, timeout=3)
        if r.status_code == 200:
            for line in r.text.strip().split(";\n"):
                if "fx_susdcnh" in line and '="' in line:
                    val = line.split('="')[1].split('"')[0]
                    parts = val.split(",")
                    if len(parts) > 1 and float(parts[1]) > 0:
                        _FX_CACHE["USD"] = round(float(parts[1]), 4)
                elif "fx_shkdcnh" in line and '="' in line:
                    val = line.split('="')[1].split('"')[0]
                    parts = val.split(",")
                    if len(parts) > 1 and float(parts[1]) > 0:
                        _FX_CACHE["HKD"] = round(float(parts[1]), 4)
            _FX_FETCHED_AT = now_ts
    except Exception as e:
        logger.warning(f"获取实时外汇汇率失败，使用缓存/默认汇率: {e}")

    return _FX_CACHE.copy()
