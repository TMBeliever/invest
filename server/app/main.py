from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import market, dividend, portfolio, stock

app = FastAPI(
    title="InvestScope API",
    description="高胜率投资决策平台后端服务",
    version="0.1.0"
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 路由注册
app.include_router(market.router, prefix="/api/market", tags=["Market"])
app.include_router(dividend.router, prefix="/api/dividend", tags=["Dividend"])
app.include_router(portfolio.router, prefix="/api/portfolio", tags=["Portfolio"])
app.include_router(stock.router, prefix="/api/stock", tags=["Stock"])

@app.get("/")
def root():
    return {"message": "InvestScope API is running", "version": "0.1.0"}

@app.get("/health")
def health():
    return {"status": "ok"}
