import logging
import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.services.auth import get_current_user

from app.data.akshare_client import _batch_tencent_quote, get_otc_fund_nav, AKShareClient
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
    startDate: Optional[str] = None
    maturityDate: Optional[str] = None
    payoutMethod: Optional[str] = None
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
            "start_date": self.startDate,
            "maturity_date": self.maturityDate,
            "payout_method": self.payoutMethod,
            "fund_type": self.fundType,
            "notes": self.notes,
        }


def _enrich_assets(raw_assets: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    按类别与维度自动算账：
    - 股票账户 (STOCK / 场内 ETF FUND+EXCHANGE)：腾讯实时行情，计算今日盈亏 (Daily P&L) 与浮动股息
    - 理财账户 (场外基金 FUND+OTC / 存款 DEPOSIT / 理财 WEALTH)：
        * 存款/理财：计算确定性每日利息 (amount * rate / 365) 与年收益
        * 场外基金：基于最新披露净值及日涨跌幅计算单日变动
    - 股息维度：从确定性利息中剥离，单独立项统计预估年分红与参考日均分红
    """
    def _is_otc_fund(a: Dict[str, Any]) -> bool:
        if a.get("category") != "FUND":
            return False
        if a.get("fund_type") == "OTC":
            return True
        code = str(a.get("code") or "").strip()
        if code and len(code) == 6 and code.isdigit():
            # 沪深交易所场内上市 ETF / LOF 代码前缀: 51, 15, 56, 58, 16, 52, 50
            if code[:2] not in ("51", "15", "56", "58", "16", "52", "50"):
                return True
        return False

    is_exchange_traded = lambda a: a["category"] == "STOCK" or (
        a["category"] == "FUND" and not _is_otc_fund(a)
    )
    is_otc_fund = lambda a: _is_otc_fund(a)

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

            # 若为基金且场内行情未查到，自动兜底尝试场外基金净值接口
            nav_fallback = None
            if quote is None and category == "FUND" and a.get("code"):
                nav_fallback = get_otc_fund_nav(a["code"])
                if nav_fallback and nav_fallback.get("navPrice"):
                    quote = {"price": nav_fallback["navPrice"], "prevClose": nav_fallback["navPrice"], "change": 0.0, "changePct": nav_fallback.get("changePct") or 0.0, "dividendYield": None}

            current_price = quote["price"] if quote else cost_price
            prev_close = quote.get("prevClose") if quote else cost_price
            change = quote.get("change") if quote else 0.0
            change_pct = quote.get("changePct") if quote else 0.0

            current_value = round(shares * current_price, 2)
            cost_value = round(shares * cost_price, 4)
            profit = round(current_value - cost_value, 2)
            profit_pct = round((profit / cost_value * 100), 2) if cost_value > 0 else 0.0

            # 今日盈亏 (Daily P&L) = (现价 - 昨收) * 持股数
            daily_profit = round(change * shares, 2) if change else 0.0
            daily_profit_pct = round(change_pct, 2) if change_pct else 0.0

            dividend_yield = quote.get("dividendYield") if quote else None
            # 股息单独立项：预估年分红与日均参考
            estimated_dividend_annual = round(current_value * dividend_yield / 100, 2) if (
                category == "STOCK" and dividend_yield is not None
            ) else 0.0
            estimated_dividend_daily = round(estimated_dividend_annual / 365.0, 2) if estimated_dividend_annual > 0 else 0.0

            cost_dividend_yield = round(estimated_dividend_annual / cost_value * 100, 2) if (
                category == "STOCK" and cost_value > 0 and estimated_dividend_annual > 0
            ) else dividend_yield

            item.update({
                "accountType": "STOCK_ACCOUNT", # 股票账户维度
                "fundType": "EXCHANGE" if category == "FUND" and not nav_fallback else "OTC",
                "shares": shares,
                "costPrice": cost_price,
                "currentPrice": current_price,
                "prevClose": prev_close,
                "currentValue": current_value,
                "dailyProfit": daily_profit,
                "dailyProfitPct": daily_profit_pct,
                "dailyIncome": estimated_dividend_daily, # 股息日参考
                "profit": profit,
                "profitPct": profit_pct,
                "dividendYield": dividend_yield,
                "costDividendYield": cost_dividend_yield,
                "estimatedDividendAnnual": estimated_dividend_annual,
                "estimatedDividendDaily": estimated_dividend_daily,
                "annualIncome": estimated_dividend_annual,
                "dataStale": quote is None,  # 行情拉取失败时用成本价兜底
                "priceAsOf": "REALTIME" if quote and not nav_fallback else "PREV_CLOSE_NAV",
                "navDate": nav_fallback.get("navDate") if nav_fallback else None,
            })

        elif is_otc_fund(a):
            shares = a.get("shares") or 0.0
            cost_price = a.get("cost_price") or 0.0
            nav = get_otc_fund_nav(a["code"]) if a.get("code") else None

            current_price = nav["navPrice"] if nav else cost_price
            current_value = round(shares * current_price, 2)
            cost_value = round(shares * cost_price, 4)
            profit = round(current_value - cost_value, 2)
            profit_pct = round((profit / cost_value * 100), 2) if cost_value > 0 else 0.0

            change_pct = nav.get("changePct") if (nav and nav.get("changePct") is not None) else 0.0
            daily_profit = round(current_value * (change_pct / 100.0), 2) if change_pct else 0.0
            daily_profit_pct = round(change_pct, 2) if change_pct else 0.0

            item.update({
                "accountType": "WEALTH_ACCOUNT", # 理财账户维度
                "fundType": "OTC",
                "shares": shares,
                "costPrice": cost_price,
                "currentPrice": current_price,
                "prevClose": current_price,
                "currentValue": current_value,
                "dailyProfit": daily_profit,
                "dailyProfitPct": daily_profit_pct,
                "dailyIncome": 0.0,
                "profit": profit,
                "profitPct": profit_pct,
                "dividendYield": None,
                "estimatedDividendAnnual": 0.0,
                "estimatedDividendDaily": 0.0,
                "annualIncome": 0.0,
                "dataStale": nav is None,
                "priceAsOf": "PREV_CLOSE_NAV",  # 场外基金净值为 T-1/收盘披露
                "navDate": nav["navDate"] if nav else None,
            })

        elif category in ("DEPOSIT", "WEALTH"):
            raw_amount = a.get("amount")
            raw_rate = a.get("annual_rate")
            
            def _to_float(v):
                if v is None: return 0.0
                if isinstance(v, (int, float)): return float(v)
                try: return float(str(v).replace(",", "").replace("¥", "").replace("%", "").strip())
                except: return 0.0

            amount = _to_float(raw_amount)
            annual_rate = _to_float(raw_rate)
            start_date_str = a.get("start_date")
            days_held = None
            accrued_interest = None

            # 确定性利息计算
            annual_income = round(amount * (annual_rate / 100.0), 2)
            daily_income = round(amount * (annual_rate / 100.0) / 365.0, 2)

            if start_date_str:
                try:
                    start_dt = datetime.datetime.strptime(str(start_date_str).strip(), "%Y-%m-%d").date()
                    today = datetime.date.today()
                    if today >= start_dt:
                        days_held = (today - start_dt).days
                        accrued_interest = round(amount * (annual_rate / 100.0) * (days_held / 365.0), 2)
                except Exception:
                    pass

            payout_method = a.get("payout_method") or "MATURITY"

            item.update({
                "accountType": "WEALTH_ACCOUNT", # 理财账户维度
                "amount": amount,
                "annualRate": annual_rate,
                "depositType": a.get("deposit_type"),
                "startDate": start_date_str,
                "maturityDate": a.get("maturity_date"),
                "payoutMethod": payout_method,
                "daysHeld": days_held,
                "accruedInterest": accrued_interest,
                "currentValue": round(amount, 2),
                "dailyProfit": daily_income, # 确定性每日计提利息
                "dailyProfitPct": round((annual_rate / 365.0), 4) if annual_rate else 0.0,
                "dailyIncome": daily_income,
                "annualIncome": annual_income,
                "estimatedDividendAnnual": 0.0,
                "estimatedDividendDaily": 0.0,
            })

        else:  # OTHER
            amount = a.get("amount") or 0.0
            item.update({
                "accountType": "OTHER_ACCOUNT",
                "amount": amount,
                "currentValue": round(amount, 2),
                "dailyProfit": 0.0,
                "dailyProfitPct": 0.0,
                "dailyIncome": 0.0,
                "annualIncome": 0.0,
                "estimatedDividendAnnual": 0.0,
                "estimatedDividendDaily": 0.0,
            })

        enriched.append(item)

    return enriched


@router.get("/summary")
def get_assets_summary(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    user_id = current_user["id"]
    raw_assets = storage_db.get_all_assets(user_id)
    assets = _enrich_assets(raw_assets)

    total_value = sum(a["currentValue"] for a in assets)

    # 1. 股票账户维度 (场内股票 + 场内ETF)
    stock_assets = [a for a in assets if a.get("accountType") == "STOCK_ACCOUNT"]
    stock_val = sum(a["currentValue"] for a in stock_assets)
    stock_daily_profit = sum(a.get("dailyProfit", 0) or 0 for a in stock_assets)
    stock_prev_val = sum(
        (a.get("prevClose") if a.get("prevClose") is not None else a.get("currentPrice", 0)) * (a.get("shares", 0) or 0)
        for a in stock_assets
    )
    stock_daily_profit_pct = round((stock_daily_profit / stock_prev_val * 100), 2) if stock_prev_val > 0 else 0.0
    stock_cost = sum((a.get("shares", 0) or 0) * (a.get("costPrice", 0) or 0) for a in stock_assets)
    stock_total_profit = sum(a.get("profit", 0) or 0 for a in stock_assets)
    stock_total_profit_pct = round((stock_total_profit / stock_cost * 100), 2) if stock_cost > 0 else 0.0

    stock_account = {
        "totalValue": round(stock_val, 2),
        "dailyProfit": round(stock_daily_profit, 2),
        "dailyProfitPct": stock_daily_profit_pct,
        "totalProfit": round(stock_total_profit, 2),
        "totalProfitPct": stock_total_profit_pct,
        "count": len(stock_assets),
    }

    # 2. 理财账户维度 (稳健存款 + 理财 + 场外基金)
    wealth_assets = [a for a in assets if a.get("accountType") == "WEALTH_ACCOUNT"]
    wealth_val = sum(a["currentValue"] for a in wealth_assets)
    # 确定性每日生息 = 存款日息 + 理财日收益
    guaranteed_daily_income = sum(
        a.get("dailyIncome", 0) or 0 for a in wealth_assets if a["category"] in ("DEPOSIT", "WEALTH")
    )
    guaranteed_annual_income = sum(
        a.get("annualIncome", 0) or 0 for a in wealth_assets if a["category"] in ("DEPOSIT", "WEALTH")
    )
    otc_daily_profit = sum(
        a.get("dailyProfit", 0) or 0 for a in wealth_assets if a["category"] == "FUND"
    )

    wealth_account = {
        "totalValue": round(wealth_val, 2),
        "guaranteedDailyIncome": round(guaranteed_daily_income, 2),
        "guaranteedAnnualIncome": round(guaranteed_annual_income, 2),
        "otcDailyProfit": round(otc_daily_profit, 2),
        "count": len(wealth_assets),
    }

    # 3. 股息单独维度 (上市公司预估分红 - 浮动现金流)
    dividend_stocks = [a for a in assets if a["category"] == "STOCK" and (a.get("dividendYield") or 0) > 0]
    estimated_annual_dividend = sum(a.get("estimatedDividendAnnual", 0) or 0 for a in dividend_stocks)
    estimated_daily_dividend = round(estimated_annual_dividend / 365.0, 2)
    div_stock_val = sum(a["currentValue"] for a in dividend_stocks)
    avg_dividend_yield = round((estimated_annual_dividend / div_stock_val * 100), 2) if div_stock_val > 0 else 0.0

    dividend_dimension = {
        "estimatedAnnualDividend": round(estimated_annual_dividend, 2),
        "estimatedDailyDividend": estimated_daily_dividend,
        "avgDividendYield": avg_dividend_yield,
        "hasDividendAssetsCount": len(dividend_stocks),
    }

    # 4. 全局总览汇总
    # 今日实收与变动 = 股票账户今日盈亏 + 确定性日利息 + 场外基金单日变动
    today_profit = round(stock_daily_profit + guaranteed_daily_income + otc_daily_profit, 2)
    today_prev_val = total_value - today_profit
    today_profit_pct = round((today_profit / today_prev_val * 100), 2) if today_prev_val > 0 else 0.0

    total_cost = sum(
        (a.get("shares", 0) or 0) * (a.get("costPrice", 0) or 0)
        for a in assets if a["category"] in ("STOCK", "FUND")
    )
    total_profit = sum(a.get("profit", 0) for a in assets if a["category"] in ("STOCK", "FUND"))
    total_profit_pct = round((total_profit / total_cost * 100), 2) if total_cost > 0 else 0.0

    # 预估年被动现金流（确定性利息 + 预估股票分红）
    estimated_annual_income = round(guaranteed_annual_income + estimated_annual_dividend, 2)
    estimated_daily_income = round(guaranteed_daily_income + estimated_daily_dividend, 2)

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
            "todayProfit": today_profit,
            "todayProfitPct": today_profit_pct,
            "totalProfit": round(total_profit, 2),
            "totalProfitPct": total_profit_pct,
            "guaranteedDailyIncome": round(guaranteed_daily_income, 2),
            "guaranteedAnnualIncome": round(guaranteed_annual_income, 2),
            "estimatedAnnualIncome": estimated_annual_income,
            "estimatedDailyIncome": estimated_daily_income,
            "assetCount": len(assets),
            "stockAccount": stock_account,
            "wealthAccount": wealth_account,
            "dividendDimension": dividend_dimension,
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
    raw_c = code.strip().upper()
    if not raw_c:
        raise HTTPException(status_code=400, detail="请输入代码")

    c = AKShareClient.resolve_symbol(raw_c)

    category = "STOCK"
    fund_type = None
    name = None
    current_price = None
    dividend_yield = None

    if len(c) == 6 and c.isdigit():
        prefix2 = c[:2]
        # 1. 场内 ETF / LOF 基金: 51, 52, 56, 58, 15, 16, 50
        if prefix2 in ("51", "52", "56", "58", "15", "16", "50"):
            category = "FUND"
            fund_type = "EXCHANGE"
            quotes = _batch_tencent_quote([c])
            quote = quotes.get(c)
            if quote:
                name = quote.get("name")
                current_price = quote.get("price")
                dividend_yield = quote.get("dividendYield")

        # 2. 明确的 A 股主板/科创/创业/北交股票: 60, 68, 30, 43, 83, 87, 88, 92
        elif prefix2 in ("60", "68", "30", "43", "83", "87", "88", "92"):
            category = "STOCK"
            fund_type = None
            quotes = _batch_tencent_quote([c])
            quote = quotes.get(c)
            if quote:
                name = quote.get("name")
                current_price = quote.get("price")
                dividend_yield = quote.get("dividendYield")

        # 3. 00 开头等既可能是深市股票也可能是场外公募基金的代码
        else:
            nav = get_otc_fund_nav(c)
            if nav and nav.get("fundName"):
                category = "FUND"
                fund_type = "OTC"
                name = nav.get("fundName")
                current_price = nav.get("navPrice")
            else:
                category = "STOCK"
                fund_type = None
                quotes = _batch_tencent_quote([c])
                quote = quotes.get(c)
                if quote:
                    name = quote.get("name")
                    current_price = quote.get("price")
                    dividend_yield = quote.get("dividendYield")
    else:
        # 4. 美股或港股股票
        category = "STOCK"
        fund_type = None
        quotes = _batch_tencent_quote([c])
        quote = quotes.get(c)
        if quote:
            name = quote.get("name")
            current_price = quote.get("price")
            dividend_yield = quote.get("dividendYield")

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


class BatchAssetPayload(BaseModel):
    items: List[AssetPayload]
    source: Optional[str] = "AI_OCR"
    description: Optional[str] = "AI 识别批量录入"


@router.post("/batch")
def batch_add_assets(
    payload: BatchAssetPayload,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    user_id = current_user["id"]
    for item in payload.items:
        _validate_payload(item)
    
    storage_items = [item.to_storage_dict() for item in payload.items]
    ids = storage_db.batch_add_assets(
        user_id=user_id,
        items=storage_items,
        source=payload.source or "AI_OCR",
        description=payload.description or "AI 批量录入",
    )
    return {"status": "ok", "ids": ids, "count": len(ids)}


class BatchDeletePayload(BaseModel):
    ids: List[int]
    source: Optional[str] = "ROLLBACK"


@router.post("/batch-delete")
def batch_delete_assets(
    payload: BatchDeletePayload,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    user_id = current_user["id"]
    ok = storage_db.batch_delete_assets(user_id, payload.ids, source=payload.source or "ROLLBACK")
    return {"status": "ok", "success": ok}


@router.get("/audit-logs")
def get_audit_logs(
    limit: int = 50,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    user_id = current_user["id"]
    return storage_db.get_asset_audit_logs(user_id, limit=limit)


@router.post("/audit-logs/{log_id}/rollback")
def rollback_audit_log(
    log_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    user_id = current_user["id"]
    res = storage_db.rollback_asset_action(user_id, log_id)
    if res.get("status") == "error":
        raise HTTPException(status_code=400, detail=res.get("message", "回滚失败"))
    return res
