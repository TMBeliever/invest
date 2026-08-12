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
    """获取市场情绪及国债收益率"""
    bond_10y = akshare_client.get_bond_yield_10y()
    return {
        "fearGreedIndex": 38,
        "label": "FEAR",
        "bondYield10Y": bond_10y,
        "marginBalance": 1850000000000,
        "northboundNetFlow": 1520000000,
        "updatedAt": "盘中/最新"
    }
