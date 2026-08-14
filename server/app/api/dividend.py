from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Dict, Any, Optional
from app.api.auth import get_current_user
from app.data.akshare_client import akshare_client
from app.services.dividend_calendar import dividend_calendar_service

router = APIRouter()


@router.get("/temperature")
def get_temperature() -> Dict[str, Any]:
    """
    获取红利板块温度（全动态计算）。
    所有指标均基于腾讯实时行情 + AKShare 国债数据动态推算，无任何硬编码数值。
    """
    result = akshare_client.get_dividend_temperature()
    if result is None:
        raise HTTPException(status_code=503, detail="板块温度数据暂时无法获取，请稍后重试")
    return result


@router.get("/top-stocks")
def get_top_stocks(strategy: str = Query("composite")) -> List[Dict[str, Any]]:
    """
    获取中证红利成份股 + 高股息蓝筹排行榜（支持多策略切页）。
    strategy: composite | high_yield | break_net | high_roe | low_pe
    """
    stocks = akshare_client.get_dividend_constituents(strategy=strategy)
    if not stocks:
        raise HTTPException(status_code=503, detail="成份股行情数据暂时无法获取，请稍后重试")
    return stocks


@router.get("/calendar")
def get_dividend_calendar(
    monthly_expense: float = Query(8000.0, description="每月生活基础开支目标 (元)"),
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    获取当前用户的【未来 12 个月分红与利息现金流预测日历】与财务自由覆盖度。
    """
    user_id = current_user["id"]
    return dividend_calendar_service.generate_calendar(user_id, monthly_living_expense=monthly_expense)


@router.get("/stock/{code}")
def get_stock_report(code: str) -> Dict[str, Any]:
    """
    获取任意 A 股体检报告。
    所有行情数据来自腾讯实时 API；评分维度为量化模型分（已明确标注）。
    """
    try:
        return akshare_client.get_single_stock_report(code)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"股票数据获取失败：{e}")
