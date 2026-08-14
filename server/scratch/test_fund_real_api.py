import requests

def test_tiantian_fund_api(code):
    # 天天基金实时估值与最新公布净值接口
    url1 = f"http://fundgz.1234567.com.cn/js/{code}.js"
    try:
        r1 = requests.get(url1, timeout=3)
        print(f"[{code}] fundgz:", r1.text)
    except Exception as e:
        print(f"[{code}] fundgz err:", e)

    # 天天基金净值接口
    url2 = f"http://api.fund.eastmoney.com/f10/lsjz?fundCode={code}&pageIndex=1&pageSize=5"
    headers = {"Referer": "http://fundf10.eastmoney.com/"}
    try:
        r2 = requests.get(url2, headers=headers, timeout=3).json()
        print(f"[{code}] lsjz:", r2.get("Data", {}).get("LSJZList", [])[:2])
    except Exception as e:
        print(f"[{code}] lsjz err:", e)

for c in ["008173", "019700", "675113", "590009", "202102", "006242", "022403", "512890", "510300"]:
    test_tiantian_fund_api(c)
