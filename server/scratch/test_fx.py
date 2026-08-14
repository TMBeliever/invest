import requests

def test_fx():
    try:
        r = requests.get("http://qt.gtimg.cn/q=fx_susdcnh,fx_shkdcnh", timeout=4)
        print("Tencent FX:", r.text)
    except Exception as e:
        print("Tencent FX err:", e)

    try:
        headers = {"Referer": "https://finance.sina.com.cn"}
        r = requests.get("https://hq.sinajs.cn/list=fx_susdcnh,fx_shkdcnh", headers=headers, timeout=4)
        print("Sina FX:", r.text)
    except Exception as e:
        print("Sina FX err:", e)

if __name__ == "__main__":
    test_fx()
