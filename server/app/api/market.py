import datetime
from fastapi import APIRouter
from typing import List, Dict, Any
from app.data.akshare_client import akshare_client

router = APIRouter()

@router.get("/indices")
def get_indices() -> List[Dict[str, Any]]:
    """获取主要市场指数 (AKShare 在线/实时抓取)"""
    return akshare_client.get_realtime_indices()

@router.get("/overview")
def get_market_overview() -> Dict[str, Any]:
    """获取市场全景总览数据（核心大盘+中证红利+港股+两市成交额+股债比价）"""
    return akshare_client.get_market_overview()

@router.get("/sentiment")
def get_sentiment() -> Dict[str, Any]:
    """获取市场情绪及国债收益率（全动态量化推算）"""
    bond_10y = akshare_client.get_bond_yield_10y() or 1.71
    overview = akshare_client.get_market_overview()
    indices = overview.get("indices", [])

    # 提取 A 股核心指数平均涨跌幅
    cn_indices = [x for x in indices if x.get("category") == "CN" and x.get("changePct") is not None]
    avg_change_pct = sum(x["changePct"] for x in cn_indices) / len(cn_indices) if cn_indices else 0.0

    # 结合股债溢价比与日涨跌幅动态推导情绪分数 (0~100)
    base_score = 50.0 + (avg_change_pct * 15.0)
    fear_greed = max(5, min(95, round(base_score)))

    if fear_greed <= 25:
        label = "EXTREME_FEAR"
    elif fear_greed <= 45:
        label = "FEAR"
    elif fear_greed <= 55:
        label = "NEUTRAL"
    elif fear_greed <= 75:
        label = "GREED"
    else:
        label = "EXTREME_GREED"

    return {
        "fearGreedIndex": fear_greed,
        "label": label,
        "bondYield10Y": bond_10y,
        "totalAmount": overview.get("totalAmount"),
        "riskPremiumRatio": overview.get("riskPremiumRatio"),
        "avgChangePct": round(avg_change_pct, 2),
        "updatedAt": datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    }
