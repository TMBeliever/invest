from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import market, dividend, portfolio, stock, ws, auth, financial, assets, ai
from app.services.quote_hub import quote_hub


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动行情推送池
    await quote_hub.start()
    yield
    # 关闭行情推送池
    await quote_hub.stop()

app = FastAPI(
    title="InvestScope API",
    description="高胜率投资决策平台后端服务",
    version="0.1.0",
    lifespan=lifespan
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
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(market.router, prefix="/api/market", tags=["Market"])
app.include_router(dividend.router, prefix="/api/dividend", tags=["Dividend"])
app.include_router(portfolio.router, prefix="/api/portfolio", tags=["Portfolio"])
app.include_router(stock.router, prefix="/api/stock", tags=["Stock"])
app.include_router(financial.router, prefix="/api/stock/financial", tags=["Financial"])
app.include_router(assets.router, prefix="/api/assets", tags=["Assets"])
app.include_router(ai.router, prefix="/api/ai", tags=["AI Advisor"])
app.include_router(ws.router, tags=["WebSocket"])

@app.get("/")
def root():
    return {"message": "InvestScope API is running", "version": "0.1.0"}

@app.get("/health")
def health():
    return {"status": "ok"}

