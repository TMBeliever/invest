import sys
import os
import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.assets import _enrich_assets, get_assets_summary
from app.data.market_calendar import is_trade_day, get_market_status, get_live_fx_rates

def test_full_accuracy():
    print("=== 1. 验证实时汇率与交易日历 ===")
    fx = get_live_fx_rates()
    print("实时汇率:", fx)
    assert fx["USD"] > 5.0 and fx["HKD"] > 0.5, "汇率获取异常"

    market_status = get_market_status()
    print("市场状态:", market_status)
    assert "isTradingDay" in market_status, "市场状态缺少 isTradingDay"

    print("\n=== 2. 验证多品类测试资产核算精度 ===")
    test_assets = [
        # 1. 场内 ETF (代码512890，未填份额，只填金额 11001元)
        {
            "id": 101,
            "category": "FUND",
            "name": "红利低波ETF易方达",
            "code": "512890",
            "amount": 11001.0,
            "shares": None,
            "cost_price": None,
            "notes": "自动推导份额测试",
        },
        # 2. 场外债券基金 (代码008173，有份额 41169.2)
        {
            "id": 102,
            "category": "FUND",
            "fund_type": "OTC",
            "name": "兴全稳泰债券C",
            "code": "008173",
            "shares": 41169.2,
            "cost_price": 1.2236,
        },
        # 3. 银行定期存款 (已到期)
        {
            "id": 103,
            "category": "DEPOSIT",
            "name": "已到期定存",
            "amount": 100000.0,
            "annual_rate": 3.0,
            "start_date": "2023-01-01",
            "maturity_date": "2024-01-01",
        },
        # 4. 银行活期存款 (生息中)
        {
            "id": 104,
            "category": "DEPOSIT",
            "name": "招行活期存款",
            "amount": 200000.0,
            "annual_rate": 2.0,
            "start_date": "2025-01-01",
        },
        # 5. 美股股票 (AAPL, 美元计价)
        {
            "id": 105,
            "category": "STOCK",
            "name": "苹果公司",
            "code": "AAPL",
            "shares": 10,
            "cost_price": 180.0,
        }
    ]

    enriched = _enrich_assets(test_assets)
    for a in enriched:
        print(f"[{a['category']}-{a.get('fundType') or a.get('accountType')}] {a['name']} ({a.get('code')}):")
        print(f"  份额: {a.get('shares')}, 成本: {a.get('costPrice')}, 现价: {a.get('currentPrice')}, 市值: ¥{a['currentValue']}")
        print(f"  今日收益: ¥{a.get('dailyProfit')}, 涨跌幅: {a.get('dailyProfitPct')}%, 状态: {a.get('depositStatus') or a.get('priceAsOf')}")
        print(f"  年收益/分红: ¥{a.get('annualIncome')}, 日收益/息: ¥{a.get('dailyIncome')}")

    # 验证 ETF 份额自动推导
    etf = next(a for a in enriched if a["id"] == 101)
    assert etf["shares"] is not None and etf["shares"] > 9000, f"ETF 份额推导失败: {etf['shares']}"
    assert etf["currentValue"] > 0, "ETF 市值计算异常"
    print(f"✅ ETF 自动推导份额: {etf['shares']} 份, 今日盈亏: ¥{etf['dailyProfit']}")

    # 验证场外基金真实日收益
    otc = next(a for a in enriched if a["id"] == 102)
    assert otc["currentValue"] > 50000, "场外基金市值计算异常"
    print(f"✅ 场外基金最新净值: {otc['currentPrice']}, 今日变动: ¥{otc['dailyProfit']} ({otc['dailyProfitPct']}%)")

    # 验证已到期存款停息
    matured = next(a for a in enriched if a["id"] == 103)
    assert matured["depositStatus"] == "MATURED", "到期状态判定失败"
    assert matured["dailyIncome"] == 0.0, "已到期存款不应继续计息"
    print(f"✅ 已到期存款成功停止计息: dailyIncome = ¥{matured['dailyIncome']}")

    # 验证在保活期存款正常计息
    active_dep = next(a for a in enriched if a["id"] == 104)
    expected_active_income = round(200000.0 * 0.02 / 365.0, 2)
    assert active_dep["dailyIncome"] == expected_active_income, f"活期存款计息异常: {active_dep['dailyIncome']}"
    print(f"✅ 活期存款正常计息: ¥{active_dep['dailyIncome']}/天")

    # 验证美股汇率折算
    aapl = next(a for a in enriched if a["id"] == 105)
    assert aapl["currency"] == "USD", "美股币种识别失败"
    assert aapl["fxRate"] > 1.0, "未正确应用美元汇率"
    print(f"✅ 美股汇率换算: 股价 ${aapl['currentPrice']} × 汇率 {aapl['fxRate']} = 人民币市值 ¥{aapl['currentValue']}")

    print("\n🎉 全部精度与业务规则自动化断言通过！")

if __name__ == "__main__":
    test_full_accuracy()
