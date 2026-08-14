import akshare as ak
try:
    df = ak.tool_trade_date_hist_sina()
    print("Trade dates count:", len(df))
    print("Latest dates:", df.tail(5))
except Exception as e:
    print("ak error:", e)
