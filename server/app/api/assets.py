import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.services.auth import get_current_user

from app.data.akshare_client import _batch_tencent_quote, get_otc_fund_nav
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
    fundType: Optional[str] = None
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
            "fund_type": self.fundType,
            "notes": self.notes,
        }


def _enrich_assets(raw_assets: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    按类别自动算账：
    - STOCK / 场内 ETF (FUND + fund_type=EXCHANGE)：走腾讯行情批量接口，秒级实时价
    - 场外基金 (FUND + fund_type=OTC)：走每日收盘净值接口，T-1 日数据，非实时
    - 存款/理财/其他：按录入值计算
    """
    is_exchange_traded = lambda a: a["category"] == "STOCK" or (
        a["category"] == "FUND" and (a.get("fund_type") or "EXCHANGE") != "OTC"
    )
    is_otc_fund = lambda a: a["category"] == "FUND" and a.get("fund_type") == "OTC"

    quote_codes = [a["code"] for a in raw_assets if is_exchange_traded(a) and a.get("code")]
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

        if is_exchange_traded(a):
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
            cost_dividend_yield = round(annual_income / cost_value * 100, 2) if (
                category == "STOCK" and cost_value > 0 and annual_income > 0
            ) else dividend_yield

            item.update({
                "fundType": "EXCHANGE" if category == "FUND" else None,
                "shares": shares,
                "costPrice": cost_price,
                "currentPrice": current_price,
                "currentValue": current_value,
                "profit": profit,
                "profitPct": profit_pct,
                "dividendYield": dividend_yield,
                "costDividendYield": cost_dividend_yield,
                "annualIncome": annual_income,
                "dataStale": quote is None,  # 行情拉取失败时用成本价兜底，标记给前端提示
                "priceAsOf": "REALTIME",
            })

        elif is_otc_fund(a):
            shares = a.get("shares") or 0.0
            cost_price = a.get("cost_price") or 0.0
            nav = get_otc_fund_nav(a["code"]) if a.get("code") else None

            current_price = nav["navPrice"] if nav else cost_price
            current_value = round(shares * current_price, 2)
            cost_value = shares * cost_price
            profit = round(current_value - cost_value, 2)
            profit_pct = round((profit / cost_value * 100), 2) if cost_value > 0 else 0.0

            item.update({
                "fundType": "OTC",
                "shares": shares,
                "costPrice": cost_price,
                "currentPrice": current_price,
                "currentValue": current_value,
                "profit": profit,
                "profitPct": profit_pct,
                "dividendYield": None,
                "annualIncome": 0.0,
                "dataStale": nav is None,
                "priceAsOf": "PREV_CLOSE_NAV",  # 场外基金净值为 T-1/收盘披露，非盘中实时
                "navDate": nav["navDate"] if nav else None,
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
def get_assets_summary(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    user_id = current_user["id"]
    raw_assets = storage_db.get_all_assets(user_id)
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


def _validate_payload(body: AssetPayload) -> None:
    if body.category not in CATEGORY_LABELS:
        raise HTTPException(status_code=400, detail=f"未知资产类别: {body.category}")
    if body.category == "FUND" and body.fundType not in ("EXCHANGE", "OTC"):
        raise HTTPException(status_code=400, detail="基金需指定 fundType: EXCHANGE(场内ETF) 或 OTC(场外基金)")


@router.post("", status_code=201)
def add_asset(body: AssetPayload, current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    _validate_payload(body)
    user_id = current_user["id"]
    asset_id = storage_db.add_asset(user_id, body.to_storage_dict())
    return {"status": "ok", "id": asset_id}


@router.put("/{asset_id}")
def update_asset(asset_id: int, body: AssetPayload, current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    _validate_payload(body)
    user_id = current_user["id"]
    ok = storage_db.update_asset(asset_id, user_id, body.to_storage_dict())
    if not ok:
        raise HTTPException(status_code=404, detail="资产不存在或无权限编辑")
    return {"status": "ok"}


@router.get("/lookup")
def quick_lookup_asset(code: str) -> Dict[str, Any]:
    """
    根据股票/基金代码自动推导类别、智能拉取真实名称与盘中现价
    """
    c = code.strip().upper()
    if not c:
        raise HTTPException(status_code=400, detail="请输入代码")

    category = "STOCK"
    fund_type = None

    if len(c) == 6 and c.isdigit():
        prefix2 = c[:2]
        if prefix2 in ("51", "52", "56", "58", "15", "16", "50"):
            category = "FUND"
            fund_type = "EXCHANGE"
        elif prefix2 in ("60", "68", "00", "30", "43", "83", "87", "88", "92"):
            category = "STOCK"
            fund_type = None
        else:
            category = "FUND"
            fund_type = "OTC"

    name = None
    current_price = None
    dividend_yield = None

    if category == "STOCK" or fund_type == "EXCHANGE":
        quotes = _batch_tencent_quote([c])
        quote = quotes.get(c)
        if quote:
            name = quote.get("name")
            current_price = quote.get("price")
            dividend_yield = quote.get("dividendYield")
    elif fund_type == "OTC":
        nav = get_otc_fund_nav(c)
        if nav:
            name = nav.get("fundName")
            current_price = nav.get("navPrice")

    if not name:
        from app.data.akshare_client import search_stocks
        search_res = search_stocks(c)
        if search_res:
            matched = search_res[0]
            name = matched.get("name")
            current_price = matched.get("price")

    return {
        "code": c,
        "name": name or c,
        "category": category,
        "fundType": fund_type,
        "currentPrice": current_price,
        "dividendYield": dividend_yield,
        "found": name is not None,
    }


@router.delete("/{asset_id}")
def delete_asset(asset_id: int, current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    user_id = current_user["id"]
    ok = storage_db.delete_asset(asset_id, user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="资产不存在或无权限删除")
    return {"status": "ok"}
