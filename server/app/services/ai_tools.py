import logging
from typing import Any, Dict, List, Optional
from app.data.akshare_client import AKShareClient

logger = logging.getLogger(__name__)

# 工具声明列表 (支持 OpenAI / Gemini 格式)
AI_TOOLS_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "get_stock_quote",
            "description": "获取指定股票的盘中实时行情、最新股价、今日涨跌幅、最新盘中动态股息率、市盈率 PE 和市净率 PB。",
            "parameters": {
                "type": "object",
                "properties": {
                    "symbol": {
                        "type": "string",
                        "description": "股票代码或中文名称，例如 '招商银行'、'600036'、'新和成'、'龙高股份' 等"
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
    }
]


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


def dispatch_ai_tool(tool_name: str, tool_args: Dict[str, Any]) -> Dict[str, Any]:
    """AI Function Call 统一分发执行器"""
    logger.info(f"⚡ [AI Tool Call]: {tool_name} with args {tool_args}")
    try:
        if tool_name == "get_stock_quote":
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
