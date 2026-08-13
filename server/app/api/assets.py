import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.data.akshare_client import _batch_tencent_quote
from app.data.storage import storage_db

logger = logging.getLogger(__name__)
router = APIRouter()

CATEGORY_LABELS: Dict[str, str] = {
    "DEPOSIT": "存款",
    "STOCK": "股票",
    "FUND": "基金",
    "WEALTH": "理财",
    "OTHER": "其他",
}


class AssetPayload(BaseModel):
    category: str
    name: str
    code: Optional[str] = None
    amount: Optional[float] = None
    shares: Optional[float] = None
    costPrice: Optional[float] = None
    annualRate: Optional[float] = None
    depositType: Optional[str] = None
    maturityDate: Optional[str] = None
    notes: Optional[str] = None

    def to_storage_dict(self) -> Dict[str, Any]:
        return {
            "category": self.category,
            "name": self.name,
            "code": self.code,
            "amount": self.amount,
            "shares": self.shares,
            "cost_price": self.costPrice,
            "annual_rate": self.annualRate,
            "deposit_type": self.depositType,
            "maturity_date": self.maturityDate,
            "notes": self.notes,
        }


def _enrich_assets(raw_assets: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """按类别自动算账：股票/场内基金走实时行情，存款/理财/其他按录入值计算"""
    # STOCK 和 FUND（场内 ETF）统一走腾讯行情批量接口
    quote_codes = [
        a["code"] for a in raw_assets
        if a["category"] in ("STOCK", "FUND") and a.get("code")
    ]
    quotes = _batch_tencent_quote(quote_codes) if quote_codes else {}

    enriched = []
    for a in raw_assets:
        category = a["category"]
        item: Dict[str, Any] = {
            "id": a["id"],
            "category": category,
            "name": a["name"],
            "code": a.get("code"),
            "notes": a.get("notes"),
        }

        if category in ("STOCK", "FUND"):
            shares = a.get("shares") or 0.0
            cost_price = a.get("cost_price") or 0.0
            quote = quotes.get(a.get("code")) if a.get("code") else None

            current_price = quote["price"] if quote else cost_price
            current_value = round(shares * current_price, 2)
            cost_value = shares * cost_price
            profit = round(current_value - cost_value, 2)
            profit_pct = round((profit / cost_value * 100), 2) if cost_value > 0 else 0.0

            dividend_yield = quote.get("dividendYield") if quote else None
            annual_income = round(current_value * dividend_yield / 100, 2) if (
                category == "STOCK" and dividend_yield is not None
            ) else 0.0

            item.update({
                "shares": shares,
                "costPrice": cost_price,
                "currentPrice": current_price,
                "currentValue": current_value,
                "profit": profit,
                "profitPct": profit_pct,
                "dividendYield": dividend_yield,
                "annualIncome": annual_income,
                "dataStale": quote is None,  # 行情拉取失败时用成本价兜底，标记给前端提示
            })

        elif category in ("DEPOSIT", "WEALTH"):
            amount = a.get("amount") or 0.0
            annual_rate = a.get("annual_rate") or 0.0
            item.update({
                "amount": amount,
                "annualRate": annual_rate,
                "depositType": a.get("deposit_type"),
                "maturityDate": a.get("maturity_date"),
                "currentValue": round(amount, 2),
                "annualIncome": round(amount * annual_rate / 100, 2),
            })

        else:  # OTHER
            amount = a.get("amount") or 0.0
            item.update({
                "amount": amount,
                "currentValue": round(amount, 2),
                "annualIncome": 0.0,
            })

        enriched.append(item)

    return enriched


@router.get("/summary")
def get_assets_summary() -> Dict[str, Any]:
    raw_assets = storage_db.get_all_assets()
    assets = _enrich_assets(raw_assets)

    total_value = sum(a["currentValue"] for a in assets)
    total_cost = sum(
        (a.get("shares", 0) or 0) * (a.get("costPrice", 0) or 0)
        for a in assets if a["category"] in ("STOCK", "FUND")
    )
    total_profit = sum(a.get("profit", 0) for a in assets if a["category"] in ("STOCK", "FUND"))
    total_profit_pct = round((total_profit / total_cost * 100), 2) if total_cost > 0 else 0.0
    estimated_annual_income = sum(a.get("annualIncome", 0) for a in assets)

    category_totals: Dict[str, float] = {}
    for a in assets:
        category_totals[a["category"]] = category_totals.get(a["category"], 0.0) + a["currentValue"]

    allocation = [
        {
            "category": cat,
            "label": CATEGORY_LABELS.get(cat, cat),
            "value": round(value, 2),
            "pct": round((value / total_value * 100), 2) if total_value > 0 else 0.0,
        }
        for cat, value in category_totals.items()
    ]

    return {
        "summary": {
            "totalValue": round(total_value, 2),
            "totalProfit": round(total_profit, 2),
            "totalProfitPct": total_profit_pct,
            "estimatedAnnualIncome": round(estimated_annual_income, 2),
            "assetCount": len(assets),
        },
        "allocation": allocation,
        "assets": assets,
    }


@router.post("", status_code=201)
def add_asset(body: AssetPayload) -> Dict[str, Any]:
    if body.category not in CATEGORY_LABELS:
        raise HTTPException(status_code=400, detail=f"未知资产类别: {body.category}")
    asset_id = storage_db.add_asset(body.to_storage_dict())
    return {"status": "ok", "id": asset_id}


@router.put("/{asset_id}")
def update_asset(asset_id: int, body: AssetPayload) -> Dict[str, Any]:
    if body.category not in CATEGORY_LABELS:
        raise HTTPException(status_code=400, detail=f"未知资产类别: {body.category}")
    ok = storage_db.update_asset(asset_id, body.to_storage_dict())
    if not ok:
        raise HTTPException(status_code=404, detail="资产不存在")
    return {"status": "ok"}


@router.delete("/{asset_id}")
def delete_asset(asset_id: int) -> Dict[str, Any]:
    ok = storage_db.delete_asset(asset_id)
    if not ok:
        raise HTTPException(status_code=404, detail="资产不存在")
    return {"status": "ok"}
