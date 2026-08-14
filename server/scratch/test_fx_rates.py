import datetime
import requests

def get_fx_rates():
    rates = {"USD": 7.20, "HKD": 0.92, "CNY": 1.0}
    try:
        headers = {"Referer": "https://finance.sina.com.cn"}
        r = requests.get("https://hq.sinajs.cn/list=fx_susdcnh,fx_shkdcnh", headers=headers, timeout=3)
        if r.status_code == 200:
            for line in r.text.strip().split(";\n"):
                if "fx_susdcnh" in line and '="' in line:
                    val = line.split('="')[1].split('"')[0]
                    parts = val.split(",")
                    if len(parts) > 1 and float(parts[1]) > 0:
                        rates["USD"] = round(float(parts[1]), 4)
                elif "fx_shkdcnh" in line and '="' in line:
                    val = line.split('="')[1].split('"')[0]
                    parts = val.split(",")
                    if len(parts) > 1 and float(parts[1]) > 0:
                        rates["HKD"] = round(float(parts[1]), 4)
    except Exception as e:
        print("FX fetch error:", e)
    return rates

print("FX Rates:", get_fx_rates())
