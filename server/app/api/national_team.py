import logging
from typing import Any, Dict
from fastapi import APIRouter
from app.services.national_team import national_team_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/national-team", tags=["national-team"])


@router.get("/overview")
def get_national_team_overview() -> Dict[str, Any]:
    """
    获取国家队操盘雷达全景总览（包含实时护盘评级、总成交、预估净流入、四大主力底牌概览）
    """
    radar = national_team_service.get_realtime_defense_radar()
    holdings = national_team_service.get_national_team_holdings()
    follow = national_team_service.get_follow_strategy_pool()

    return {
        "radar": radar,
        "holdings": holdings,
        "followStrategy": follow,
    }


@router.get("/etf-radar")
def get_etf_radar() -> Dict[str, Any]:
    """
    获取 12 只国家队核心护盘 ETF 实时放量监控列表
    """
    return national_team_service.get_realtime_defense_radar()


@router.get("/holdings")
def get_holdings() -> Dict[str, Any]:
    """
    获取四大主力派系持仓底牌与重仓股矩阵
    """
    return national_team_service.get_national_team_holdings()


@router.get("/follow-strategy")
def get_follow_strategy() -> Dict[str, Any]:
    """
    获取「国家队重仓 + 高股息策略」高胜率跟随候选池
    """
    return national_team_service.get_follow_strategy_pool()


@router.get("/money-flow/{symbol}")
def get_money_flow(symbol: str) -> Dict[str, Any]:
    """
    获取个股真实逐日资金流向历史（近 15 个交易日）
    """
    return national_team_service.get_stock_money_flow(symbol)
