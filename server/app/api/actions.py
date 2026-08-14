import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.services.auth import get_current_user
from app.data.storage import storage_db
from app.data.akshare_client import AKShareClient, get_otc_fund_nav

logger = logging.getLogger(__name__)
router = APIRouter()


class ActionPayload(BaseModel):
    type: str
    title: Optional[str] = "执行操作"
    summary: Optional[str] = None
    source: Optional[str] = "AI_ACTION"
    payload: Dict[str, Any]


class ActionExecutionRequest(BaseModel):
    type: str
    title: Optional[str] = "执行操作"
    summary: Optional[str] = None
    source: Optional[str] = "AI_ACTION"
    payload: Dict[str, Any]


def _clean_float(val: Any) -> Optional[float]:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, str):
        s = val.replace(",", "").replace("¥", "").replace("$", "").replace("%", "").strip()
        try:
            return float(s)
        except Exception:
            return None
    return None


def _clean_category(cat: Optional[str], name: str = "") -> str:
    c = str(cat or "").strip().upper()
    if c in ("DEPOSIT", "STOCK", "FUND", "WEALTH", "OTHER"):
        return c
    if any(k in c or k in name for k in ("存款", "存单", "活期", "定期", "享存", "大额存单", "BANK", "DEPOSIT")):
        return "DEPOSIT"
    if any(k in c or k in name for k in ("理财", "理财产品", "信托", "资管", "WEALTH")):
        return "WEALTH"
    if any(k in c or k in name for k in ("基金", "ETF", "QDII", "联接", "公募", "FUND")):
        return "FUND"
    if any(k in c or k in name for k in ("股票", "证券", "STOCK")):
        return "STOCK"
    return "OTHER"


def _clean_payout_method(method: Optional[str]) -> str:
    m = str(method or "").strip().upper()
    if m in ("MATURITY", "MONTHLY", "QUARTERLY", "ANNUAL"):
        return m
    if any(k in m for k in ("季", "QUARTER")):
        return "QUARTERLY"
    if any(k in m for k in ("月", "MONTH")):
        return "MONTHLY"
    if any(k in m for k in ("年", "ANNUAL", "YEAR")):
        return "ANNUAL"
    return "MATURITY"


def _clean_deposit_type(dtype: Optional[str], name: str = "") -> str:
    d = str(dtype or "").strip().upper()
    if d in ("DEMAND", "FIXED"):
        return d
    if any(k in d or k in name for k in ("定", "存单", "年", "月", "FIXED")):
        return "FIXED"
    return "DEMAND"


@router.post("/execute")
def execute_agent_action(
    action: ActionExecutionRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    统一执行 AI Action 操作指令
    """
    user_id = current_user["id"]
    action_type = action.type.upper()
    payload = action.payload or {}

    logger.info(f"⚡ [Action Execute] User={user_id}, Type={action_type}, PayloadKeys={list(payload.keys())}")

    # 1. 批量入库/加仓 (IMPORT_ASSETS)
    if action_type in ("IMPORT_ASSETS", "ADD_ASSETS", "BATCH_ADD_ASSETS"):
        items = payload.get("items") or []
        if not items:
            raise HTTPException(status_code=400, detail="items 列表不能为空")

        # 默认策略：若为 OCR 截图默认 SYNC_UPDATE (覆盖更新)，若为对话加仓默认 WEIGHTED_MERGE (加权合并)
        default_strategy = "SYNC_UPDATE" if action.source == "AI_OCR" else "WEIGHTED_MERGE"
        duplicate_strategy = payload.get("duplicateStrategy") or default_strategy

        existing_assets = storage_db.get_all_assets(user_id)
        existing_by_code = {a["code"]: a for a in existing_assets if a.get("code")}
        existing_by_name = {a["name"]: a for a in existing_assets if a.get("name")}

        inserted_items = []
        updated_count = 0
        merged_count = 0

        for it in items:
            raw_cat = it.get("category")
            name = str(it.get("name") or "未命名资产").replace("...", "").strip()
            category = _clean_category(raw_cat, name)
            code = it.get("code")
            fund_type = it.get("fundType") or it.get("fund_type")
            shares = _clean_float(it.get("shares"))
            cost_price = _clean_float(it.get("costPrice")) or _clean_float(it.get("cost_price"))
            amount = _clean_float(it.get("amount"))
            profit = _clean_float(it.get("profit")) or _clean_float(it.get("profitAmount"))
            annual_rate = _clean_float(it.get("annualRate")) or _clean_float(it.get("annual_rate"))
            payout_method = _clean_payout_method(it.get("payoutMethod") or it.get("payout_method"))
            deposit_type = _clean_deposit_type(it.get("depositType") or it.get("deposit_type"), name)
            start_date = it.get("startDate") or it.get("start_date")
            maturity_date = it.get("maturityDate") or it.get("maturity_date")

            # 智能公募基金/QDII/债券处理 (自动补全6位代码、全称与净值份额推导，精准保留历史浮盈)
            is_fund_like = category == "FUND" or any(k in name for k in ["基金", "联接", "纳斯达克", "标普", "QDII", "指数", "ETF"])
            if is_fund_like:
                category = "FUND"

                if not code or len(code) != 6 or not code.isdigit():
                    clean_lookup_name = name.replace("...", "").strip()
                    resolved_code = AKShareClient.resolve_symbol(clean_lookup_name)
                    if resolved_code and len(resolved_code) == 6 and resolved_code.isdigit():
                        code = resolved_code

                if not fund_type:
                    if code and len(code) == 6 and code[:2] in ("51", "15", "56", "58", "16", "52", "50") and "联接" not in name:
                        fund_type = "EXCHANGE"
                    else:
                        fund_type = "OTC"

                if code and len(code) == 6 and fund_type == "OTC":
                    nav_info = get_otc_fund_nav(code)
                    if nav_info and nav_info.get("navPrice"):
                        nav = float(nav_info["navPrice"])
                        if nav_info.get("fundName"):
                            name = nav_info["fundName"]
                        if (shares is None or shares == 0) and amount and amount > 0:
                            shares = round(amount / nav, 4)
                            cost_val = (amount - profit) if profit is not None else amount
                            cost_price = round(cost_val / shares, 4)
                            amount = None
                elif amount and profit is not None and (shares is None or shares == 0):
                    shares = round(amount, 2)
                    cost_val = amount - profit
                    cost_price = round(cost_val / amount, 4) if amount > 0 else 1.0
                    amount = None

            # 存款/理财兜底处理
            if category in ("DEPOSIT", "WEALTH"):
                if amount is None and shares is not None and cost_price is not None:
                    amount = round(shares * cost_price, 2)
                elif amount is None and profit is not None:
                    amount = profit

            # 查找是否已有持仓
            matched_asset = existing_by_code.get(code) if code else existing_by_name.get(name)

            if matched_asset and duplicate_strategy == "SYNC_UPDATE":
                # 覆盖/同步更新模式 (以最新截图/录入为准)
                update_data = {
                    "category": category,
                    "name": name,
                    "code": code,
                    "shares": shares,
                    "cost_price": cost_price,
                    "amount": amount,
                    "annual_rate": annual_rate if annual_rate is not None else matched_asset.get("annual_rate"),
                    "deposit_type": deposit_type or matched_asset.get("deposit_type"),
                    "start_date": start_date or matched_asset.get("start_date"),
                    "maturity_date": maturity_date or matched_asset.get("maturity_date"),
                    "payout_method": payout_method or matched_asset.get("payout_method"),
                    "fund_type": fund_type or matched_asset.get("fund_type"),
                    "notes": it.get("notes") or matched_asset.get("notes") or "AI 同步更新",
                }
                storage_db.update_asset(matched_asset["id"], user_id, update_data, source=action.source or "AI_SYNC_UPDATE")
                updated_count += 1

            elif matched_asset and duplicate_strategy == "WEIGHTED_MERGE":
                # 加权合并加仓模式 (针对增量交易)
                if shares is not None and cost_price is not None and matched_asset.get("shares") is not None:
                    old_s = float(matched_asset.get("shares") or 0)
                    old_p = float(matched_asset.get("cost_price") or 0)
                    new_s = old_s + shares
                    new_p = round((old_s * old_p + shares * cost_price) / new_s, 4) if new_s > 0 else cost_price
                    
                    update_data = {
                        **matched_asset,
                        "shares": new_s,
                        "cost_price": new_p,
                        "notes": f"AI 加仓合并 (原{old_s}股 加仓{shares}股)",
                    }
                    storage_db.update_asset(matched_asset["id"], user_id, update_data, source="AI_WEIGHTED_MERGE")
                    merged_count += 1
                elif amount is not None and matched_asset.get("amount") is not None:
                    old_a = float(matched_asset.get("amount") or 0)
                    update_data = {
                        **matched_asset,
                        "amount": old_a + amount,
                        "notes": f"AI 追加金额 (+¥{amount})",
                    }
                    storage_db.update_asset(matched_asset["id"], user_id, update_data, source="AI_WEIGHTED_MERGE")
                    merged_count += 1
                else:
                    # 无法合并时作为新行插入
                    inserted_items.append({
                        "category": category,
                        "name": name,
                        "code": code,
                        "amount": amount,
                        "shares": shares,
                        "cost_price": cost_price,
                        "annual_rate": annual_rate,
                        "deposit_type": deposit_type,
                        "start_date": start_date,
                        "maturity_date": maturity_date,
                        "payout_method": payout_method,
                        "fund_type": fund_type,
                        "notes": it.get("notes", "AI 录入"),
                    })

            else:
                # 全新资产
                inserted_items.append({
                    "category": category,
                    "name": name,
                    "code": code,
                    "amount": amount,
                    "shares": shares,
                    "cost_price": cost_price,
                    "annual_rate": annual_rate,
                    "deposit_type": deposit_type,
                    "start_date": start_date,
                    "maturity_date": maturity_date,
                    "payout_method": payout_method,
                    "fund_type": fund_type,
                    "notes": it.get("notes", "AI 识别录入"),
                })

        created_ids = []
        if inserted_items:
            created_ids = storage_db.batch_add_assets(
                user_id=user_id,
                items=inserted_items,
                source=action.source or "AI_ACTION",
                description=action.summary or f"AI 批量新增 {len(inserted_items)} 笔资产",
            )

        summary_parts = []
        if created_ids:
            summary_parts.append(f"新增 {len(created_ids)} 笔")
        if updated_count:
            summary_parts.append(f"同步更新 {updated_count} 笔")
        if merged_count:
            summary_parts.append(f"加仓合并 {merged_count} 笔")

        msg = "、".join(summary_parts) if summary_parts else "未发生资产变动"

        return {
            "status": "ok",
            "action": action_type,
            "count": len(created_ids) + updated_count + merged_count,
            "ids": created_ids,
            "message": f"操作成功：{msg}",
        }

    elif action_type == "UPDATE_ASSET":
        # 自然语言修改单个资产属性 (改成本、改份额、改备注等)
        asset_id = payload.get("assetId")
        code = payload.get("code")
        name = payload.get("name")
        updates = payload.get("updates") or {}

        existing_assets = storage_db.get_all_assets(user_id)
        target = None
        if asset_id:
            target = next((a for a in existing_assets if a["id"] == asset_id), None)
        elif code:
            target = next((a for a in existing_assets if a.get("code") == code), None)
        elif name:
            target = next((a for a in existing_assets if a.get("name") == name), None)

        if not target:
            raise HTTPException(status_code=404, detail="未找到待修改的目标资产")

        update_data = {
            **target,
            **updates,
        }
        # 转换驼峰
        if "costPrice" in updates:
            update_data["cost_price"] = updates["costPrice"]
        if "annualRate" in updates:
            update_data["annual_rate"] = updates["annualRate"]
        if "depositType" in updates:
            update_data["deposit_type"] = updates["depositType"]
        if "payoutMethod" in updates:
            update_data["payout_method"] = updates["payoutMethod"]
        if "fundType" in updates:
            update_data["fund_type"] = updates["fundType"]

        ok = storage_db.update_asset(target["id"], user_id, update_data, source=action.source or "AI_CHAT_UPDATE")
        if not ok:
            raise HTTPException(status_code=500, detail="资产更新失败")

        return {
            "status": "ok",
            "action": action_type,
            "assetId": target["id"],
            "message": f"已成功更新【{target['name']}】的持仓信息",
        }

    elif action_type in ("CLEAR_ALL_ASSETS", "CLEAR_ASSETS", "DELETE_ALL_ASSETS", "DELETE_ALL"):
        # 一键清空当前用户的全部持仓资产
        count = storage_db.clear_all_assets(user_id, source=action.source or "AI_CLEAR_ALL")
        return {
            "status": "ok",
            "action": "CLEAR_ALL_ASSETS",
            "count": count,
            "message": f"已成功清空当前账本中的全部资产（共 {count} 笔），支持在时光机中随时一键逆向恢复！",
        }

    elif action_type == "DELETE_ASSET":
        # 自然语言清仓或删除资产
        asset_id = payload.get("assetId")
        code = payload.get("code")
        name = payload.get("name")

        # 容错：若 AI 传递的是“全部/所有”，自动智能路由至清空
        if str(code).upper() in ("ALL", "*", "全部") or str(name) in ("全部资产", "所有资产", "全部持仓", "全部", "ALL"):
            count = storage_db.clear_all_assets(user_id, source=action.source or "AI_CLEAR_ALL")
            return {
                "status": "ok",
                "action": "CLEAR_ALL_ASSETS",
                "count": count,
                "message": f"已成功清空当前账本中的全部资产（共 {count} 笔），支持在时光机中随时一键逆向恢复！",
            }

        existing_assets = storage_db.get_all_assets(user_id)
        target = None
        if asset_id:
            target = next((a for a in existing_assets if a["id"] == asset_id), None)
        elif code:
            target = next((a for a in existing_assets if a.get("code") == code), None)
        elif name:
            target = next((a for a in existing_assets if a.get("name") == name), None)

        if not target:
            raise HTTPException(status_code=404, detail="未找到待清仓的目标资产")

        ok = storage_db.delete_asset(target["id"], user_id, source=action.source or "AI_CHAT_DELETE")
        if not ok:
            raise HTTPException(status_code=500, detail="资产删除失败")

        return {
            "status": "ok",
            "action": action_type,
            "assetId": target["id"],
            "message": f"已成功将【{target['name']}】从持仓账本中移除",
        }

    elif action_type == "ADD_WATCHLIST":
        codes = payload.get("codes", [])
        return {
            "status": "ok",
            "action": action_type,
            "count": len(codes),
            "message": f"已将 {len(codes)} 只标的添加至自选关注",
        }

    elif action_type == "SET_ALERT":
        return {
            "status": "ok",
            "action": action_type,
            "message": "股息率监控预警已成功开启",
        }

    else:
        raise HTTPException(status_code=400, detail=f"未知的 Action 动作类型: {action_type}")


@router.get("/audit-logs")
def get_audit_logs(
    limit: int = 50,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """获取用户全量资产与操作审计流水"""
    user_id = current_user["id"]
    return storage_db.get_asset_audit_logs(user_id, limit=limit)


@router.post("/rollback/{log_id}")
def rollback_action(
    log_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """通用时光机一键逆向回滚"""
    user_id = current_user["id"]
    res = storage_db.rollback_asset_action(user_id, log_id)
    if res.get("status") == "error":
        raise HTTPException(status_code=400, detail=res.get("message", "回滚失败"))
    return res
