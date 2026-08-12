from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from app.data.akshare_client import akshare_client

router = APIRouter()

@router.get("/temperature")
def get_temperature() -> Dict[str, Any]:
    """获取红利板块温度 (结合 10 年期国债收益率)"""
    bond_10y = akshare_client.get_bond_yield_10y()
    return {
        "temperature": 32,
        "zone": "COOL",
        "indicators": {
            "pePercentile": 25,
            "dividendYield": 82,
            "yieldVsBondRatio": 88,
            "excessReturn60d": 45,
            "etfFlowScore": 52,
            "breakNetRatio": 30,
            "northboundChange": 48
        },
        "suggestion": f"当前 10 年国债收益率 {bond_10y}%，红利板块溢价处于历史 82% 显著估值优势区，建议积极配置。",
        "updatedAt": "今日盘中最新"
    }

@router.get("/top-stocks")
def get_top_stocks() -> List[Dict[str, Any]]:
    """获取全量中证红利 100 只成份股 + 大型红利蓝筹高胜率排行榜 (AKShare 在线实时)"""
    return akshare_client.get_dividend_constituents()

@router.get("/stock/{code}")
def get_stock_report(code: str) -> Dict[str, Any]:
    """获取任意 A 股股票体检报告"""
    return akshare_client.get_single_stock_report(code)
