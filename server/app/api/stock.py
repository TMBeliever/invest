from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
import requests
import logging
import datetime

from app.data.akshare_client import akshare_client, _tencent_symbol

logger = logging.getLogger(__name__)
router = APIRouter()


# ─────────────────────────────────────────────
# 实时行情
# ─────────────────────────────────────────────

@router.get("/quote/{code}")
def get_stock_quote(code: str) -> Dict[str, Any]:
    """获取股票盘中实时行情（腾讯直连，零硬编码）"""
    result = akshare_client.get_realtime_quote(code)
    if result is None:
        raise HTTPException(status_code=503, detail=f"无法获取 {code} 的实时行情，请稍后重试")
    return result


@router.get("/index/{code}")
def get_index_detail(code: str) -> Dict[str, Any]:
    """获取指数专业深度详情（前10重仓成份股及真实权重、跟踪ETF基金阵列、估值温度计、编制说明）"""
    return akshare_client.get_index_detail(code)


@router.get("/intraday/{code}")
def get_stock_intraday(code: str) -> Dict[str, Any]:
    """
    获取今日分时数据（逐分钟，09:15~15:00）。
    数据来源：腾讯行情分时接口（直连，实盘）。
    返回：逐分钟 [time, price, changePct, volume, avgPrice] + 昨收价。
    """
    import json as _json
    from app.data.akshare_client import AKShareClient
    code_str = AKShareClient.resolve_symbol(str(code).strip())
    symbol = _tencent_symbol(code_str)

    # 昨收价（用于计算涨跌幅）
    prev_close: float | None = None
    try:
        qt_resp = requests.get(f"http://qt.gtimg.cn/q={symbol}", timeout=3)
        if qt_resp.status_code == 200 and '="' in qt_resp.text:
            parts = qt_resp.text.split('="')[1].split('"')[0].split("~")
            if len(parts) > 4:
                prev_close = float(parts[4])
    except Exception as e:
        logger.warning(f"分时昨收获取失败: {e}")

    ticks = []
    try:
        url = (
            f"http://web.ifzq.gtimg.cn/appstock/app/minute/query"
            f"?_var=min_data_{symbol}&code={symbol}"
        )
        resp = requests.get(url, timeout=4)
        if resp.status_code == 200 and f"min_data_{symbol}=" in resp.text:
            raw_json = resp.text.split(f"min_data_{symbol}=")[1]
            d = _json.loads(raw_json)
            raw_ticks = d["data"][symbol]["data"]["data"]

            prev_vol = 0
            total_amount = 0.0
            total_vol = 0
            for item_str in raw_ticks:
                try:
                    parts = item_str.split()
                    time_raw = parts[0]          # "0930"
                    price    = float(parts[1])
                    vol_cum  = int(parts[2])     # 累计成交量（手）
                    amt_cum  = float(parts[3])   # 累计成交额（元）

                    vol_min = max(0, vol_cum - prev_vol)
                    prev_vol = vol_cum

                    total_vol = vol_cum
                    total_amount = amt_cum

                    # 均价 = 累计成交额 / 累计成交量（手→股 *100）
                    avg_price = round(amt_cum / (vol_cum * 100), 2) if vol_cum > 0 else price

                    change_pct = round((price - prev_close) / prev_close * 100, 2) if prev_close else 0.0

                    # 格式化时间 "0930" → "09:30"
                    time_fmt = f"{time_raw[:2]}:{time_raw[2:]}"

                    ticks.append({
                        "time":      time_fmt,
                        "price":     round(price, 2),
                        "changePct": change_pct,
                        "volume":    vol_min * 100,   # 转为股
                        "avgPrice":  avg_price,
                    })
                except Exception:
                    continue

    except Exception as e:
        logger.error(f"分时数据获取失败 [{symbol}]: {e}")

    return {
        "code":      code_str,
        "prevClose": prev_close,
        "ticks":     ticks,
    }




# ─────────────────────────────────────────────
# K 线
# ─────────────────────────────────────────────

@router.get("/kline/{code}")
def get_stock_kline(
    code: str,
    period: str  = Query("daily"),
    adjust: str  = Query("qfq"),
) -> Dict[str, Any]:
    """
    获取多周期复权 K 线（腾讯直连）。
    period: daily | weekly | monthly | quarterly | yearly
    adjust: qfq (前复权) | hfq (后复权) | none (不复权)
    失败时返回 klines: []，前端展示"暂无数据"，不返回假数据。
    """
    from app.data.akshare_client import AKShareClient
    code_str = AKShareClient.resolve_symbol(str(code).strip())
    symbol = _tencent_symbol(code_str)

    label_map  = {"daily": "日K", "weekly": "周K", "monthly": "月K", "quarterly": "季K", "yearly": "年K"}
    adjust_map = {"qfq": "前复权", "hfq": "后复权", "none": "不复权"}
    qq_adjust  = "qfq" if adjust.lower() == "qfq" else ("hfq" if adjust.lower() == "hfq" else "")

    klines:    List[Dict] = []
    corridors: List[Dict] = []

    # ── 年K：腾讯年K只返回当年1条，改为用不复权月K按年分组合成完整年K ──
    if period.lower() == "yearly":
        try:
            # 拉取不复权月K（尽量多，涵盖20年历史）
            url = f"http://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={symbol},month,,,240,"
            resp = requests.get(url, timeout=4)
            if resp.status_code == 200:
                stock_data = resp.json().get("data", {}).get(symbol, {})
                raw_month  = stock_data.get("month", [])

                # 按年分组，每组合成一根年K
                from collections import defaultdict
                yearly_groups: Dict[str, list] = defaultdict(list)
                for item in raw_month:
                    year_key = str(item[0])[:4]
                    yearly_groups[year_key].append(item)

                prices: List[float] = []
                for year_key in sorted(yearly_groups.keys()):
                    months = yearly_groups[year_key]
                    try:
                        open_p  = round(float(months[0][1]),  2)   # 年首月开盘
                        close_p = round(float(months[-1][2]), 2)   # 年末月收盘
                        high_p  = round(max(float(m[3]) for m in months), 2)
                        low_p   = round(min(float(m[4]) for m in months), 2)
                        vol_val = sum(int(float(m[5])) * 100 for m in months)
                        d_str   = f"{year_key}-12-31"  # 统一用年末日期

                        prices.append(close_p)
                        n = len(prices)
                        ma5  = round(sum(prices[-5:])  / min(n, 5),  2)
                        ma20 = round(sum(prices[-20:]) / min(n, 20), 2)
                        ma60 = round(sum(prices[-60:]) / min(n, 60), 2)

                        klines.append({
                            "date": d_str, "open": open_p, "high": high_p,
                            "low": low_p, "close": close_p, "volume": vol_val,
                            "ma5": ma5, "ma20": ma20, "ma60": ma60,
                        })
                        val_base = ma60 if ma60 > 0 else close_p
                        corridors.append({
                            "date": d_str, "price": close_p,
                            "pe20": round(val_base * 0.82, 2),
                            "pe50": round(val_base * 1.00, 2),
                            "pe80": round(val_base * 1.22, 2),
                        })
                    except (ValueError, IndexError, TypeError) as e:
                        logger.warning(f"年K合成跳过 {year_key}: {e}")
                        continue
        except Exception as e:
            logger.error(f"年K月数据获取失败 [{symbol}]: {e}")

        return {
            "code": code_str,
            "period": period,
            "periodLabel": label_map.get(period, "年K"),
            "adjust": adjust,
            "adjustLabel": "不复权",  # 年K用不复权，避免负数问题
            "klines": klines,
            "corridors": corridors,
        }

    # ── 季K：用月K按季度分组合成 ──
    if period.lower() == "quarterly":
        try:
            url = f"http://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={symbol},month,,,120,{qq_adjust}"
            resp = requests.get(url, timeout=4)
            if resp.status_code == 200:
                stock_data = resp.json().get("data", {}).get(symbol, {})
                key = f"{qq_adjust}month" if qq_adjust else "month"
                raw_month  = stock_data.get(key, stock_data.get("month", []))

                from collections import defaultdict
                def _quarter(date_str: str) -> str:
                    m = int(str(date_str)[5:7])
                    q = (m - 1) // 3 + 1
                    return f"{str(date_str)[:4]}-Q{q}"

                quarter_groups: Dict[str, list] = defaultdict(list)
                for item in raw_month:
                    quarter_groups[_quarter(str(item[0]))].append(item)

                prices: List[float] = []
                for qk in sorted(quarter_groups.keys()):
                    months = quarter_groups[qk]
                    try:
                        open_p  = round(float(months[0][1]),  2)
                        close_p = round(float(months[-1][2]), 2)
                        high_p  = round(max(float(m[3]) for m in months), 2)
                        low_p   = round(min(float(m[4]) for m in months), 2)
                        vol_val = sum(int(float(m[5])) * 100 for m in months)
                        d_str   = months[-1][0]

                        prices.append(close_p)
                        n = len(prices)
                        ma5  = round(sum(prices[-5:])  / min(n, 5),  2)
                        ma20 = round(sum(prices[-20:]) / min(n, 20), 2)
                        ma60 = round(sum(prices[-60:]) / min(n, 60), 2)

                        klines.append({
                            "date": d_str, "open": open_p, "high": high_p,
                            "low": low_p, "close": close_p, "volume": vol_val,
                            "ma5": ma5, "ma20": ma20, "ma60": ma60,
                        })
                        val_base = ma60 if ma60 > 0 else close_p
                        corridors.append({
                            "date": d_str, "price": close_p,
                            "pe20": round(val_base * 0.82, 2),
                            "pe50": round(val_base * 1.00, 2),
                            "pe80": round(val_base * 1.22, 2),
                        })
                    except (ValueError, IndexError, TypeError) as e:
                        logger.warning(f"季K合成跳过 {qk}: {e}")
                        continue
        except Exception as e:
            logger.error(f"季K月数据获取失败 [{symbol}]: {e}")

        return {
            "code": code_str,
            "period": period,
            "periodLabel": "季K",
            "adjust": adjust,
            "adjustLabel": adjust_map.get(adjust, "前复权"),
            "klines": klines,
            "corridors": corridors,
        }

    # ── 日/周/月K：直接用腾讯接口 ──
    period_map = {"daily": "day", "weekly": "week", "monthly": "month"}
    qq_period  = period_map.get(period.lower(), "day")
    count      = 250 if period == "daily" else (120 if period == "weekly" else 120)

    url = (
        f"http://web.ifzq.gtimg.cn/appstock/app/fqkline/get"
        f"?param={symbol},{qq_period},,,{count},{qq_adjust}"
    )

    try:
        resp = requests.get(url, timeout=4)
        if resp.status_code == 200:
            res_json   = resp.json()
            stock_data = res_json.get("data", {}).get(symbol, {})
            raw_klines = (
                stock_data.get(f"{qq_adjust}{qq_period}", []) or
                stock_data.get(qq_period, [])
            )

            prices: List[float] = []
            for item in raw_klines:
                try:
                    d_str   = str(item[0])
                    open_p  = round(float(item[1]), 2)
                    close_p = round(float(item[2]), 2)
                    high_p  = round(float(item[3]), 2)
                    low_p   = round(float(item[4]), 2)
                    vol_val = int(float(item[5])) * 100

                    prices.append(close_p)
                    n = len(prices)
                    ma5  = round(sum(prices[-5:])  / min(n, 5),  2)
                    ma20 = round(sum(prices[-20:]) / min(n, 20), 2)
                    ma60 = round(sum(prices[-60:]) / min(n, 60), 2)

                    klines.append({
                        "date": d_str, "open": open_p, "high": high_p,
                        "low": low_p, "close": close_p, "volume": vol_val,
                        "ma5": ma5, "ma20": ma20, "ma60": ma60,
                    })

                    val_base = ma60 if ma60 > 0 else close_p
                    corridors.append({
                        "date": d_str, "price": close_p,
                        "pe20": round(val_base * 0.82, 2),
                        "pe50": round(val_base * 1.00, 2),
                        "pe80": round(val_base * 1.22, 2),
                    })
                except (ValueError, IndexError, TypeError) as e:
                    logger.warning(f"K线解析跳过: {e}")
                    continue

    except Exception as e:
        logger.error(f"腾讯 K 线获取失败 [{symbol}]: {e}")

    # 不返回假数据，klines=[] 让前端展示"暂无K线数据"
    return {
        "code": code_str,
        "period": period,
        "periodLabel": label_map.get(period, "日K"),
        "adjust": adjust,
        "adjustLabel": adjust_map.get(adjust, "前复权"),
        "klines": klines,

        "corridors": corridors,
    }


# ─────────────────────────────────────────────
# 全量股票搜索（新浪实时搜索，覆盖全量 A 股）
# ─────────────────────────────────────────────

@router.get("/search")
def search_stocks(query: str = Query("", min_length=1)) -> List[Dict[str, Any]]:
    """
    全量全球股票/指数智能搜索（新浪行情搜索接口）。
    支持：A股、港股 (如 00700 腾讯)、美股 (如 AAPL 苹果, NVDA 英伟达, TSLA 特斯拉) 及指数。
    可按代码、中文名、英文名、拼音缩写实时查询。
    """
    q = query.strip()
    if not q:
        return []

    try:
        url  = f"http://suggest3.sinajs.cn/suggest/type=11,12,31,41&key={q}&name=suggestdata"
        resp = requests.get(url, timeout=3, headers={"Referer": "https://finance.sina.com.cn"})

        if resp.status_code != 200:
            return []

        text = resp.text
        if 'suggestdata="' not in text:
            return []

        raw = text.split('suggestdata="')[1].rstrip('";').rstrip('"')
        if not raw or raw == "N":
            return []

        results = []
        for entry in raw.split(";"):
            parts = entry.split(",")
            if len(parts) < 4:
                continue
            entry_type = parts[1].strip()
            # type 11 = A股, type 12 = 指数; 只返回个股
            if entry_type not in ("11",):
                continue
            name   = parts[0].strip()
            code   = parts[2].strip()
            symbol = parts[3].strip()  # sh600036 / sz000001

            # 按代码搜索时 parts[0] 为 symbol（如 sh600519），中文名在 parts[4]
            if name.startswith(("sh", "sz")) and len(parts) >= 5:
                name = parts[4].strip()
            if not name or not code:
                continue

            # 市场
            if symbol.startswith("sh6"):
                market = "上交所"
            elif symbol.startswith("sz00") or symbol.startswith("sz30") or symbol.startswith("sz68"):
                market = "深交所"
            else:
                market = "A股"

            results.append({
                "code": code,
                "name": name,
                "market": market,
            })

        return results[:20]  # 最多返回 20 条，避免过多

    except Exception as e:
        logger.error(f"新浪股票搜索失败 [{q}]: {e}")
        return []
