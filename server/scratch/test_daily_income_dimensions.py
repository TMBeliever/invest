import sys
import os

# Add server directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.assets import _enrich_assets

def test_daily_income_and_dimensions():
    sample_assets = [
        # 1. 股票: 招商银行 (股票账户)
        {
            "id": 1,
            "category": "STOCK",
            "name": "招商银行",
            "code": "600036",
            "shares": 1000,
            "cost_price": 30.0,
            "notes": "股票账户核心持仓",
        },
        # 2. 场内 ETF: 红利ETF (股票账户)
        {
            "id": 2,
            "category": "FUND",
            "fund_type": "EXCHANGE",
            "name": "华泰柏瑞红利ETF",
            "code": "510880",
            "shares": 10000,
            "cost_price": 2.8,
            "notes": "场内ETF",
        },
        # 3. 银行存款: 定期存款 (理财账户 - 确定性生息)
        {
            "id": 3,
            "category": "DEPOSIT",
            "name": "招行3年期大额存单",
            "amount": 300000.0,
            "annual_rate": 2.6,
            "deposit_type": "FIXED",
            "start_date": "2024-01-01",
            "maturity_date": "2027-01-01",
            "notes": "稳健定存",
        },
        # 4. 银行理财: 稳健理财 (理财账户 - 确定性生息)
        {
            "id": 4,
            "category": "WEALTH",
            "name": "工银理财添利90天",
            "amount": 200000.0,
            "annual_rate": 3.1,
            "notes": "稳健理财",
        },
        # 5. 场外基金: 易方达蓝筹 (理财账户 - 场外)
        {
            "id": 5,
            "category": "FUND",
            "fund_type": "OTC",
            "name": "易方达蓝筹精选",
            "code": "005827",
            "shares": 5000,
            "cost_price": 1.8,
            "notes": "场外基金",
        },
    ]

    enriched = _enrich_assets(sample_assets)
    print("\n=== ENRICHED ASSETS ===")
    for a in enriched:
        print(f"[{a['category']}-{a.get('accountType')}] {a['name']}:")
        print(f"  市值: ¥{a['currentValue']}, 今日收益/盈亏: ¥{a.get('dailyProfit')}, 涨跌幅: {a.get('dailyProfitPct')}%")
        print(f"  日收益/息: ¥{a.get('dailyIncome')}, 年利息/分红: ¥{a.get('annualIncome')}")
        if a.get('estimatedDividendAnnual'):
            print(f"  预估年分红: ¥{a.get('estimatedDividendAnnual')}, 参考日分红: ¥{a.get('estimatedDividendDaily')}")

    # 验证维度聚合
    stock_assets = [a for a in enriched if a.get("accountType") == "STOCK_ACCOUNT"]
    wealth_assets = [a for a in enriched if a.get("accountType") == "WEALTH_ACCOUNT"]
    
    assert len(stock_assets) == 2, f"Expected 2 stock account assets, got {len(stock_assets)}"
    assert len(wealth_assets) == 3, f"Expected 3 wealth account assets, got {len(wealth_assets)}"

    # 验证确定性利息计算: 存款 (300000 * 2.6% / 365 = 21.37) + 理财 (200000 * 3.1% / 365 = 16.99) = 38.36
    dep = next(a for a in enriched if a["id"] == 3)
    wlth = next(a for a in enriched if a["id"] == 4)
    expected_dep_daily = round(300000.0 * 0.026 / 365.0, 2)
    expected_wlth_daily = round(200000.0 * 0.031 / 365.0, 2)

    assert dep["dailyIncome"] == expected_dep_daily, f"Expected {expected_dep_daily}, got {dep['dailyIncome']}"
    assert wlth["dailyIncome"] == expected_wlth_daily, f"Expected {expected_wlth_daily}, got {wlth['dailyIncome']}"

    total_guaranteed_daily = sum(a["dailyIncome"] for a in wealth_assets if a["category"] in ("DEPOSIT", "WEALTH"))
    print(f"\n✅ 确定性预估每日生息 (存款+理财): ¥{total_guaranteed_daily:.2f} / 天 (每天实打实进账)")
    print(f"✅ 确定性预估年利息 (存款+理财): ¥{sum(a['annualIncome'] for a in wealth_assets if a['category'] in ('DEPOSIT', 'WEALTH')):.2f} / 年")

    stock_daily = sum(a["dailyProfit"] for a in stock_assets)
    print(f"✅ 股票账户今日盈亏波动: ¥{stock_daily:.2f}")

    dividend_stocks = [a for a in enriched if a["category"] == "STOCK" and (a.get("dividendYield") or 0) > 0]
    total_est_div = sum(a.get("estimatedDividendAnnual", 0) for a in dividend_stocks)
    print(f"✅ 预估股票年分红 (单独维度·浮动): ¥{total_est_div:.2f} / 年 (参考日均: ¥{total_est_div/365:.2f}/天)")

    print("\n🎉 All Dimension and Daily Return assertions passed successfully!")

if __name__ == "__main__":
    test_daily_income_and_dimensions()
