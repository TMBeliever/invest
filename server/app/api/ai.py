import datetime
import json
import logging
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.api.assets import _enrich_assets
from app.data.akshare_client import AKShareClient
from app.data.storage import storage_db
from app.services.auth import get_current_user
from app.services.llm_provider import get_llm_provider

logger = logging.getLogger(__name__)
router = APIRouter()


class ChatMessagePayload(BaseModel):
    role: str
    content: str
    images: Optional[List[str]] = None  # Base64 或图片 URL 列表 (多模态输入)


class ChatRequestPayload(BaseModel):
    sessionId: Optional[str] = None
    messages: List[ChatMessagePayload]
    model: Optional[str] = None
    mode: Optional[str] = "finance"  # "finance" | "general"
    currentPage: Optional[str] = None
    pageContext: Optional[Dict[str, Any]] = None


def _build_system_prompt(
    user_id: str,
    session_summary: Optional[str] = None,
    user_query: Optional[str] = None,
    mode: str = "finance",
    current_page: Optional[str] = None,
    page_context: Optional[Dict[str, Any]] = None,
) -> str:
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    weekday_str = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"][
        datetime.datetime.now().weekday()
    ]
    summary_part = f"\n\n[早期对话历史要点]:\n{session_summary}" if session_summary else ""
    page_part = f"\n- 用户当前正处于页面: {current_page}" if current_page else ""

    if mode == "general":
        return f"""你是一名知识渊博、解答详尽、逻辑严谨的【通用智能 AI 助手】。
当前精准时间: {now_str} {weekday_str}{page_part}

[核心能力与回答准则]:
1. 具备广泛的通用知识储备，支持科学常识、文本创作、代码编写与调试、逻辑推理、外语翻译、工作生活咨询等全方位场景。
2. 语言风格亲切、专业、结构清晰，多使用 Markdown 标题、加粗、列表与代码块进行条理化表达。
3. 针对用户的各类提问提供直接、深入、富有建设性的回答。{summary_part}
"""

    # 基础宏观数据 (轻量兜底)
    try:
        overview = AKShareClient.get_market_overview()
        bond_10y = overview.get("bondYield10y", 1.71)
        risk_ratio = overview.get("riskPremiumRatio", 3.05)
    except Exception:
        bond_10y, risk_ratio = 1.71, 3.05

    return f"""你是一名精通个人资产配置、现金流推演、组合风险穿透与高股息量化策略的【InvestScope 智能 AI 投资顾问】。

[系统基准环境]:
- 当前精准时间: {now_str} {weekday_str}
- 10年期国债基准收益率: {bond_10y}% | 股债风险溢价比 (ERP): {risk_ratio}{page_part}{summary_part}

[核心能力与 Agentic 工具调用规范]:
1. **自主工具调度 (Tool-Use / Function Calling)**:
   你拥有全套系统级实时量化工具库（Tools）：
   - `get_dividend_calendar(year, month)`: 获取用户真实现金流日历、未来12个月月度分红/利息到账波峰波谷与具体结息事件（用于分析断档期与月度现金流平滑）。
   - `get_national_team_overview()`: 获取国家队操盘雷达全景、12大核心护盘ETF秒级放量异动与四大主力万亿持仓底牌。
   - `get_stock_money_flow(symbol)`: 获取个股盘中大单多空力量及近15日逐日主力资金流水与国家队机构拆解。
   - `get_portfolio_xray()`: 获取用户当前全部真实资产的【全景 X 光透视体检报告】（行业敞口、CR3/HHI集中度、五维因子雷达、4 种极端压力测试）。
   - `get_portfolio_summary()`: 获取用户当前资产净值概况、持仓总浮盈、预估年现金流收益与持仓清单。
   - `get_stock_quote(symbol)`: 获取单只股票或场内ETF的盘中秒级实时行情、最新股价、涨跌幅与动态股息率。
   - `get_financial_analysis(symbol)`: 获取官方财报体检、杜邦 ROE 拆解、4 大排雷指标及业绩前瞻。
   - `get_stock_news(symbol)`: 获取最新资讯、分红派息公告。
   - `compare_stocks(symbols)`: 多股横向对比矩阵。
   *当用户提问涉及持仓体检、现金流日历、国家队操盘、资金流向、压力测试、个股行情或财报时，请自主调用对应工具获取最新真实数据后回答，严禁凭空编造虚假数字！*

2. **回答准则与专业度**:
   - 语言风格亲切、专业、洞察深刻。多用 Markdown 标题、加粗、数据对比表格与引用卡片。
   - 结合用户当前所处页面和真实资产给出具指导意义的资产配置建议。

3. **【智能 Action 操作卡片生成规范】**:
   当用户的提问或上传的截图表达了明确的操作意图时，先给出亲切专业的解读与分析，并在回答最底部输出标准的 ```action:investscope 结构化代码块（前端会自动渲染为高颜值的交互操作卡片）：

- 【场景1：截图录入 / 批量入账 / 加仓记账】:
  * 截图录入时，默认 `duplicateStrategy: "SYNC_UPDATE"`（已有标的自动覆盖同步最新数据）；
  * 对话加仓时，默认 `duplicateStrategy: "WEIGHTED_MERGE"`（已有标的自动按公式计算加权平均成本与合并股数）；
  * 股票/场内ETF：`category: "STOCK"`，填写 `name`, `code`, `shares`, `costPrice`；
  * 场外公募基金：`category: "FUND", fundType: "OTC"`，填入当前市值 `amount` 与持有收益 `profit`；
  * 银行存款/定期存单：`category: "DEPOSIT"`，填入存款本金 `amount`（纯数字不带逗号）、约定年利率 `annualRate`（如 4.0 代表 4.0%）、结息方式 `payoutMethod: "QUARTERLY"`（按季付息）或 `"MATURITY"`（到期付息）或 `"MONTHLY"`（按月付息）、存单类型 `depositType: "FIXED"`（定期）或 `"DEMAND"`（活期）、到期日 `maturityDate`（如 "2027-11-12"）。
  示例:
  ```action:investscope
  {{
    "type": "IMPORT_ASSETS",
    "title": "持仓资产待入账确认",
    "summary": "识别出标的与最新市值",
    "payload": {{
      "duplicateStrategy": "SYNC_UPDATE",
      "items": [
        {{
          "category": "STOCK",
          "name": "招商银行",
          "code": "600036",
          "shares": 600,
          "costPrice": 25.276,
          "notes": "持仓录入"
        }},
        {{
          "category": "DEPOSIT",
          "name": "享存3月 (定期存款)",
          "amount": 98450.88,
          "annualRate": 4.0,
          "depositType": "FIXED",
          "payoutMethod": "QUARTERLY",
          "maturityDate": "2027-11-12",
          "notes": "按季付息 4.00%"
        }},
        {{
          "category": "FUND",
          "name": "南方纳斯达克100指数发起A",
          "fundType": "OTC",
          "amount": 2739.30,
          "profit": 289.30,
          "notes": "公募场外基金"
        }}
      ]
    }}
  }}
  ```

- 【场景2：自然语言修改资产 (如“把招行成本改成30”)】:
  示例:
  ```action:investscope
  {{
    "type": "UPDATE_ASSET",
    "title": "修改持仓信息确认",
    "summary": "将 招商银行(600036) 成本价调整为 ¥30.00",
    "payload": {{
      "code": "600036",
      "name": "招商银行",
      "updates": {{
        "costPrice": 30.0
      }}
    }}
  }}
  ```

- 【场景3：自然语言清仓/删除单个资产 (如“把新和成从持仓移除/卖出”)】:
  示例:
  ```action:investscope
  {{
    "type": "DELETE_ASSET",
    "title": "清仓移除资产确认",
    "summary": "将 新和成(002001) 从持仓账本中移除",
    "dangerLevel": "high",
    "payload": {{
      "code": "002001",
      "name": "新和成"
    }}
  }}
  ```

- 【场景4：自然语言一键清空全部资产 (如“清空我的资产”、“删除所有持仓”、“重置账本”)】:
  示例:
  ```action:investscope
  {{
    "type": "CLEAR_ALL_ASSETS",
    "title": "清空全部持仓资产确认",
    "summary": "清空当前账本中的全部资产（支持在时光机随时一键还原）",
    "dangerLevel": "high",
    "payload": {{}}
  }}
  ```
"""


@router.get("/sessions")
def get_user_sessions(current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = current_user["id"]
    return storage_db.get_user_chat_sessions(user_id)


@router.post("/sessions")
def create_new_session(
    payload: Dict[str, Any] = {},
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["id"]
    title = payload.get("title", "新对话")
    session_id = storage_db.create_chat_session(user_id, title)
    return {"sessionId": session_id, "title": title}


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["id"]
    ok = storage_db.delete_chat_session(session_id, user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="会话不存在或已删除")
    return {"status": "ok"}


@router.get("/sessions/{session_id}/messages")
def get_session_messages(
    session_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["id"]
    session = storage_db.get_chat_session(session_id, user_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    return storage_db.get_session_messages(session_id)


@router.post("/chat")
def chat_stream(
    payload: ChatRequestPayload,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["id"]
    session_id = payload.sessionId

    if not session_id:
        session_id = storage_db.create_chat_session(user_id, "新对话")

    session = storage_db.get_chat_session(session_id, user_id)
    if not session:
        session_id = storage_db.create_chat_session(user_id, "新对话")
        session = storage_db.get_chat_session(session_id, user_id)

    # 取出最新一条用户消息并落库
    user_msg_content = payload.messages[-1].content if payload.messages else ""
    if user_msg_content:
        storage_db.add_chat_message(session_id, "user", user_msg_content)

    # 获取当前会话所有的历史消息
    all_db_msgs = storage_db.get_session_messages(session_id)

    # 自动生成对话标题（如果是第一条消息）
    if len(all_db_msgs) <= 2 and (session.get("title") == "新对话" or not session.get("title")):
        raw_title = user_msg_content.replace("\n", " ").strip()
        auto_title = raw_title[:12] + "..." if len(raw_title) > 12 else raw_title
        if auto_title:
            storage_db.update_chat_session(session_id, title=auto_title)

    # 智能上下文压缩算法 (Summary + Buffer Window)
    session_summary = session.get("summary")
    MAX_BUFFER_WINDOW = 6

    if len(all_db_msgs) > MAX_BUFFER_WINDOW + 2:
        old_msgs = all_db_msgs[:-MAX_BUFFER_WINDOW]
        summary_lines = [f"{m['role']}: {m['content'][:80]}" for m in old_msgs]
        new_summary = "早期对话要点：\n" + "\n".join(summary_lines[-6:])
        storage_db.update_chat_session(session_id, summary=new_summary)
        session_summary = new_summary

        llm_messages = [{"role": m["role"], "content": m["content"]} for m in all_db_msgs[-MAX_BUFFER_WINDOW:]]
    else:
        llm_messages = [{"role": m["role"], "content": m["content"]} for m in all_db_msgs]

    # 多模态图像格式转换 (OpenAI / Gemini Vision 兼容协议)
    user_images = payload.messages[-1].images if (payload.messages and payload.messages[-1].images) else None
    if user_images and llm_messages and llm_messages[-1]["role"] == "user":
        content_blocks: List[Dict[str, Any]] = [
            {"type": "text", "text": user_msg_content or "请帮我分析识别这张图片中的内容与关键信息"}
        ]
        for img_url in user_images:
            content_blocks.append({
                "type": "image_url",
                "image_url": {"url": img_url}
            })
        llm_messages[-1]["content"] = content_blocks

    requested_model = payload.model
    requested_mode = payload.mode or "finance"

    def event_generator():
        # 1. 第一毫秒立即建立 SSE 握手 (立刻向客户端返回 HTTP 200，绝不让网关超时)
        handshake_data = json.dumps({"content": "", "sessionId": session_id, "status": "connected"}, ensure_ascii=False)
        yield f"data: {handshake_data}\n\n"

        # 2. 在流生成器内部安全组装 System Prompt (带超时与容错保护)
        try:
            system_prompt = _build_system_prompt(
                user_id,
                session_summary,
                user_msg_content,
                mode=requested_mode,
                current_page=payload.currentPage,
                page_context=payload.pageContext,
            )
        except Exception as e:
            logger.error(f"组装 System Prompt 异常: {e}")
            system_prompt = "你是一名智能 AI 助手。请专业详尽地解答用户的问题。"

        llm = get_llm_provider(model=requested_model)

        full_reply = ""
        try:
            for chunk in llm.stream_chat(llm_messages, system_prompt, user_id=user_id, enable_tools=(requested_mode == "finance")):
                full_reply += chunk
                data = json.dumps({"content": chunk, "sessionId": session_id}, ensure_ascii=False)
                yield f"data: {data}\n\n"
            
            if full_reply.strip():
                storage_db.add_chat_message(session_id, "assistant", full_reply)

            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error(f"SSE 流生成错误: {e}")
            err_data = json.dumps({"content": f"\n\n[提示: AI 响应中断 ({str(e)})，建议切换上方模型重试]", "sessionId": session_id}, ensure_ascii=False)
            yield f"data: {err_data}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/diagnose")
def get_portfolio_diagnosis(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    user_id = current_user["id"]
    raw_assets = storage_db.get_all_assets(user_id)
    assets = _enrich_assets(raw_assets)
    total_val = sum(a["currentValue"] for a in assets)
    annual_income = sum(a.get("annualIncome", 0) or 0 for a in assets)
    yield_rate = round((annual_income / total_val * 100), 2) if total_val > 0 else 0.0

    overview = AKShareClient.get_market_overview()
    bond_10y = overview.get("bondYield10y", 1.71)

    top_asset = max(assets, key=lambda x: x["currentValue"]) if assets else None
    top_pct = round((top_asset["currentValue"] / total_val * 100), 1) if (top_asset and total_val > 0) else 0.0

    score = 88 if total_val > 0 else 60

    return {
        "score": score,
        "scoreLabel": "优秀" if score >= 85 else "良好",
        "yieldRate": yield_rate,
        "bondYield10y": bond_10y,
        "annualIncome": annual_income,
        "topAssetName": top_asset["name"] if top_asset else None,
        "topAssetPct": top_pct,
        "diagnosisText": [
            f"组合预估年被动收益 ¥{annual_income:,.2f}/年 (收益率 {yield_rate}%)，远超 10年国债收益率 ({bond_10y}%)，现金流安全垫充足。",
            f"第一大持仓【{top_asset['name'] if top_asset else '无'}】占比 {top_pct}%" + ("，注意控制单一标的集中度风险。" if top_pct > 35 else "，仓位分散度健康。"),
            "建议后续新增到账资金或利息优先补充【现金避险仓】或配置【红利低波 ETF】。",
        ],
        "updatedAt": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
    }
