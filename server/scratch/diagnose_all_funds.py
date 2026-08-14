import sys
import os
import requests

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.data.storage import storage_db
from app.api.assets import _enrich_assets, _batch_tencent_quote, get_otc_fund_nav

def diagnose_user_assets():
    # 用户 liangkaiqin
    user_id = "b72a631e-6081-4c0a-8143-142662cf1e21"
    raw_assets = storage_db.get_all_assets(user_id)
    print(f"=== 用户总资产条目数: {len(raw_assets)} ===")
    
    # 诊断所有基金 (FUND) 和 股票 (STOCK)
    for a in raw_assets:
        cat = a.get("category")
        code = a.get("code")
        name = a.get("name")
        shares = a.get("shares")
        amount = a.get("amount")
        fund_type = a.get("fund_type")
        
        print(f"\n--- [ID {a['id']}] {name} ({code}) | Category={cat} | fundType={fund_type} | shares={shares} | amount={amount} ---")
        
        if code:
            # 1. 测试腾讯实时行情接口
            t_quote = _batch_tencent_quote([code])
            quote_data = t_quote.get(code)
            if quote_data:
                print(f"  [Tencent 腾讯实时行情] 成功获取: 现价={quote_data.get('price')}, 昨收={quote_data.get('prevClose')}, 变动={quote_data.get('change')}, 涨跌幅={quote_data.get('changePct')}%")
            else:
                print(f"  [Tencent 腾讯实时行情] 无数据 / 未匹配")
                
            # 2. 测试东财场外净值接口
            nav_data = get_otc_fund_nav(code)
            if nav_data:
                print(f"  [Eastmoney 场外净值接口] 成功获取: 官方名称={nav_data.get('fundName')}, 最新净值={nav_data.get('navPrice')}, 净值日={nav_data.get('navDate')}, 日涨跌幅={nav_data.get('changePct')}")
            else:
                print(f"  [Eastmoney 场外净值接口] 无数据 / 失败")
        else:
            print("  [WARN] 该资产没有填写代码 (code is None)！")

if __name__ == "__main__":
    diagnose_user_assets()
