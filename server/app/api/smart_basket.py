import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.api.auth import get_current_user
from app.data.storage import storage_db
from app.services.smart_dividend_basket import smart_dividend_basket_service

logger = logging.getLogger(__name__)
router = APIRouter()


class ApplyBasketPayload(BaseModel):
    stocks: List[Dict[str, Any]]
    totalInvestmentAmount: Optional[float] = 100000.0  # 拟投资总额 (默认10万元)
    targetAssetCategory: Optional[str] = "STOCK"


@router.get("/generate")
def generate_strategy_basket(
    count: int = Query(10, ge=3, le=20, description="股票数量 3 ~ 20 只"),
    strategy: str = Query("BALANCED_QUALITY", description="策略模式 (BALANCED_QUALITY | DEEP_VALUE_SAFETY | HIGH_ROE_GROWTH | SOVEREIGN_SUPPORT)"),
    weight_method: str = Query("EQUAL", description="权重方式 (EQUAL | DIVIDEND)"),
) -> Dict[str, Any]:
    """
    智能生成 3 ~ 20 只优质红利自选组合及中证红利 ETF 对比报告
    """
    try:
        return smart_dividend_basket_service.generate_basket(
            count=count,
            strategy=strategy,
            weight_method=weight_method,
        )
    except Exception as e:
        logger.error(f"生成智选组合失败: {e}")
        raise HTTPException(status_code=500, detail=f"生成组合失败: {str(e)}")


@router.post("/apply-to-assets")
def apply_basket_to_assets(
    payload: ApplyBasketPayload,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    将定制组合一键导入至用户的持仓账本
    """
    user_id = current_user["id"]
    total_amount = max(1000.0, float(payload.totalInvestmentAmount or 100000.0))
    imported_count = 0

    for s in payload.stocks:
        code = s.get("code")
        name = s.get("name")
        price = float(s.get("price") or 1.0)
        weight_pct = float(s.get("weightPct") or (100.0 / len(payload.stocks)))
        allocated_amount = round(total_amount * (weight_pct / 100.0), 2)
        shares = round(allocated_amount / price, 0) if price > 0 else 100

        storage_db.add_asset(
            user_id=user_id,
            category="STOCK",
            name=name,
            code=code,
            amount=allocated_amount,
            shares=shares,
            cost_price=price,
            notes=f"来自策略魔方【智选优质红利组合】一键导入 (权重 {weight_pct}%)",
        )
        imported_count += 1

    return {
        "status": "success",
        "message": f"成功将 {imported_count} 只优质红利标的导入至您的资产账本！",
        "importedCount": imported_count,
        "totalInvestmentAmount": total_amount,
    }
