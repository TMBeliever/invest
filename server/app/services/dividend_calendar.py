import datetime
import logging
import requests
from typing import List, Dict, Any, Optional
from app.data.storage import storage_db
from app.data.akshare_client import _batch_tencent_quote, _clean_code

logger = logging.getLogger(__name__)

# ETF 前缀（场内基金默认不计入固定现金流，除非特殊公告）
ETF_PREFIXES = ("51", "15", "56", "58", "16", "52", "50", "18")


def _get_eastmoney_dividend_history(code: str) -> List[Dict[str, Any]]:
    """从东财接口拉取单只 A 股近 6 次真实历史分红实施公告与除权除息日"""
    clean = _clean_code(code)
    url = f"https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_SHAREBONUS_DET&columns=ALL&filter=(SECURITY_CODE%3D%22{clean}%22)&sortColumns=EX_DIVIDEND_DATE&sortTypes=-1&pageSize=6"
    try:
        resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=3)
        if resp.status_code == 200:
            res_json = resp.json()
            return res_json.get("result", {}).get("data", []) or []
    except Exception as e:
        logger.warning(f"[DividendCalendar] 拉取 {code} 分红历史异常: {e}")
    return []


class DividendCalendarService:
    """
    真·被动现金流预测日历推演服务 (Real Passive Cashflow Engine)：
    - 仅统计【真正产生现金落袋】的资产：A股/港股个股现金分红、定期存款/大额存单到期利息
    - 坚决剔除【净值累积型】场外公募基金与无现金分红 ETF（避免假分红误导）
    - 穿透调取上市公司官方已披露分红实施公告与过去 3 年同季真实派息周期
    - 精确映射到未来 12 个月的具体年月日与每 10 股派现金额
    """

    def generate_calendar(self, user_id: str, monthly_living_expense: float = 8000.0) -> Dict[str, Any]:
        raw_assets = storage_db.get_all_assets(user_id)
        now = datetime.datetime.now()
        today_date = now.date()

        # 生成未来 12 个月月份标签列表 (例如 ["2026-08", "2026-09", ..., "2027-07"])
        months_list: List[str] = []
        cur_year = now.year
        cur_month = now.month
        for i in range(12):
            m_year = cur_year + (cur_month - 1 + i) // 12
            m_month = (cur_month - 1 + i) % 12 + 1
            months_list.append(f"{m_year:04d}-{m_month:02d}")

        # 月度聚合桶
        monthly_buckets: Dict[str, Dict[str, Any]] = {
            m: {
                "month": m,
                "stockDividends": 0.0,
                "depositInterest": 0.0,
                "totalCashflow": 0.0,
                "events": []
            }
            for m in months_list
        }

        # ─── 1. 归集持仓真实个股（排除公募基金与ETF） ───────────────────
        stock_holdings: Dict[str, Dict[str, Any]] = {}
        for a in raw_assets:
            if a.get("category") == "STOCK" and a.get("code"):
                code = str(a["code"]).strip()
                clean_c = _clean_code(code)
                # 过滤掉 ETF，仅保留纯个股
                if clean_c.startswith(ETF_PREFIXES):
                    continue
                name = a.get("name") or code
                shares = float(a.get("shares") or 0.0)
                amount = float(a.get("amount") or 0.0)

                if clean_c not in stock_holdings:
                    stock_holdings[clean_c] = {
                        "code": clean_c,
                        "name": name,
                        "shares": 0.0,
                        "amount": 0.0,
                    }
                stock_holdings[clean_c]["shares"] += shares
                stock_holdings[clean_c]["amount"] += amount

        # 批量补充个股实时股价与股数修正
        if stock_holdings:
            quotes = _batch_tencent_quote(list(stock_holdings.keys()))
            for c, h in stock_holdings.items():
                q = quotes.get(c)
                price = float(q["price"]) if q and q.get("price") else 1.0
                if h["shares"] <= 0 and h["amount"] > 0 and price > 0:
                    h["shares"] = round(h["amount"] / price, 2)

        all_events: List[Dict[str, Any]] = []
        source_contributions: Dict[str, float] = {}

        # ─── 2. 真实上市公司分红推演 ──────────────────────────────────
        for code, stock in stock_holdings.items():
            name = stock["name"]
            shares = stock["shares"]
            if shares <= 0:
                continue

            div_records = _get_eastmoney_dividend_history(code)
            if not div_records:
                continue

            # 提取该股票的历史派息节奏（按季度/月份提取最近 1~2 次典型分红）
            # 区分年度分红（通常 5~7 月）与中期/三季报分红（通常 9~11 月或 1 月）
            seen_seasons = set()
            for rec in div_records:
                ex_date_str = rec.get("EX_DIVIDEND_DATE")
                pretax_dps = rec.get("PRETAX_BONUS_RMB")
                if not ex_date_str or pretax_dps is None:
                    continue

                try:
                    dps = float(pretax_dps)
                    if dps <= 0:
                        continue

                    ex_dt = datetime.datetime.strptime(ex_date_str[:10], "%Y-%m-%d").date()
                    hist_month = ex_dt.month
                    hist_day = ex_dt.day

                    # 判定分红季节类型（避免重复统计同一次分红）
                    season_key = "ANNUAL" if hist_month in (5, 6, 7, 8) else "INTERIM"
                    if season_key in seen_seasons:
                        continue
                    seen_seasons.add(season_key)

                    # 映射至未来 12 个月时间轴
                    # 计算下一次对应派息月份
                    proj_year = cur_year if hist_month >= cur_month else cur_year + 1
                    target_month_str = f"{proj_year:04d}-{hist_month:02d}"

                    if target_month_str not in monthly_buckets:
                        continue

                    proj_date_str = f"{target_month_str}-{hist_day:02d}"
                    div_amount = round(shares * (dps / 10.0), 2)
                    if div_amount <= 0:
                        continue

                    scheme_desc = rec.get("IMPL_PLAN_PROFILE") or rec.get("PLAN_EXPLAIN") or f"10派{dps:.2f}元"
                    is_recent = (ex_dt >= today_date)

                    status = "CONFIRMED" if is_recent else "HISTORICAL_PROJECTION"
                    status_label = "已公告派息" if is_recent else "历史同季预估"

                    event = {
                        "id": f"evt-div-{code}-{target_month_str}",
                        "month": target_month_str,
                        "date": proj_date_str,
                        "assetType": "STOCK_DIVIDEND",
                        "symbol": code,
                        "name": name,
                        "amount": div_amount,
                        "shares": round(shares, 2),
                        "dpsPer10": dps,
                        "description": f"{name} {scheme_desc} (持仓 {int(shares):,} 股，预估到手 ¥{div_amount:,.2f})",
                        "status": status,
                        "statusLabel": status_label,
                    }

                    all_events.append(event)
                    monthly_buckets[target_month_str]["events"].append(event)
                    monthly_buckets[target_month_str]["stockDividends"] += div_amount
                    monthly_buckets[target_month_str]["totalCashflow"] += div_amount

                    source_contributions[name] = source_contributions.get(name, 0.0) + div_amount

                except Exception as e:
                    logger.debug(f"解析 {code} 分红记录出错: {e}")

        # ─── 3. 真实定期存款与理财利息（支持到期/按月/按季/按年派息） ──────
        fixed_assets = [
            a for a in raw_assets
            if a.get("category") in ("DEPOSIT", "WEALTH") or a.get("deposit_type") or a.get("annual_rate")
        ]

        for asset in fixed_assets:
            name = asset.get("name") or "定期存款/理财"
            principal = float(asset.get("amount") or 0.0)
            rate = float(asset.get("annual_rate") or asset.get("rate") or 0.0)
            mat_str = asset.get("maturity_date")
            payout_mode = str(asset.get("payout_method") or "MATURITY").upper()

            if principal <= 0 or rate <= 0:
                continue

            annual_interest = round(principal * (rate / 100.0), 2)
            source_contributions[name] = source_contributions.get(name, 0.0) + annual_interest

            # 解析到期日
            mat_dt = None
            if mat_str:
                try:
                    mat_dt = datetime.datetime.strptime(str(mat_str).strip()[:10], "%Y-%m-%d").date()
                except Exception:
                    pass

            # 场景 A: 按月派息 (MONTHLY)
            if payout_mode == "MONTHLY":
                monthly_payout = round(annual_interest / 12.0, 2)
                for m in months_list:
                    event = {
                        "id": f"evt-dep-{asset.get('id', 'dep')}-{m}",
                        "month": m,
                        "date": f"{m}-15",
                        "assetType": "DEPOSIT_INTEREST",
                        "symbol": None,
                        "name": name,
                        "amount": monthly_payout,
                        "principal": principal,
                        "interestRate": rate,
                        "description": f"{name} 月度利息到账 (本金 ¥{principal:,.0f}，年化 {rate}%，月息 ¥{monthly_payout:,.2f})",
                        "status": "CONTRACTUAL",
                        "statusLabel": "按月结息",
                    }
                    all_events.append(event)
                    monthly_buckets[m]["events"].append(event)
                    monthly_buckets[m]["depositInterest"] += monthly_payout
                    monthly_buckets[m]["totalCashflow"] += monthly_payout

            # 场景 B: 按季派息 (QUARTERLY)
            elif payout_mode == "QUARTERLY":
                quarterly_payout = round(annual_interest / 4.0, 2)
                for idx, m in enumerate(months_list):
                    if (idx + 1) % 3 == 0:
                        event = {
                            "id": f"evt-dep-{asset.get('id', 'dep')}-{m}",
                            "month": m,
                            "date": f"{m}-20",
                            "assetType": "DEPOSIT_INTEREST",
                            "symbol": None,
                            "name": name,
                            "amount": quarterly_payout,
                            "principal": principal,
                            "interestRate": rate,
                            "description": f"{name} 季度利息结息 (本金 ¥{principal:,.0f}，年化 {rate}%，季息 ¥{quarterly_payout:,.2f})",
                            "status": "CONTRACTUAL",
                            "statusLabel": "按季结息",
                        }
                        all_events.append(event)
                        monthly_buckets[m]["events"].append(event)
                        monthly_buckets[m]["depositInterest"] += quarterly_payout
                        monthly_buckets[m]["totalCashflow"] += quarterly_payout

            # 场景 C: 到期一次性付息还本 (MATURITY / ANNUAL)
            else:
                if mat_dt and mat_dt >= today_date:
                    mat_month = mat_dt.strftime("%Y-%m")
                    if mat_month in monthly_buckets:
                        event = {
                            "id": f"evt-dep-{asset.get('id', 'dep')}-{mat_month}",
                            "month": mat_month,
                            "date": str(mat_dt),
                            "assetType": "DEPOSIT_INTEREST",
                            "symbol": None,
                            "name": name,
                            "amount": annual_interest,
                            "principal": principal,
                            "interestRate": rate,
                            "description": f"{name} 到期还本结息 (本金 ¥{principal:,.0f}，年化 {rate}%，利息 ¥{annual_interest:,.2f})",
                            "status": "CONTRACTUAL",
                            "statusLabel": "合同到期结息",
                        }
                        all_events.append(event)
                        monthly_buckets[mat_month]["events"].append(event)
                        monthly_buckets[mat_month]["depositInterest"] += annual_interest
                        monthly_buckets[mat_month]["totalCashflow"] += annual_interest

                        source_contributions[name] = source_contributions.get(name, 0.0) + annual_interest

        # ─── 4. 统计汇总与财务自由覆盖度 ──────────────────────────────
        monthly_series = []
        total_annual_cashflow = 0.0
        for m in months_list:
            b = monthly_buckets[m]
            b["stockDividends"] = round(b["stockDividends"], 2)
            b["depositInterest"] = round(b["depositInterest"], 2)
            b["totalCashflow"] = round(b["totalCashflow"], 2)
            total_annual_cashflow += b["totalCashflow"]
            monthly_series.append(b)

        total_annual_cashflow = round(total_annual_cashflow, 2)
        monthly_avg = round(total_annual_cashflow / 12.0, 2)
        daily_avg = round(total_annual_cashflow / 365.0, 2)

        safe_expense = max(100.0, monthly_living_expense)
        freedom_coverage = round((monthly_avg / safe_expense) * 100.0, 1)

        top_sources = sorted(
            [{"name": k, "annualAmount": round(v, 2), "ratio": round((v / total_annual_cashflow) * 100, 1) if total_annual_cashflow > 0 else 0}
             for k, v in source_contributions.items()],
            key=lambda x: x["annualAmount"],
            reverse=True
        )[:5]

        all_events.sort(key=lambda x: x["date"])

        return {
            "summary": {
                "totalAnnualCashflow": total_annual_cashflow,
                "monthlyAverageCashflow": monthly_avg,
                "dailyAverageCashflow": daily_avg,
                "monthlyLivingExpenseTarget": safe_expense,
                "financialFreedomCoveragePct": freedom_coverage,
                "totalEventsCount": len(all_events),
                "activeEquityCount": len(stock_holdings),
            },
            "monthlySeries": monthly_series,
            "timelineEvents": all_events,
            "topSources": top_sources,
            "generatedAt": now.strftime("%Y-%m-%d %H:%M:%S")
        }


dividend_calendar_service = DividendCalendarService()
