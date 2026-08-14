import uuid
import datetime
import time
import asyncio
from typing import List, Dict, Any, Optional
from app.schemas.intelligence import (
    IntelligencePayload,
    ReportType,
    Severity,
    DecisionOption,
)
from app.api.xray import get_portfolio_xray
from app.data.storage import storage_db
from app.api.assets import _enrich_assets

_SENTINEL_SCAN_CACHE: Dict[str, Any] = {} # user_id -> (alerts, expire_at)

class SentinelRiskGenerator:
    """
    组合全景智能哨兵与四维风控扫描引擎 (带 TTL 防抖与非阻塞多线程计算)
    """

    async def scan_and_generate_alerts(self, user_id: str, force: bool = False) -> List[IntelligencePayload]:
        now_ts = time.time()
        # 60 秒内存防抖缓存，避免高频并发重复计算
        if not force and user_id in _SENTINEL_SCAN_CACHE:
            cached_alerts, expire_at = _SENTINEL_SCAN_CACHE[user_id]
            if now_ts < expire_at:
                return cached_alerts

        # 在独立工作线程中执行耗时的 X-Ray 和资产富化计算，绝不阻塞 FastAPI 主事件循环
        def _compute():
            try:
                xray_data = get_portfolio_xray({"id": user_id})
                if not xray_data or xray_data.get("totalValue", 0) <= 0:
                    return []

                alerts: List[IntelligencePayload] = []
                now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

                total_value = float(xray_data.get("totalValue", 0))
                sectors = xray_data.get("sectorBreakdown", [])
                stress_tests = xray_data.get("stressTesting", [])

                raw_assets = storage_db.get_all_assets(user_id)
                enriched = _enrich_assets(raw_assets)

                # ─── 规则 1：权益行业隐形穿透集中度红线 (>28%) ──────────────────
                for sec in sectors:
                    ratio = float(sec.get("pct", 0))
                    sec_name = sec.get("sector", "")
                    if ratio >= 28.0 and not any(k in sec_name for k in ("固收", "现金", "存款", "理财", "债券", "货币")):
                        rule_code = f"SECTOR_CONCENTRATION_{sec_name}"
                        title = f"【集中度预警】{sec_name} 行业穿透敞口达 {ratio:.1f}%，突破 28% 安全线"
                        summary = f"您的组合在【{sec_name}】板块的底层穿透暴露已达 {ratio:.1f}%，面临较高的单一行业周期共振风险。"
                        
                        md = f"""### 🚨 隐形集中度失衡分析
- **涉及行业**：{sec_name}
- **穿透占比**：**{ratio:.1f}%**（机构安全预警线为 28.0%）
- **暴露总市值**：¥{sec.get('amount', 0):,.2f}
- **穿透包含标的**：{', '.join(sec.get('holdings', []))}

#### ⚠️ 潜在风险
当该行业遭遇政策调整、周期见顶或黑天鹅事件时，组合整体净值将承受不成比例的下行冲击。"""

                        options = [
                            DecisionOption(
                                key="OPTION_A",
                                name="【暂不调整，密切跟踪】",
                                tag="保守方案",
                                analysis=f"若您对【{sec_name}】行业的长期高股息或成长逻辑具备极强信心，可保持现状，但建议暂停向该板块追加新增资金。",
                                action_type="HOLD",
                            ),
                            DecisionOption(
                                key="OPTION_B",
                                name="【跨行业再平衡置换】",
                                tag="推荐优化",
                                analysis=f"在券商端减持部分【{sec_name}】浮盈标的，将敞口降至 22% 左右，分流资金至公用事业、海外标的或高股息央企，降低整体相关性。",
                                action_type="REBALANCE",
                            ),
                            DecisionOption(
                                key="OPTION_C",
                                name="【部分止盈，充实固收底仓】",
                                tag="绝对防守",
                                analysis="将超额仓位兑现为无风险大额存单或逆回购，直接将固收安全垫提升 5 个百分点，全面抵御系统性波动。",
                                action_type="TAKE_PROFIT",
                            ),
                        ]

                        alerts.append(IntelligencePayload(
                            id=str(uuid.uuid4()),
                            report_type=ReportType.SENTINEL_ALERT,
                            severity=Severity.WARNING,
                            user_id=user_id,
                            title=title,
                            summary=summary,
                            markdown_content=md,
                            symbol=None,
                            symbol_name=sec_name,
                            structured_metrics={
                                "rule_code": rule_code,
                                "category": "STRUCTURE",
                                "sector_name": sec_name,
                                "ratio": ratio,
                                "amount": sec.get("amount", 0),
                            },
                            decision_options=options,
                            created_at=now_str,
                        ))

                # ─── 规则 2：重仓标的股息利差收窄 (性价比降低) ──────────────
                for stk in enriched:
                    if stk.get("category") in ("STOCK", "FUND"):
                        div_yield = float(stk.get("dividendYield") or stk.get("dividend_yield") or 0.0)
                        amount = float(stk.get("currentValue") or stk.get("amount") or 0.0)
                        weight = (amount / total_value * 100) if total_value > 0 else 0
                        code = stk.get("code", "")
                        name = stk.get("name", "")

                        if weight >= 3.0 and 0 < div_yield < 3.5:
                            rule_code = f"DIVIDEND_SPREAD_NARROW_{code}"
                            title = f"【性价比提示】{name}({code}) 动态股息率降至 {div_yield:.2f}%"
                            summary = f"【{name}】近期估值修复，动态股息率降至 {div_yield:.2f}%，与 10 年期国债息差收窄，持有性价比有所弱化。"
                            
                            md = f"""### 📊 股息性价比与估值分析
- **标的代码**：{name} ({code})
- **当前持仓占比**：{weight:.2f}% (市值 ¥{amount:,.2f})
- **动态股息率**：**{div_yield:.2f}%** (10年期国债基准收益率为 1.70%，利差仅剩 {div_yield - 1.70:.2f}%)
- **持仓盈亏**：{stk.get('profitPct', 0):+.2f}%

#### 💡 逻辑研判
该标的股价经过前期上涨后，股息回报对国债的吸引力逐渐钝化，资金继续追高的性价比减弱。"""

                            options = [
                                DecisionOption(
                                    key="OPTION_A",
                                    name="【坐享分红，持股不动】",
                                    tag="保守方案",
                                    analysis="若建仓成本较低、买入股息率依然很高，可继续持有获取确定性分红现金流，忽略短期价格波动。",
                                    action_type="HOLD",
                                ),
                                DecisionOption(
                                    key="OPTION_B",
                                    name="【向上置换更高股息标的】",
                                    tag="推荐优化",
                                    analysis=f"在券商分批减持部分 {name}，调仓至股息率在 5.5%~6.5% 的低估龙头，**年化被动现金流可预期提升约 30%**。",
                                    action_type="REBALANCE",
                                ),
                                DecisionOption(
                                    key="OPTION_C",
                                    name="【分批止盈锁定收益】",
                                    tag="绝对防守",
                                    analysis="减持部分累计浮盈，落袋为安，等待该标的回调至股息率 > 5.0% 再度吸筹。",
                                    action_type="TAKE_PROFIT",
                                ),
                            ]

                            alerts.append(IntelligencePayload(
                                id=str(uuid.uuid4()),
                                report_type=ReportType.SENTINEL_ALERT,
                                severity=Severity.INFO,
                                user_id=user_id,
                                title=title,
                                summary=summary,
                                markdown_content=md,
                                symbol=code,
                                symbol_name=name,
                                structured_metrics={
                                    "rule_code": rule_code,
                                    "category": "VALUATION",
                                    "code": code,
                                    "dividend_yield": div_yield,
                                    "weight": weight,
                                },
                                decision_options=options,
                                created_at=now_str,
                            ))

                # ─── 规则 3：大类资产防守垫与现金流配置分析 ─────────────────
                fixed_income_ratio = 0.0
                for sec in sectors:
                    sec_n = sec.get("sector", "")
                    if any(k in sec_n for k in ("固收", "现金", "存款", "理财", "债券", "货币")):
                        fixed_income_ratio += float(sec.get("pct", 0))

                if fixed_income_ratio < 10.0 and total_value > 50000:
                    rule_code = "SAFETY_BUFFER_LOW"
                    title = f"【防守垫告警】组合固收与现金储备仅 {fixed_income_ratio:.1f}%，低于 10% 安全红线"
                    summary = "当前全天候防御垫较薄弱，若遭遇跨市场权益共振回撤，组合将缺乏逆势加仓与平滑净值的缓冲弹药。"
                    
                    md = f"""### 🛡️ 组合抗风险防御垫深度体检
- **当前现金与稳健固收比例**：**{fixed_income_ratio:.1f}%**
- **全天候稳健建议比例**：15.0% ~ 30.0%
- **当前权益风险敞口**：{100.0 - fixed_income_ratio:.1f}%

#### ⚠️ 潜在隐患
高权益占比组合在单边上涨行情中弹性极大，但在震荡筑底期缺乏“流动性水塘”，极易导致投资者在底部因现金流紧张而被迫减仓。"""

                    options = [
                        DecisionOption(
                            key="OPTION_A",
                            name="【维持现状，激进进攻】",
                            tag="高风险偏好",
                            analysis="若您拥有充足的场外工薪增量现金流，且风险承受力极高，可维持全权益配置。",
                            action_type="HOLD",
                        ),
                        DecisionOption(
                            key="OPTION_B",
                            name="【增量资金优先注入固收】",
                            tag="推荐优化",
                            analysis="将近期即将到账的股息分红或外部增量资金（如年终奖/闲置资金）优先配置为 2.5% 稳健存款，逐步将防御垫补齐至 15%。",
                            action_type="INJECT_CASH",
                        ),
                    ]

                    alerts.append(IntelligencePayload(
                        id=str(uuid.uuid4()),
                        report_type=ReportType.SENTINEL_ALERT,
                        severity=Severity.WARNING,
                        user_id=user_id,
                        title=title,
                        summary=summary,
                        markdown_content=md,
                        symbol=None,
                        symbol_name="防守资金池",
                        structured_metrics={
                            "rule_code": rule_code,
                            "category": "STRUCTURE",
                            "fixed_income_ratio": fixed_income_ratio,
                        },
                        decision_options=options,
                        created_at=now_str,
                    ))

                elif fixed_income_ratio >= 80.0 and total_value > 50000:
                    rule_code = "FIXED_INCOME_DOMINANT"
                    title = f"【大类配置提示】固收与稳健防御占比达 {fixed_income_ratio:.1f}%，组合抗通胀弹性偏低"
                    summary = f"您的总资产中有 {fixed_income_ratio:.1f}% 配置在极度安全的固收/定期中，底仓极其坚固，但整体被动现金流增速受限于低利率环境。"
                    
                    md = f"""### 🏦 大类资产配置与现金流升级透视
- **当前稳健固收占比**：**{fixed_income_ratio:.1f}%** (市值约 ¥{total_value * fixed_income_ratio / 100:,.2f})
- **权益及全球资产占比**：{100.0 - fixed_income_ratio:.1f}%
- **当前组合总健康得分**：{xray_data.get('healthScore', 80)} 分

#### 💡 优化思路
在 10 年期国债收益率长期处于 1.7% 低位的背景下，可利用**「固收产生的利息」**进行高股息再投资，实现“本金绝对保本，利息博取高分红与复利”。"""

                    options = [
                        DecisionOption(
                            key="OPTION_A",
                            name="【坚守绝对保本，不作变动】",
                            tag="极度保守",
                            analysis="若该资金为未来 1~2 年内有刚性支出需求（如购房/购车/学费），维持高固收是最理性的决策。",
                            action_type="HOLD",
                        ),
                        DecisionOption(
                            key="OPTION_B",
                            name="【利息现金流定投高股息】",
                            tag="推荐优化",
                            analysis="本金完全不动，将每月到账的利息按月定投 5.5%~6.5% 股息率的央国企公用事业龙头，在零本金风险下增厚年化收益。",
                            action_type="REINVEST_DIVIDEND",
                        ),
                        DecisionOption(
                            key="OPTION_C",
                            name="【分步置换 10% 核心红利资产】",
                            tag="收益增强",
                            analysis="在到期日将 10% 存单资金分流至中证红利低波 ETF，预计可将整个组合的年化现金流提升 +¥5,000 以上。",
                            action_type="REBALANCE",
                        ),
                    ]

                    alerts.append(IntelligencePayload(
                        id=str(uuid.uuid4()),
                        report_type=ReportType.SENTINEL_ALERT,
                        severity=Severity.OPPORTUNITY,
                        user_id=user_id,
                        title=title,
                        summary=summary,
                        markdown_content=md,
                        symbol=None,
                        symbol_name="资产配置天平",
                        structured_metrics={
                            "rule_code": rule_code,
                            "category": "OPPORTUNITY",
                            "fixed_income_ratio": fixed_income_ratio,
                        },
                        decision_options=options,
                        created_at=now_str,
                    ))

                # ─── 规则 4：压力测试回撤敏感度预警 ────────────────────────
                for st in stress_tests:
                    loss_pct = abs(float(st.get("impactPct", 0)))
                    loss_amount = abs(float(st.get("impactAmount", 0)))
                    scenario_name = st.get("scenario", "")
                    if loss_pct >= 10.0 and loss_amount >= 30000:
                        rule_code = f"STRESS_TEST_HIGH_DRAWDOWN_{st.get('id', '')}"
                        title = f"【压力测试】在「{scenario_name}」情景下，预估浮亏 ¥{loss_amount:,.0f} (-{loss_pct:.1f}%)"
                        summary = f"根据全景 X 光模型推演，在极端宏观冲击「{scenario_name}」发生时，组合预计回撤达 ¥{loss_amount:,.0f}。"
                        
                        md = f"""### 🌪️ 极端宏观压力测试结果
- **压力情景**：{scenario_name}
- **情景假设**：{st.get('description', '')}
- **预估最大回撤金额**：**-¥{loss_amount:,.2f}**
- **预估组合净值缩水**：**-{loss_pct:.2f}%**

#### 🛡️ 韧性评估
该情景击穿了普通投资者的常规心理防线，建议检查是否配置了低相关性的黄金或对冲资产。"""

                        options = [
                            DecisionOption(
                                key="OPTION_A",
                                name="【穿越周期，承受波动】",
                                tag="长期主义",
                                analysis="如果组合内资产皆为现金流充沛的高股息分红龙头，价格浮亏并不影响分红现金到账，可坦然应对。",
                                action_type="HOLD",
                            ),
                            DecisionOption(
                                key="OPTION_B",
                                name="【增配对冲资产 (如黄金/公用)】",
                                tag="推荐优化",
                                analysis="引入 5%~10% 黄金 ETF 或公用事业资产，与权益市场形成天然负相关，可将该情景下的回撤幅度压缩 35% 以上。",
                                action_type="HEDGE",
                            ),
                        ]

                        alerts.append(IntelligencePayload(
                            id=str(uuid.uuid4()),
                            report_type=ReportType.SENTINEL_ALERT,
                            severity=Severity.WARNING,
                            user_id=user_id,
                            title=title,
                            summary=summary,
                            markdown_content=md,
                            symbol=None,
                            symbol_name=scenario_name,
                            structured_metrics={
                                "rule_code": rule_code,
                                "category": "RISK",
                                "scenario_name": scenario_name,
                                "loss_pct": loss_pct,
                                "loss_amount": loss_amount,
                            },
                            decision_options=options,
                            created_at=now_str,
                        ))

                return alerts
            except Exception as e:
                print(f"[SentinelRiskGenerator] Error computing alerts: {e}")
                return []

        res = await asyncio.to_thread(_compute)
        _SENTINEL_SCAN_CACHE[user_id] = (res, now_ts + 60.0) # 缓存 60 秒
        return res

sentinel_risk_generator = SentinelRiskGenerator()
