from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import market, dividend, portfolio, stock, ws, auth, financial, assets, ai, actions, xray, intelligence, gateway, national_team, smart_basket
from app.services.quote_hub import quote_hub
from app.services.scheduler import scheduler_service
from app.services.gateway.telegram_poller import telegram_bot_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动行情推送池、智能中台调度器与多平台双向 Agent 网关
    await quote_hub.start()
    await scheduler_service.start()
    await telegram_bot_service.start()
    yield
    # 关闭服务
    await telegram_bot_service.stop()
    await scheduler_service.stop()
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
app.include_router(xray.router, prefix="/api/assets", tags=["X-Ray"])
app.include_router(intelligence.router, tags=["Intelligence & Sentinel"])
app.include_router(national_team.router, tags=["National Team"])
app.include_router(smart_basket.router, prefix="/api/strategy-baskets", tags=["Strategy Baskets"])
app.include_router(actions.router, prefix="/api/actions", tags=["Actions"])
app.include_router(ai.router, prefix="/api/ai", tags=["AI Advisor"])
app.include_router(gateway.router, prefix="/api/gateway", tags=["Gateway & Bots"])
app.include_router(ws.router, tags=["WebSocket"])

@app.get("/")
def root():
    return {"message": "InvestScope API is running", "version": "0.1.0"}

@app.get("/health")
def health():
    return {"status": "ok"}

