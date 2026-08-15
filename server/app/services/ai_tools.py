import json
import logging
from typing import Any, Dict, List, Optional
from app.data.akshare_client import AKShareClient
from app.data.storage import storage_db
from app.api.assets import _enrich_assets

logger = logging.getLogger(__name__)

# ─── 1. AI 工具注册中心 (Tool Registry Definitions) ──────────────────────
AI_TOOLS_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "get_portfolio_xray",
            "description": "获取用户当前全部真实资产的【全景 X 光透视体检报告】。包括底层行业真实穿透敞口、CR3与HHI行业集中度指数、五维资产风格因子雷达(高股息/固收/科技海外/大盘价值/现金)以及 4 种宏观极端情景压力测试(纳指深度调整-10%、央行降息25bp、A股极端探底-15%、高股息走强+8%)的预估盈亏与抗跌弹性评级。",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_portfolio_summary",
            "description": "获取用户当前全部真实资产总览。包括总资产净值、持仓总浮盈、预估年现金流收益(分红+利息)、综合收益率以及完整的资产持仓明细清单。",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_stock_quote",
            "description": "获取指定股票或场内ETF的盘中秒级实时行情、最新股价、今日涨跌幅、最新盘中动态股息率、市盈率 PE 和市净率 PB。",
            "parameters": {
                "type": "object",
                "properties": {
                    "symbol": {
                        "type": "string",
                        "description": "股票代码或中文名称，例如 '招商银行'、'600036'、'新和成'、'512890' 等"
                    }
                },
                "required": ["symbol"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_financial_analysis",
            "description": "获取指定股票的官方财报体检、杜邦拆解 ROE、商业模式定位、4 大排雷指标及业绩前瞻与分析师一致预期。",
            "parameters": {
                "type": "object",
                "properties": {
                    "symbol": {
                        "type": "string",
                        "description": "股票代码或中文名称，例如 '招商银行'、'新和成' 等"
                    }
                },
                "required": ["symbol"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_stock_news",
            "description": "获取指定股票最新的 5 条爆点新闻、公司公告、分红派息公告及板块资金流向消息。",
            "parameters": {
                "type": "object",
                "properties": {
                    "symbol": {
                        "type": "string",
                        "description": "股票代码或中文名称，例如 '招商银行'、'新和成' 等"
                    }
                },
                "required": ["symbol"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "compare_stocks",
            "description": "同时对比多只股票的盘中实时行情、最新动态股息率、杜邦 ROE 和排雷健康度指标。",
            "parameters": {
                "type": "object",
                "properties": {
                    "symbols": {
                        "type": "array",
                        "items": { "type": "string" },
                        "description": "要对比的股票代码或中文名称列表，例如 ['招商银行', '龙高股份', '新和成']"
                    }
                },
                "required": ["symbols"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_active_risk_alerts",
            "description": "获取用户当前持仓的【组合智能哨兵与四维风控预警报告】。包括隐形行业穿透超标(>28%)、股息利差收窄、现金防御安全垫击穿(<10%)、极端压力测试敏感度回撤预警，以及系统为每条风险配备的 3 套深度应对方案(方案A守成/方案B优化/方案C防守)。",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_dividend_calendar",
            "description": "获取用户指定年度（默认当前年）的【未来12个月现金流到账日历与分红/利息预测事件】。包含各月份现金流汇总、波峰波谷月度分布、每笔具体派息/结息事件（标的名称、代码、金额、具体到账日期、结息方式）。用于分析月度现金流、断档期及平滑月度收入规划。",
            "parameters": {
                "type": "object",
                "properties": {
                    "year": {
                        "type": "integer",
                        "description": "查询年份，例如 2026（默认当前年份）"
                    },
                    "month": {
                        "type": "integer",
                        "description": "查询具体月份（1-12，可选）"
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_national_team_overview",
            "description": "获取【国家队操盘雷达与四大主力持仓透视全景】。包含 12 大核心维稳 ETF 实时成交放量倍数与护盘强度评级(S/A/B级)、中央汇金/中国证金/全国社保/国新系四大主力的万亿级持仓底牌与 37+ 支柱重仓股实时盘面、高股息跟车策略候选池及回测胜率。",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_stock_money_flow",
            "description": "获取指定股票或 ETF 的【盘中实时大单多空力量及近 15 个交易日真实逐日资金流向历史】。包含外盘主动买入、内盘主动卖出、盘中多空差额、量比、每日收盘价、主力大单净买入(亿元)、主力买入占比以及各大国家队机构（汇金/证金/社保/国新）的出资拆解。",
            "parameters": {
                "type": "object",
                "properties": {
                    "symbol": {
                        "type": "string",
                        "description": "股票代码或中文名称，例如 '招商银行'、'600036'、'工商银行'、'510300' 等"
                    }
                },
                "required": ["symbol"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_smart_dividend_basket",
            "description": "获取【策略魔方·优质红利自选定制组合】。从全市场优质高股息标的中，执行周期顶点排雷、财务安全过滤与国家队机构加权，生成 3 ~ 20 只最优分散红利投资篮子，并提供与传统中证红利 ETF (510880) 的降维对比与年省管理费分析。",
            "parameters": {
                "type": "object",
                "properties": {
                    "count": {
                        "type": "integer",
                        "description": "选股数量（3 ~ 20，默认 10）"
                    },
                    "strategy": {
                        "type": "string",
                        "description": "策略风格：BALANCED_QUALITY (优质避坑平衡) | DEEP_VALUE_SAFETY (破净低波防守) | HIGH_ROE_GROWTH (高ROE复利) | SOVEREIGN_SUPPORT (国家队压舱石)"
                    }
                },
                "required": []
            }
        }
    }
]


# ─── 2. 工具执行器实现 (Tool Executors) ──────────────────────────────────

def execute_portfolio_xray(user_id: str) -> Dict[str, Any]:
    """执行 X-Ray 全景体检工具"""
    try:
        from app.api.xray import get_portfolio_xray
        return get_portfolio_xray({"id": user_id})
    except Exception as e:
        logger.error(f"执行 get_portfolio_xray 失败: {e}")
        return {"error": f"获取 X-Ray 体检数据失败: {str(e)}"}


def execute_active_risk_alerts(user_id: str) -> Dict[str, Any]:
    """获取用户当前持仓活跃的风险预警与 A/B/C 决策方案"""
    try:
        alerts = storage_db.get_user_sentinel_alerts(user_id, status=None)
        active = [a for a in alerts if a.get("status") in ("UNREAD", "ACKNOWLEDGED")]
        return {
            "activeCount": len(active),
            "alerts": [
                {
                    "id": a.get("id"),
                    "severity": a.get("severity"),
                    "title": a.get("title"),
                    "summary": a.get("summary"),
                    "status": a.get("status"),
                    "decisionOptions": a.get("decision_options", []),
                }
                for a in active
            ]
        }
    except Exception as e:
        logger.error(f"执行 get_active_risk_alerts 失败: {e}")
        return {"error": f"获取风险预警失败: {str(e)}"}


def execute_portfolio_summary(user_id: str) -> Dict[str, Any]:
    """执行资产总览工具"""
    try:
        raw_assets = storage_db.get_all_assets(user_id)
        enriched = _enrich_assets(raw_assets)
        total_val = sum(float(a.get("currentValue") or a.get("amount") or 0.0) for a in enriched)
        total_profit = sum(float(a.get("profit") or 0.0) for a in enriched)
        annual_income = sum(float(a.get("annualIncome") or 0.0) for a in enriched)
        yield_rate = round((annual_income / total_val * 100), 2) if total_val > 0 else 0.0

        items = []
        for a in enriched:
            items.append({
                "name": a.get("name"),
                "code": a.get("code"),
                "category": a.get("category"),
                "fundType": a.get("fundType"),
                "currentValue": a.get("currentValue") or a.get("amount"),
                "profit": a.get("profit"),
                "profitPct": a.get("profitPct"),
                "annualIncome": a.get("annualIncome"),
                "dividendYield": a.get("dividendYield"),
            })

        return {
            "totalValue": round(total_val, 2),
            "totalProfit": round(total_profit, 2),
            "annualIncome": round(annual_income, 2),
            "yieldRate": yield_rate,
            "assetsCount": len(items),
            "assets": items
        }
    except Exception as e:
        logger.error(f"执行 get_portfolio_summary 失败: {e}")
        return {"error": f"获取资产总览数据失败: {str(e)}"}


def execute_stock_quote(symbol: str) -> Dict[str, Any]:
    """获取单股行情工具"""
    clean_code = AKShareClient.resolve_symbol(symbol)
    quote = AKShareClient.get_realtime_quote(clean_code)
    if not quote:
        return {"error": f"无法找到股票 [{symbol}] 的实时行情"}
    return {
        "name": quote.get("name"),
        "code": quote.get("code"),
        "price": quote.get("price"),
        "changePct": quote.get("changePct"),
        "change": quote.get("change"),
        "dividendYield": quote.get("dividendYield"),
        "pe": quote.get("pe"),
        "pb": quote.get("pb"),
        "open": quote.get("open"),
        "prevClose": quote.get("prevClose"),
        "high": quote.get("high"),
        "low": quote.get("low"),
    }


def execute_financial_analysis(symbol: str) -> Dict[str, Any]:
    """获取财报排雷工具"""
    clean_code = AKShareClient.resolve_symbol(symbol)
    report = AKShareClient.get_financial_analysis_report(clean_code)
    if not report:
        return {"error": f"无法获取股票 [{symbol}] 的财报分析报告"}
    return {
        "name": report.get("name"),
        "code": report.get("code"),
        "dupont": report.get("dupont"),
        "healthScan": report.get("healthScan"),
        "earningsPreview": report.get("earningsPreview"),
    }


def execute_stock_news(symbol: str) -> Dict[str, Any]:
    """获取新闻公告工具"""
    clean_code = AKShareClient.resolve_symbol(symbol)
    news = AKShareClient.get_stock_news(clean_code)
    return {
        "symbol": symbol,
        "code": clean_code,
        "newsCount": len(news),
        "news": news,
    }


def execute_compare_stocks(symbols: List[str]) -> Dict[str, Any]:
    """多股对比工具"""
    results = []
    for s in symbols:
        try:
            q = execute_stock_quote(s)
            f = execute_financial_analysis(s)
            results.append({
                "symbol": s,
                "quote": q,
                "financial": f,
            })
        except Exception as e:
            results.append({
                "symbol": s,
                "error": str(e),
            })
    return {"comparedCount": len(results), "comparison": results}


def execute_dividend_calendar(user_id: str, year: Optional[int] = None, month: Optional[int] = None) -> Dict[str, Any]:
    """获取用户真实现金流日历与事件"""
    try:
        from app.services.dividend_calendar import dividend_calendar_service
        cal = dividend_calendar_service.generate_calendar(user_id)
        if month:
            target_year = year or datetime.datetime.now().year
            month_str = f"{target_year}-{int(month):02d}"
            monthly_events = [e for e in cal.get("events", []) if e.get("date", "").startswith(month_str)]
            monthly_sum = sum(float(e.get("amount") or 0.0) for e in monthly_events)
            return {
                "year": target_year,
                "month": month,
                "monthTotalIncome": round(monthly_sum, 2),
                "eventsCount": len(monthly_events),
                "events": monthly_events,
            }
        return cal
    except Exception as e:
        logger.error(f"执行 get_dividend_calendar 失败: {e}")
        return {"error": f"获取现金流日历失败: {str(e)}"}


def execute_national_team_overview() -> Dict[str, Any]:
    """获取国家队操盘雷达与四大主力底牌"""
    try:
        from app.services.national_team import national_team_service
        radar = national_team_service.get_realtime_defense_radar()
        holdings = national_team_service.get_national_team_holdings()
        follow = national_team_service.get_follow_strategy_pool()
        return {
            "radarSummary": radar.get("summary"),
            "topActiveEtfs": [e for e in radar.get("etfRadarList", []) if e.get("volumeMultiplier", 1.0) >= 1.2],
            "factions": holdings.get("factions"),
            "coreHoldingsCount": len(holdings.get("coreHoldings", [])),
            "coreHoldingsTop10": holdings.get("coreHoldings", [])[:10],
            "followCandidatesCount": len(follow.get("candidates", [])),
            "followCandidatesTop5": follow.get("candidates", [])[:5],
        }
    except Exception as e:
        logger.error(f"执行 get_national_team_overview 失败: {e}")
        return {"error": f"获取国家队操盘数据失败: {str(e)}"}


def execute_stock_money_flow(symbol: str) -> Dict[str, Any]:
    """获取个股盘中大单力量与逐日主力资金流水"""
    try:
        from app.services.national_team import national_team_service
        return national_team_service.get_stock_money_flow(symbol)
    except Exception as e:
        logger.error(f"执行 get_stock_money_flow 失败: {e}")
        return {"error": f"获取资金流向失败: {str(e)}"}


def execute_smart_dividend_basket(count: int = 10, strategy: str = "BALANCED_QUALITY") -> Dict[str, Any]:
    """生成 3~20 只优质红利自选组合及中证红利 ETF 对比"""
    try:
        from app.services.smart_dividend_basket import smart_dividend_basket_service
        return smart_dividend_basket_service.generate_basket(count=count, strategy=strategy)
    except Exception as e:
        logger.error(f"执行 get_smart_dividend_basket 失败: {e}")
        return {"error": f"生成定制红利组合失败: {str(e)}"}


def dispatch_ai_tool(tool_name: str, tool_args: Dict[str, Any], user_id: Optional[str] = None) -> Dict[str, Any]:
    """AI Function Call 统一分发执行器"""
    logger.info(f"⚡ [AI Agent Tool Call]: {tool_name} with args {tool_args} (user_id={user_id})")
    try:
        if tool_name == "get_portfolio_xray":
            return execute_portfolio_xray(user_id or "")
        elif tool_name == "get_active_risk_alerts":
            return execute_active_risk_alerts(user_id or "")
        elif tool_name == "get_portfolio_summary":
            return execute_portfolio_summary(user_id or "")
        elif tool_name == "get_dividend_calendar":
            return execute_dividend_calendar(user_id or "", year=tool_args.get("year"), month=tool_args.get("month"))
        elif tool_name == "get_national_team_overview":
            return execute_national_team_overview()
        elif tool_name == "get_stock_money_flow":
            return execute_stock_money_flow(tool_args.get("symbol", ""))
        elif tool_name == "get_smart_dividend_basket":
            return execute_smart_dividend_basket(count=int(tool_args.get("count", 10)), strategy=str(tool_args.get("strategy", "BALANCED_QUALITY")))
        elif tool_name == "get_stock_quote":
            return execute_stock_quote(tool_args.get("symbol", ""))
        elif tool_name == "get_financial_analysis":
            return execute_financial_analysis(tool_args.get("symbol", ""))
        elif tool_name == "get_stock_news":
            return execute_stock_news(tool_args.get("symbol", ""))
        elif tool_name == "compare_stocks":
            symbols = tool_args.get("symbols", [])
            if isinstance(symbols, str):
                symbols = [s.strip() for s in symbols.split(",") if s.strip()]
            return execute_compare_stocks(symbols)
        else:
            return {"error": f"未知的工具名称: {tool_name}"}
    except Exception as e:
        logger.error(f"执行工具 [{tool_name}] 异常: {e}")
        return {"error": f"执行工具失败: {str(e)}"}
