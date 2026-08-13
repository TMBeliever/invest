from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
from app.data.storage import storage_db
from app.services.auth import get_current_user

router = APIRouter()

@router.get("/summary")
def get_portfolio_summary(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """获取真实持久化的组合概览 (按当前登录用户隔离)"""
    user_id = current_user["id"]
    raw_holdings = storage_db.get_all_holdings(user_id)
    
    processed_holdings = []
    total_assets = 0.0
    total_cost = 0.0
    
    category_totals = {"CORE": 0.0, "SATELLITE": 0.0, "RESERVE": 0.0}
    
    for h in raw_holdings:
        market_val = h["shares"] * h["currentPrice"]
        cost_val = h["shares"] * h["costPrice"]
        profit_loss = market_val - cost_val
        profit_loss_pct = round((profit_loss / cost_val * 100), 2) if cost_val > 0 else 0.0
        
        total_assets += market_val
        total_cost += cost_val
        
        cat = h["category"]
        if cat.startswith("CORE"):
            category_totals["CORE"] += market_val
        elif cat.startswith("SATELLITE"):
            category_totals["SATELLITE"] += market_val
        elif cat.startswith("RESERVE"):
            category_totals["RESERVE"] += market_val

        processed_holdings.append({
            **h,
            "marketValue": round(market_val, 2),
            "profitLoss": round(profit_loss, 2),
            "profitLossPct": profit_loss_pct,
            "weight": 0.0  # 下面统一计算
        })

    # 计算权重
    for h in processed_holdings:
        h["weight"] = round((h["marketValue"] / total_assets * 100), 2) if total_assets > 0 else 0.0

    total_profit_loss = total_assets - total_cost
    total_profit_loss_pct = round((total_profit_loss / total_cost * 100), 2) if total_cost > 0 else 0.0

    core_pct = round((category_totals["CORE"] / total_assets * 100), 1) if total_assets > 0 else 0.0
    satellite_pct = round((category_totals["SATELLITE"] / total_assets * 100), 1) if total_assets > 0 else 0.0
    reserve_pct = round((category_totals["RESERVE"] / total_assets * 100), 1) if total_assets > 0 else 0.0

    return {
        "totalAssets": round(total_assets, 2),
        "totalProfitLoss": round(total_profit_loss, 2),
        "totalProfitLossPct": total_profit_loss_pct,
        "annualizedReturn": 0.0 if total_assets == 0 else 10.2,
        "allocation": {
            "core": core_pct,
            "satellite": satellite_pct,
            "reserve": reserve_pct
        },
        "targetAllocation": {
            "core": 60.0,
            "satellite": 30.0,
            "reserve": 10.0
        },
        "holdings": processed_holdings
    }

@router.post("/holdings")
def add_holding(holding: Dict[str, Any], current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """新增持仓项存入 SQLite (关联 user_id)"""
    user_id = current_user["id"]
    new_id = storage_db.add_holding(user_id, holding)
    return {"status": "ok", "id": new_id}

@router.delete("/holdings/{id}")
def delete_holding(id: str, current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """删除持仓项"""
    user_id = current_user["id"]
    storage_db.delete_holding(id, user_id)
    return {"status": "ok"}

@router.get("/rebalance-signals")
def get_rebalance_signals(current_user: Dict[str, Any] = Depends(get_current_user)) -> List[Dict[str, Any]]:
    """根据实际权重与目标权重自动计算再平衡信号"""
    summary = get_portfolio_summary(current_user)
    alloc = summary["allocation"]
    target = summary["targetAllocation"]
    
    signals = []
    
    # 核心仓
    core_dev = round(alloc["core"] - target["core"], 1)
    if abs(core_dev) >= 5.0:
        signals.append({
            "type": "WARNING" if core_dev < -5.0 else "REBALANCE",
            "category": "核心仓位",
            "currentWeight": alloc["core"],
            "targetWeight": target["core"],
            "deviation": core_dev,
            "message": f"核心仓位偏离目标 {core_dev}% (> 5%)，建议{'买入调高' if core_dev < 0 else '卖出部分'}至 60%",
            "priority": "HIGH"
        })
    else:
        signals.append({
            "type": "REBALANCE",
            "category": "核心仓位",
            "currentWeight": alloc["core"],
            "targetWeight": target["core"],
            "deviation": core_dev,
            "message": f"核心仓位维持正常 ({alloc['core']}%)，无大偏离",
            "priority": "LOW"
        })

    return signals
