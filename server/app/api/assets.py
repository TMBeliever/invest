import logging
import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.services.auth import get_current_user

from app.data.akshare_client import _batch_tencent_quote, get_otc_fund_nav, _clean_code, AKShareClient
from app.data.market_calendar import is_trade_day, get_market_status, get_live_fx_rates
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


def _is_etf_code(code: Optional[str]) -> bool:
    """判断是否为场内上市的 ETF / LOF 代码"""
    clean = _clean_code(str(code or ""))
    if clean and len(clean) == 6 and clean.isdigit():
        # 沪深交易所场内上市 ETF / LOF 代码前缀: 51, 15, 56, 58, 16, 52, 50, 18
        return clean[:2] in ("51", "15", "56", "58", "16", "52", "50", "18")
    return False


def _enrich_assets(raw_assets: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    按类别与维度自动高精度算账：
    - 交易日历与时钟感知：支持交易日、休市日判定，休市日股票今日盈亏精准为 0，保留昨日收盘供参考
    - 场内证券 (STOCK / 场内 ETF)：实时行情撮合，支持美元/港币汇率换算，自动推导空份额
    - 场外基金 (FUND OTC)：采用东财官方净值接口真实日增长率，按精准差价公式计算单日收益
    - 存款与理财 (DEPOSIT / WEALTH)：起止日期生命周期校验，到期自动停息，365天持续计提
    - 股息维度：支持股票及场内红利 ETF 股息率计算与年化预估
    """
    today_dt = datetime.date.today()
    is_trading = is_trade_day(today_dt)
    fx_rates = get_live_fx_rates()

    def _is_exchange_traded(a: Dict[str, Any]) -> bool:
        cat = a.get("category")
        if cat == "STOCK":
            return True
        if cat == "FUND":
            # 若代码为场内 ETF 前缀或显式标记 EXCHANGE，则认定为场内
            if _is_etf_code(a.get("code")) or a.get("fund_type") == "EXCHANGE":
                return True
        return False

    quote_codes = [a["code"] for a in raw_assets if _is_exchange_traded(a) and a.get("code")]
    quotes = _batch_tencent_quote(quote_codes) if quote_codes else {}

    enriched = []
    for a in raw_assets:
        category = a["category"]
        raw_code = a.get("code")
        clean_code = _clean_code(raw_code) if raw_code else None
        item: Dict[str, Any] = {
            "id": a["id"],
            "category": category,
            "name": a["name"],
            "code": raw_code,
            "notes": a.get("notes"),
        }

        if _is_exchange_traded(a):
            quote = quotes.get(raw_code) or (quotes.get(clean_code) if clean_code else None)

            # 若为基金且场内行情未查到，自动兜底尝试场外基金净值接口
            nav_fallback = None
            if quote is None and category == "FUND" and clean_code:
                nav_fallback = get_otc_fund_nav(clean_code)
                if nav_fallback and nav_fallback.get("navPrice"):
                    quote = {
                        "price": nav_fallback["navPrice"],
                        "prevClose": nav_fallback.get("prevClose") or nav_fallback["navPrice"],
                        "change": nav_fallback.get("change") or 0.0,
                        "changePct": nav_fallback.get("changePct") or 0.0,
                        "dividendYield": None,
                    }

            raw_shares = a.get("shares")
            raw_amount = a.get("amount")
            cost_price = float(a.get("cost_price") or 0.0)
            current_price = float(quote["price"]) if quote and quote.get("price") else cost_price
            prev_close = float(quote.get("prevClose") or current_price) if quote else cost_price
            change = float(quote.get("change") or 0.0) if quote else 0.0
            change_pct = float(quote.get("changePct") or 0.0) if quote else 0.0

            # 智能份额补齐：若份额为空但有金额，自动按现价/成本价折算
            if raw_shares is not None and float(raw_shares) > 0:
                shares = float(raw_shares)
            elif raw_amount is not None and float(raw_amount) > 0:
                shares = round(float(raw_amount) / (cost_price if cost_price > 0 else (current_price if current_price > 0 else 1.0)), 4)
                if cost_price == 0.0 and current_price > 0:
                    cost_price = current_price
            else:
                shares = 0.0

            # 多币种汇率折算
            currency = "CNY"
            if clean_code:
                if clean_code.upper().startswith("US") or (clean_code.isalpha() and len(clean_code) <= 5):
                    currency = "USD"
                elif clean_code.startswith("HK") or len(clean_code) == 5:
                    currency = "HKD"

            fx = fx_rates.get(currency, 1.0)

            current_value = round(shares * current_price * fx, 2)
            cost_value = round(shares * cost_price * fx, 4)
            profit = round(current_value - cost_value, 2)
            profit_pct = round((profit / cost_value * 100), 2) if cost_value > 0 else 0.0

            # 单日价格变动
            single_day_profit = round(change * shares * fx, 2) if change else 0.0
            # 交易日按真实实时变动，休市日 (周末/节假日) 今日变动精准归零，同时保留 lastTradingProfit
            daily_profit = single_day_profit if is_trading else 0.0
            daily_profit_pct = round(change_pct, 2) if is_trading else 0.0

            dividend_yield = quote.get("dividendYield") if quote else None
            # 股息单独立项：支持股票及场内红利 ETF 预估年分红与日均参考
            estimated_dividend_annual = round(current_value * dividend_yield / 100, 2) if dividend_yield else 0.0
            estimated_dividend_daily = round(estimated_dividend_annual / 365.0, 2) if estimated_dividend_annual > 0 else 0.0

            cost_dividend_yield = round(estimated_dividend_annual / cost_value * 100, 2) if (
                cost_value > 0 and estimated_dividend_annual > 0
            ) else dividend_yield

            item.update({
                "accountType": "STOCK_ACCOUNT",  # 场内交易账户维度
                "fundType": "EXCHANGE" if category == "FUND" else None,
                "currency": currency,
                "fxRate": fx,
                "shares": shares,
                "costPrice": cost_price,
                "currentPrice": current_price,
                "prevClose": prev_close,
                "currentValue": current_value,
                "dailyProfit": daily_profit,
                "dailyProfitPct": daily_profit_pct,
                "lastTradingProfit": single_day_profit,
                "lastTradingProfitPct": round(change_pct, 2),
                "dailyIncome": estimated_dividend_daily,
                "profit": profit,
                "profitPct": profit_pct,
                "dividendYield": dividend_yield,
                "costDividendYield": cost_dividend_yield,
                "estimatedDividendAnnual": estimated_dividend_annual,
                "estimatedDividendDaily": estimated_dividend_daily,
                "annualIncome": estimated_dividend_annual,
                "dataStale": quote is None,
                "priceAsOf": "REALTIME" if quote and not nav_fallback else "PREV_CLOSE_NAV",
                "navDate": nav_fallback.get("navDate") if nav_fallback else None,
            })

        elif category == "FUND":  # 场外基金 (FUND OTC)
            nav = get_otc_fund_nav(clean_code) if clean_code else None

            raw_shares = a.get("shares")
            raw_amount = a.get("amount")
            cost_price = float(a.get("cost_price") or 0.0)
            current_price = float(nav["navPrice"]) if nav and nav.get("navPrice") else cost_price
            prev_close = float(nav.get("prevClose") or current_price) if nav else cost_price
            change = float(nav.get("change") or 0.0) if nav else 0.0
            change_pct = float(nav.get("changePct") or 0.0) if nav else 0.0

            if raw_shares is not None and float(raw_shares) > 0:
                shares = float(raw_shares)
            elif raw_amount is not None and float(raw_amount) > 0:
                shares = round(float(raw_amount) / (cost_price if cost_price > 0 else (current_price if current_price > 0 else 1.0)), 4)
                if cost_price == 0.0 and current_price > 0:
                    cost_price = current_price
            else:
                shares = 0.0

            current_value = round(shares * current_price, 2)
            cost_value = round(shares * cost_price, 4)
            profit = round(current_value - cost_value, 2)
            profit_pct = round((profit / cost_value * 100), 2) if cost_value > 0 else 0.0

            # 场外基金今日变动金额 = 持仓份额 * (最新净值 - 上期净值)
            single_day_profit = round(shares * change, 2) if change else 0.0
            daily_profit = single_day_profit if is_trading else 0.0
            daily_profit_pct = round(change_pct, 2) if is_trading else 0.0

            item.update({
                "accountType": "WEALTH_ACCOUNT",  # 理财账户维度 (场外基金)
                "fundType": "OTC",
                "currency": "CNY",
                "shares": shares,
                "costPrice": cost_price,
                "currentPrice": current_price,
                "prevClose": prev_close,
                "currentValue": current_value,
                "dailyProfit": daily_profit,
                "dailyProfitPct": daily_profit_pct,
                "lastTradingProfit": single_day_profit,
                "lastTradingProfitPct": round(change_pct, 2),
                "dailyIncome": 0.0,
                "profit": profit,
                "profitPct": profit_pct,
                "dividendYield": None,
                "estimatedDividendAnnual": 0.0,
                "estimatedDividendDaily": 0.0,
                "annualIncome": 0.0,
                "dataStale": nav is None,
                "priceAsOf": "PREV_CLOSE_NAV",
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
            maturity_date_str = a.get("maturity_date")

            # 生命周期与起止日期有效性校验
            is_active = True
            deposit_status = "ACTIVE"
            start_dt = None
            maturity_dt = None

            if start_date_str:
                try:
                    start_dt = datetime.datetime.strptime(str(start_date_str).strip(), "%Y-%m-%d").date()
                    if today_dt < start_dt:
                        is_active = False
                        deposit_status = "PENDING"
                except Exception:
                    pass

            if maturity_date_str:
                try:
                    maturity_dt = datetime.datetime.strptime(str(maturity_date_str).strip(), "%Y-%m-%d").date()
                    if today_dt > maturity_dt:
                        is_active = False
                        deposit_status = "MATURED"
                except Exception:
                    pass

            # 确定性利息计算 (有效期内每天正常计提，365天不间断)
            if is_active:
                annual_income = round(amount * (annual_rate / 100.0), 2)
                daily_income = round(amount * (annual_rate / 100.0) / 365.0, 2)
            else:
                annual_income = 0.0
                daily_income = 0.0

            # 计算累计计息天数与已产生利息
            days_held = None
            accrued_interest = None
            if start_dt and today_dt >= start_dt:
                end_dt = min(today_dt, maturity_dt) if maturity_dt else today_dt
                days_held = max(0, (end_dt - start_dt).days)
                accrued_interest = round(amount * (annual_rate / 100.0) * (days_held / 365.0), 2)

            payout_method = a.get("payout_method") or "MATURITY"

            item.update({
                "accountType": "WEALTH_ACCOUNT",
                "amount": amount,
                "annualRate": annual_rate,
                "depositType": a.get("deposit_type"),
                "startDate": start_date_str,
                "maturityDate": maturity_date_str,
                "depositStatus": deposit_status,
                "isActive": is_active,
                "payoutMethod": payout_method,
                "daysHeld": days_held,
                "accruedInterest": accrued_interest,
                "currentValue": round(amount, 2),
                "dailyProfit": daily_income,
                "dailyProfitPct": round((annual_rate / 365.0), 4) if annual_rate and is_active else 0.0,
                "lastTradingProfit": daily_income,
                "lastTradingProfitPct": round((annual_rate / 365.0), 4) if annual_rate and is_active else 0.0,
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
                "lastTradingProfit": 0.0,
                "lastTradingProfitPct": 0.0,
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

    market_status = get_market_status()
    is_trading = market_status["isTradingDay"]

    total_value = sum(a["currentValue"] for a in assets)

    # 1. 场内交易账户维度 (股票 + 场内ETF)
    stock_assets = [a for a in assets if a.get("accountType") == "STOCK_ACCOUNT"]
    stock_val = sum(a["currentValue"] for a in stock_assets)
    stock_daily_profit = sum(a.get("dailyProfit", 0) or 0 for a in stock_assets)
    stock_last_trading_profit = sum(a.get("lastTradingProfit", 0) or 0 for a in stock_assets)

    pure_stock_daily_profit = sum(a.get("dailyProfit", 0) or 0 for a in stock_assets if a["category"] == "STOCK")
    etf_daily_profit = sum(a.get("dailyProfit", 0) or 0 for a in stock_assets if a["category"] == "FUND")

    pure_stock_last_profit = sum(a.get("lastTradingProfit", 0) or 0 for a in stock_assets if a["category"] == "STOCK")
    etf_last_profit = sum(a.get("lastTradingProfit", 0) or 0 for a in stock_assets if a["category"] == "FUND")

    stock_prev_val = sum(
        (a.get("prevClose") if a.get("prevClose") is not None else a.get("currentPrice", 0)) * (a.get("shares", 0) or 0) * (a.get("fxRate", 1.0))
        for a in stock_assets
    )
    stock_daily_profit_pct = round((stock_daily_profit / stock_prev_val * 100), 2) if (is_trading and stock_prev_val > 0) else 0.0
    stock_cost = sum((a.get("shares", 0) or 0) * (a.get("costPrice", 0) or 0) * (a.get("fxRate", 1.0)) for a in stock_assets)
    stock_total_profit = sum(a.get("profit", 0) or 0 for a in stock_assets)
    stock_total_profit_pct = round((stock_total_profit / stock_cost * 100), 2) if stock_cost > 0 else 0.0

    stock_account = {
        "totalValue": round(stock_val, 2),
        "dailyProfit": round(stock_daily_profit, 2),
        "dailyProfitPct": stock_daily_profit_pct,
        "lastTradingProfit": round(stock_last_trading_profit, 2),
        "pureStockDailyProfit": round(pure_stock_daily_profit, 2),
        "etfDailyProfit": round(etf_daily_profit, 2),
        "pureStockLastProfit": round(pure_stock_last_profit, 2),
        "etfLastProfit": round(etf_last_profit, 2),
        "totalProfit": round(stock_total_profit, 2),
        "totalProfitPct": stock_total_profit_pct,
        "count": len(stock_assets),
        "stockCount": len([a for a in stock_assets if a["category"] == "STOCK"]),
        "etfCount": len([a for a in stock_assets if a["category"] == "FUND"]),
    }

    # 2. 理财账户维度 (稳健存款 + 理财 + 场外基金)
    wealth_assets = [a for a in assets if a.get("accountType") == "WEALTH_ACCOUNT"]
    wealth_val = sum(a["currentValue"] for a in wealth_assets)
    # 确定性每日生息 = 存款日息 + 理财日收益 (365天持续)
    guaranteed_daily_income = sum(
        a.get("dailyIncome", 0) or 0 for a in wealth_assets if a["category"] in ("DEPOSIT", "WEALTH")
    )
    guaranteed_annual_income = sum(
        a.get("annualIncome", 0) or 0 for a in wealth_assets if a["category"] in ("DEPOSIT", "WEALTH")
    )
    otc_daily_profit = sum(
        a.get("dailyProfit", 0) or 0 for a in wealth_assets if a["category"] == "FUND"
    )
    otc_last_trading_profit = sum(
        a.get("lastTradingProfit", 0) or 0 for a in wealth_assets if a["category"] == "FUND"
    )

    wealth_account = {
        "totalValue": round(wealth_val, 2),
        "guaranteedDailyIncome": round(guaranteed_daily_income, 2),
        "guaranteedAnnualIncome": round(guaranteed_annual_income, 2),
        "otcDailyProfit": round(otc_daily_profit, 2),
        "otcLastTradingProfit": round(otc_last_trading_profit, 2),
        "totalDailyIncome": round(guaranteed_daily_income + otc_daily_profit, 2),
        "count": len(wealth_assets),
        "depositCount": len([a for a in wealth_assets if a["category"] == "DEPOSIT"]),
        "otcFundCount": len([a for a in wealth_assets if a["category"] == "FUND"]),
        "wealthCount": len([a for a in wealth_assets if a["category"] == "WEALTH"]),
    }

    # 3. 股息单独维度 (上市公司 + 场内红利 ETF 预估分红)
    dividend_assets = [a for a in assets if (a.get("dividendYield") or 0) > 0]
    estimated_annual_dividend = sum(a.get("estimatedDividendAnnual", 0) or 0 for a in dividend_assets)
    estimated_daily_dividend = round(estimated_annual_dividend / 365.0, 2)
    div_asset_val = sum(a["currentValue"] for a in dividend_assets)
    avg_dividend_yield = round((estimated_annual_dividend / div_asset_val * 100), 2) if div_asset_val > 0 else 0.0

    dividend_dimension = {
        "estimatedAnnualDividend": round(estimated_annual_dividend, 2),
        "estimatedDailyDividend": estimated_daily_dividend,
        "avgDividendYield": avg_dividend_yield,
        "hasDividendAssetsCount": len(dividend_assets),
    }

    # 4. 全局总览汇总
    # 今日综合收益 = 场内今日盈亏 (股票+ETF) + 确定性日利息 + 场外基金今日变动
    today_profit = round(stock_daily_profit + guaranteed_daily_income + otc_daily_profit, 2)
    today_prev_val = total_value - today_profit
    today_profit_pct = round((today_profit / today_prev_val * 100), 2) if today_prev_val > 0 else 0.0

    total_cost = sum(
        (a.get("shares", 0) or 0) * (a.get("costPrice", 0) or 0) * (a.get("fxRate", 1.0))
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
            "marketStatus": market_status,
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
