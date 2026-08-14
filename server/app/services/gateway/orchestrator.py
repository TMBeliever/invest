import asyncio
import html
import json
import logging
import re
from typing import Any, Dict, Optional, List

from app.data.akshare_client import AKShareClient
from app.data.storage import storage_db
from app.services.ai_tools import (
    AI_TOOLS_DEFINITIONS,
    dispatch_ai_tool,
    execute_portfolio_summary,
    execute_portfolio_xray,
    execute_active_risk_alerts,
    execute_stock_quote,
    execute_financial_analysis,
)
from app.services.gateway.schemas import InboundMessage, OutboundResponse, PlatformType
from app.services.intelligence.morning_radar import morning_radar_generator
from app.services.intelligence.closing_review import closing_review_generator
from app.services.llm_provider import get_llm_provider

logger = logging.getLogger(__name__)

class AgentGatewayOrchestrator:
    """
    通用多平台双向 Agent 调度网关：
    处理来自 Telegram、飞书、企业微信、Discord、Slack 等任意平台的入站消息，
    支持秒级快捷指令、单股极速查询与自主 Tool-Calling Agent 对话推理。
    """

    def _markdown_to_telegram_html(self, text: str) -> str:
        """将标准 Markdown 转换为干净合法的 Telegram HTML (支持 <b>, <i>, <code>, <blockquote>)"""
        lines = []
        in_code_block = False
        for line in text.split("\n"):
            trimmed = line.strip()
            if trimmed.startswith("```"):
                in_code_block = not in_code_block
                lines.append("<code>" if in_code_block else "</code>")
                continue
            if in_code_block:
                lines.append(html.escape(line))
                continue

            if trimmed.startswith("### "):
                title_text = trimmed.replace("### ", "").strip()
                lines.append(f"\n<b>🔹 {html.escape(title_text)}</b>")
            elif trimmed.startswith("## "):
                title_text = trimmed.replace("## ", "").strip()
                lines.append(f"\n<b>📊 {html.escape(title_text)}</b>")
            elif trimmed.startswith("# "):
                title_text = trimmed.replace("# ", "").strip()
                lines.append(f"\n<b>🌟 {html.escape(title_text)}</b>")
            elif trimmed.startswith("- **") or trimmed.startswith("* **"):
                content = html.escape(trimmed.replace("- **", "").replace("* **", "").replace("**", ""))
                lines.append(f"• <b>{content}</b>")
            elif trimmed.startswith("- ") or trimmed.startswith("* "):
                content = html.escape(trimmed.replace("- ", "").replace("* ", ""))
                lines.append(f"• {content}")
            elif trimmed.startswith("> "):
                quote_text = html.escape(trimmed.replace("> ", ""))
                lines.append(f"<blockquote>{quote_text}</blockquote>")
            elif trimmed.startswith("---") or trimmed.startswith("***"):
                lines.append("──────────────")
            else:
                # 转换行内加粗和行内代码
                safe = html.escape(line)
                safe = re.sub(r"\*\*(.*?)\*\*", r"<b>\1</b>", safe)
                safe = re.sub(r"`(.*?)`", r"<code>\1</code>", safe)
                lines.append(safe)

        res = "\n".join(lines)
        # 移除过多空行
        res = re.sub(r"\n{3,}", "\n\n", res)
        return res.strip()

    async def handle_inbound(self, msg: InboundMessage) -> OutboundResponse:
        """主入口：统一处理各平台入站消息并生成出站回复"""
        raw_text = (msg.text or "").strip()
        logger.info(f"📥 [Gateway Inbound] Platform={msg.platform}, Sender={msg.sender_id}, Text={raw_text[:50]}")

        # 1. 用户鉴权与上下文绑定
        user = None
        if msg.platform == PlatformType.TELEGRAM:
            user = storage_db.find_user_by_telegram_chat_id(msg.chat_id)
        if not user and msg.user_id:
            user = {"id": msg.user_id, "username": "User"}

        effective_user_id = user["id"] if user else "default"
        username = user.get("username", "投资人") if user else "投资人"

        # 2. 快捷指令快速通道 (Slash Commands Fast-Path)
        cmd = raw_text.split()[0].lower() if raw_text.startswith("/") else ""

        if cmd in ("/start", "/help"):
            return self._handle_help(msg, username)

        elif cmd == "/summary":
            return await self._handle_summary(msg, effective_user_id)

        elif cmd == "/xray":
            return await self._handle_xray(msg, effective_user_id)

        elif cmd == "/alerts":
            return await self._handle_alerts(msg, effective_user_id)

        elif cmd == "/morning":
            return await self._handle_morning(msg)

        elif cmd == "/closing":
            return await self._handle_closing(msg)

        # 3. 股票/代码直接查询快速通道 (如用户直接输入 "招商银行" 或 "600036")
        if len(raw_text) <= 10 and not raw_text.startswith("/"):
            resolved = AKShareClient.resolve_symbol(raw_text)
            if resolved and len(resolved) == 6 and resolved.isdigit():
                return await self._handle_stock_fast_query(msg, raw_text, resolved)

        # 4. 深度 Agent 对话推理 (带 Function Calling 工具库)
        return await self._handle_agent_chat(msg, raw_text, effective_user_id, username)

    def _handle_help(self, msg: InboundMessage, username: str) -> OutboundResponse:
        html_text = f"""<b>🤖 InvestScope 投资决策双向 Agent 指南</b>
欢迎您，<b>{html.escape(username)}</b>！我是您的专属私人量化顾问。

<b>⚡ 快捷指令列表：</b>
• <code>/summary</code> - 实时持仓总览与年化分红现金流
• <code>/xray</code> - 全景 X-Ray 行业穿透与集中度体检
• <code>/alerts</code> - 查看当前持仓未处理的风险哨兵预警
• <code>/morning</code> - 获取今日早盘前瞻 (隔夜外盘/国债ERP)
• <code>/closing</code> - 获取今日收盘复盘 (大盘/申万资金流)
• <code>/help</code> - 查看本使用指南

<b>💬 自然语言智能问答：</b>
您可以直接向我发送任何投资问题，例如：
• <i>“帮我做一下持仓行业穿透分析”</i>
• <i>“如果央行降息25bp，我的组合压力测试如何？”</i>
• <i>“招商银行和中国神华对比一下”</i>
• <i>“输入股票代码（如 600036）直接获取秒级行情与财报体检”</i>"""

        return OutboundResponse(
            platform=msg.platform,
            chat_id=msg.chat_id,
            text="欢迎使用 InvestScope 双向 Agent！发送 /help 查看所有指令。",
            html=html_text,
            markdown=html_text.replace("<b>", "**").replace("</b>", "**").replace("<code>", "`").replace("</code>", "`"),
        )

    async def _handle_summary(self, msg: InboundMessage, user_id: str) -> OutboundResponse:
        res = await asyncio.to_thread(execute_portfolio_summary, user_id)
        if "error" in res:
            return OutboundResponse(
                platform=msg.platform,
                chat_id=msg.chat_id,
                text=f"获取资产总览失败: {res['error']}",
                html=f"❌ <b>获取资产总览失败</b>: {html.escape(res['error'])}"
            )

        total_val = res.get("totalValue", 0.0)
        total_profit = res.get("totalProfit", 0.0)
        annual_inc = res.get("annualIncome", 0.0)
        yield_rate = res.get("yieldRate", 0.0)
        count = res.get("assetsCount", 0)
        assets = res.get("assets", [])

        asset_lines = []
        for a in assets[:10]:
            name = html.escape(a.get("name", ""))
            val = a.get("currentValue", 0.0)
            p = a.get("profit")
            p_str = f" (+¥{p:,.2f})" if p and p > 0 else (f" (-¥{abs(p):,.2f})" if p and p < 0 else "")
            asset_lines.append(f"• <b>{name}</b>: ¥{val:,.2f}{p_str}")

        if count > 10:
            asset_lines.append(f"<i>... 等共 {count} 笔持仓标的</i>")

        assets_block = "\n".join(asset_lines) if asset_lines else "<i>暂无持仓资产数据</i>"

        html_text = f"""<b>💼 InvestScope 资产持仓实时总览</b>

💰 <b>总资产净值</b>: <code>¥{total_val:,.2f}</code>
📈 <b>持仓总浮盈</b>: <code>¥{total_profit:,.2f}</code>
💵 <b>预估年现金流(分红+利息)</b>: <code>¥{annual_inc:,.2f}</code>
🎯 <b>综合现金流收益率</b>: <code>{yield_rate}%</code>

<b>📋 核心资产明细 ({count} 笔)：</b>
{assets_block}

<i>💡 发送 /xray 调取底层行业穿透与集中度深度体检报告</i>"""

        return OutboundResponse(
            platform=msg.platform,
            chat_id=msg.chat_id,
            text=f"总资产: ¥{total_val:,.2f}, 年现金流: ¥{annual_inc:,.2f} ({yield_rate}%)",
            html=html_text,
        )

    async def _handle_xray(self, msg: InboundMessage, user_id: str) -> OutboundResponse:
        res = await asyncio.to_thread(execute_portfolio_xray, user_id)
        if "error" in res:
            return OutboundResponse(
                platform=msg.platform,
                chat_id=msg.chat_id,
                text=f"获取 X-Ray 体检失败: {res['error']}",
                html=f"❌ <b>获取 X-Ray 体检失败</b>: {html.escape(res['error'])}"
            )

        diag = res.get("diagnosis", {})
        score = diag.get("score", 85)
        level = diag.get("level", "健康")
        conc = res.get("concentration", {})
        cr3 = conc.get("cr3", 0.0)
        hhi = conc.get("hhi", 0.0)
        industries = res.get("industries", [])

        ind_lines = []
        for ind in industries[:5]:
            name = html.escape(ind.get("name", ""))
            weight = ind.get("weight", 0.0)
            amt = ind.get("amount", 0.0)
            ind_lines.append(f"• <b>{name}</b>: <code>{weight}%</code> (¥{amt:,.2f})")

        stress = res.get("stressTest", [])
        stress_lines = []
        for st in stress[:4]:
            s_name = html.escape(st.get("scenarioName", ""))
            s_impact = st.get("expectedImpactPct", 0.0)
            s_val = st.get("expectedImpactValue", 0.0)
            icon = "🟢" if s_impact >= 0 else "🔴"
            stress_lines.append(f"{icon} {s_name}: <b>{s_impact:+.2f}%</b> (¥{s_val:+,.2f})")

        html_text = f"""<b>🩻 InvestScope 全景 X-Ray 穿透体检</b>

🎯 <b>综合健康度评级</b>: <code>{score}分 · {level}</code>
📊 <b>CR3 行业集中度</b>: <code>{cr3}%</code> (HHI 指数: {hhi})

<b>🏭 底层穿透前 5 大行业敞口：</b>
{chr(10).join(ind_lines) if ind_lines else '暂无行业敞口数据'}

<b>⚡ 宏观极端情景压力测试：</b>
{chr(10).join(stress_lines) if stress_lines else '暂无压力测试数据'}

<i>💡 发送 /alerts 查看针对性 3 套调仓应对方案</i>"""

        return OutboundResponse(
            platform=msg.platform,
            chat_id=msg.chat_id,
            text=f"X-Ray 体检评级: {score}分 ({level}), CR3集中度: {cr3}%",
            html=html_text,
        )

    async def _handle_alerts(self, msg: InboundMessage, user_id: str) -> OutboundResponse:
        res = await asyncio.to_thread(execute_active_risk_alerts, user_id)
        active_count = res.get("activeCount", 0)
        alerts = res.get("alerts", [])

        if active_count == 0:
            html_text = """<b>🛡️ InvestScope 持仓风险哨兵</b>

✅ <b>太棒了！当前持仓未触发任何活跃风险预警。</b>
• 行业穿透敞口均衡，未出现单一行业 >28% 超标；
• 股息利差安全垫稳定；
• 现金流动性防御充足。"""
            return OutboundResponse(
                platform=msg.platform,
                chat_id=msg.chat_id,
                text="当前持仓未触发任何活跃风险预警，组合运行健康！",
                html=html_text,
            )

        alert_blocks = []
        for idx, alt in enumerate(alerts[:3], 1):
            title = html.escape(alt.get("title", ""))
            summary = html.escape(alt.get("summary", ""))
            opts = alt.get("decisionOptions", [])
            opt_str = ""
            if opts:
                opt_str = "\n  <b>🎯 应对方案:</b> " + " | ".join([f"<code>{html.escape(o.get('name', ''))}</code>" for o in opts])
            alert_blocks.append(f"<b>{idx}. 🚨 {title}</b>\n  {summary}{opt_str}")

        html_text = f"""<b>🛡️ InvestScope 持仓风险哨兵 (发现 {active_count} 处关注点)</b>

{chr(10).join(alert_blocks)}

<i>💡 您可直接向我提问：如“帮我深度推演第1个风险的方案B优化细节”</i>"""

        return OutboundResponse(
            platform=msg.platform,
            chat_id=msg.chat_id,
            text=f"持仓风险哨兵: 发现 {active_count} 处预警关注点",
            html=html_text,
        )

    async def _handle_morning(self, msg: InboundMessage) -> OutboundResponse:
        payload = await morning_radar_generator.generate()
        from app.services.dispatcher.telegram import TelegramAdapter
        adapter = TelegramAdapter()
        html_text = adapter._format_html_message(payload)
        return OutboundResponse(
            platform=msg.platform,
            chat_id=msg.chat_id,
            text=f"🌅 今日早盘前瞻: {payload.title}\n{payload.summary}",
            html=html_text,
        )

    async def _handle_closing(self, msg: InboundMessage) -> OutboundResponse:
        payload = await closing_review_generator.generate()
        from app.services.dispatcher.telegram import TelegramAdapter
        adapter = TelegramAdapter()
        html_text = adapter._format_html_message(payload)
        return OutboundResponse(
            platform=msg.platform,
            chat_id=msg.chat_id,
            text=f"🌆 今日收盘复盘: {payload.title}\n{payload.summary}",
            html=html_text,
        )

    async def _handle_stock_fast_query(self, msg: InboundMessage, query_str: str, code: str) -> OutboundResponse:
        q = await asyncio.to_thread(execute_stock_quote, code)
        f = await asyncio.to_thread(execute_financial_analysis, code)

        if "error" in q:
            return OutboundResponse(
                platform=msg.platform,
                chat_id=msg.chat_id,
                text=f"未找到股票 [{query_str}] 行情: {q['error']}",
                html=f"❌ <b>未找到股票 [{html.escape(query_str)}] 行情</b>: {html.escape(q['error'])}"
            )

        name = html.escape(q.get("name", query_str))
        price = q.get("price", 0.0)
        chg_pct = q.get("changePct", 0.0)
        chg = q.get("change", 0.0)
        dy = q.get("dividendYield", 0.0)
        pe = q.get("pe", 0.0)
        pb = q.get("pb", 0.0)
        icon = "🔴" if chg_pct > 0 else ("🟢" if chg_pct < 0 else "⚪")

        # 杜邦与排雷
        dupont = f.get("dupont", {}) if isinstance(f, dict) else {}
        roe = dupont.get("roe", "--")
        health = f.get("healthScan", {}) if isinstance(f, dict) else {}
        health_score = health.get("score", "--")
        health_level = health.get("level", "--")

        html_text = f"""<b>{icon} {name} (<code>{code}</code>) 实时量化速览</b>

💵 <b>最新股价</b>: <code>¥{price}</code> ({chg_pct:+.2f}%, {chg:+.2f})
📈 <b>动态股息率</b>: <code>{dy}%</code>
📊 <b>估值指标</b>: PE(TTM): <code>{pe}x</code> | PB: <code>{pb}x</code>
🏆 <b>杜邦拆解 ROE</b>: <code>{roe}%</code>
🛡️ <b>财报排雷体检</b>: <code>{health_score}分 · {health_level}</code>

<i>💡 发送“把{name}和长江电力对比”或“深度分析{name}”获取更多 AI 解读</i>"""

        return OutboundResponse(
            platform=msg.platform,
            chat_id=msg.chat_id,
            text=f"{name}({code}): ¥{price} ({chg_pct:+.2f}%), 股息率: {dy}%, ROE: {roe}%",
            html=html_text,
        )

    async def _handle_agent_chat(self, msg: InboundMessage, query: str, user_id: str, username: str) -> OutboundResponse:
        """运行完整 Agent 工具调度思考循环 (Tool-Calling Loop)"""
        llm = get_llm_provider()
        now_str = asyncio.get_event_loop().time()

        system_prompt = f"""你是一名精通个人资产配置、组合风险穿透与高股息量化策略的【InvestScope 智能 AI 投资顾问】。
当前对话用户: {username} (ID: {user_id})

[核心要求]:
1. 你拥有完整的系统级实时量化工具库（Tools）：
   - `get_portfolio_xray()`: 获取用户当前全部真实资产的【全景 X 光透视体检报告】
   - `get_portfolio_summary()`: 获取用户当前资产净值概况、持仓总浮盈、预估年现金流收益与资产清单
   - `get_active_risk_alerts()`: 获取用户持仓活跃的风险预警与 3 套应对方案
   - `get_stock_quote(symbol)`: 获取单只股票或ETF盘中秒级实时行情与股息率
   - `get_financial_analysis(symbol)`: 获取官方财报体检、杜邦 ROE 拆解与 4 大排雷指标
   - `get_stock_news(symbol)`: 获取最新资讯与分红公告
   - `compare_stocks(symbols)`: 多股横向对比矩阵
2. 当用户的提问涉及持仓、体检、个股行情、对比或宏观推演时，请主动调用工具获取真实数据后再作答！
3. 回答排版简洁优美，多用 Markdown 列表、加粗与重点标记，适合在手机聊天窗口阅读。"""

        try:
            full_response = await asyncio.to_thread(
                llm.chat_complete,
                messages=[{"role": "user", "content": query}],
                system_prompt=system_prompt,
                user_id=user_id,
                enable_tools=True
            )

            html_content = self._markdown_to_telegram_html(full_response)
            return OutboundResponse(
                platform=msg.platform,
                chat_id=msg.chat_id,
                text=full_response,
                html=html_content,
                markdown=full_response,
            )

        except Exception as e:
            logger.error(f"Agent 推理异常: {e}", exc_info=True)
            return OutboundResponse(
                platform=msg.platform,
                chat_id=msg.chat_id,
                text=f"AI 推理暂时遇到问题: {e}",
                html=f"❌ <b>AI 推理暂时遇到问题</b>: {html.escape(str(e))}"
            )

gateway_orchestrator = AgentGatewayOrchestrator()
