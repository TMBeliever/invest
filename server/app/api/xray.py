import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Depends
from app.services.auth import get_current_user
from app.data.storage import storage_db
from app.api.assets import _enrich_assets

logger = logging.getLogger(__name__)
router = APIRouter()

# 申万一级行业常用标的映射表 (高精度匹配)
STOCK_INDUSTRY_MAP = {
    # 银行
    "600036": "银行", "601398": "银行", "601288": "银行", "601939": "银行", "601988": "银行",
    "601166": "银行", "600000": "银行", "601818": "银行", "601998": "银行", "000001": "银行",
    "601328": "银行", "601658": "银行", "600016": "银行", "600919": "银行", "601229": "银行",
    # 公用事业 / 电力
    "600900": "公用事业", "600795": "公用事业", "600011": "公用事业", "600027": "公用事业",
    "600886": "公用事业", "000027": "公用事业", "600025": "公用事业", "000543": "公用事业",
    "600863": "公用事业", "600905": "公用事业", "601991": "公用事业",
    # 交通运输 / 公路港口航运
    "000429": "交通运输", "600018": "交通运输", "601919": "交通运输", "601006": "交通运输",
    "600026": "交通运输", "601872": "交通运输", "600377": "交通运输", "600033": "交通运输",
    # 煤炭 / 石油石化
    "601088": "煤炭开采", "601898": "煤炭开采", "600188": "煤炭开采", "601225": "煤炭开采",
    "600971": "煤炭开采", "601857": "石油石化", "600028": "石油石化", "600938": "石油石化",
    # 医药生物 / 基础化工
    "002001": "医药生物", "600276": "医药生物", "000538": "医药生物", "600803": "公用事业",
    "600309": "基础化工", "000333": "家用电器", "000651": "家用电器", "600690": "家用电器",
    "600519": "食品饮料", "000858": "食品饮料", "600887": "食品饮料",
    # 电子 / 计算机 / 科技
    "300750": "电力设备", "002594": "汽车制造", "601318": "非银金融", "600030": "非银金融",
    "00700": "互联网科技", "09988": "互联网科技", "AAPL": "全球科技", "NVDA": "全球科技",
    "TSLA": "全球科技", "MSFT": "全球科技", "GOOGL": "全球科技", "AMZN": "全球科技",
}

# 基金底层资产与行业穿透特征模型
FUND_LOOKTHROUGH_PROFILES = {
    # 红利低波 / 高股息 ETF 类
    "512890": {"银行": 0.35, "煤炭开采": 0.25, "交通运输": 0.20, "公用事业": 0.15, "其他": 0.05},
    "510880": {"银行": 0.40, "交通运输": 0.20, "公用事业": 0.20, "煤炭开采": 0.15, "其他": 0.05},
    "159708": {"煤炭开采": 0.30, "银行": 0.25, "公用事业": 0.25, "交通运输": 0.15, "其他": 0.05},
    "515180": {"银行": 0.35, "公用事业": 0.25, "石油石化": 0.20, "基础化工": 0.15, "其他": 0.05},
    # 海外 QDII / 纳斯达克 100 / 标普 500
    "016452": {"全球信息科技": 0.65, "可选消费": 0.18, "通信服务": 0.12, "其他": 0.05},
    "018043": {"全球信息科技": 0.65, "可选消费": 0.18, "通信服务": 0.12, "其他": 0.05},
    "019547": {"全球信息科技": 0.65, "可选消费": 0.18, "通信服务": 0.12, "其他": 0.05},
    "015299": {"全球信息科技": 0.65, "可选消费": 0.18, "通信服务": 0.12, "其他": 0.05},
    "513100": {"全球信息科技": 0.65, "可选消费": 0.18, "通信服务": 0.12, "其他": 0.05},
    "159941": {"全球信息科技": 0.65, "可选消费": 0.18, "通信服务": 0.12, "其他": 0.05},
}


def _classify_industry(code: Optional[str], name: str) -> str:
    """个股/资产名称快速行业分类器"""
    c = str(code or "").strip()
    if c in STOCK_INDUSTRY_MAP:
        return STOCK_INDUSTRY_MAP[c]
    
    # 语义关键词模糊归类
    if any(k in name for k in ["银行", "农商", "行"]):
        return "银行"
    if any(k in name for k in ["电力", "水务", "燃气", "能源", "热电", "核电", "水电"]):
        return "公用事业"
    if any(k in name for k in ["高速", "港口", "航空", "海运", "物流", "铁路"]):
        return "交通运输"
    if any(k in name for k in ["煤", "矿", "油", "石化"]):
        return "煤炭开采"
    if any(k in name for k in ["药", "生物", "医疗", "基因"]):
        return "医药生物"
    if any(k in name for k in ["酒", "乳", "食品", "饮料", "调味"]):
        return "食品饮料"
    if any(k in name for k in ["科技", "芯片", "半导体", "软件", "电子", "智能"]):
        return "信息科技"
    if any(k in name for k in ["证券", "保险", "信托"]):
        return "非银金融"
    if any(k in name for k in ["纳斯达克", "标普", "美股", "海外"]):
        return "全球科技"
    return "综合其他"


@router.get("/xray")
def get_portfolio_xray(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    资产组合全景 X 光与风险透视接口：
    1. 底层行业穿透与集中度暴露 (Look-through Exposure & CR3/HHI)
    2. 五维因子雷达矩阵 (High-Dividend, Fixed-Income, Tech, Mega-Value, Cash)
    3. 宏观极端情景压力测试 (Scenario Stress Testing)
    4. 综合健康得分与量化诊断
    """
    user_id = current_user["id"]
    raw_assets = storage_db.get_all_assets(user_id)
    enriched = _enrich_assets(raw_assets)

    if not enriched:
        return {
            "totalValue": 0.0,
            "healthScore": 100,
            "cr3": 0.0,
            "hhi": 0,
            "concentrationRisk": "LOW",
            "sectorBreakdown": [],
            "factorRadar": {
                "user": {"highDividend": 0, "fixedIncome": 0, "globalGrowth": 0, "megaValue": 0, "cashSafety": 100},
                "benchmark": {"highDividend": 25, "fixedIncome": 30, "globalGrowth": 20, "megaValue": 15, "cashSafety": 10}
            },
            "stressTesting": [],
            "diagnosis": {
                "summary": "暂未录入资产，请先录入持仓生成专属 X 光体检报告。",
                "strengths": ["暂无风险暴露"],
                "risks": [],
                "suggestions": ["点击右上角录入持仓以开启全景透视"]
            }
        }

    total_value = sum(float(a.get("currentValue") or 0.0) for a in enriched)
    if total_value <= 0:
        total_value = 1.0

    # ─── 1. 底层行业穿透与权重拆解 ──────────────────────────────────
    sector_weights: Dict[str, float] = {}

    # 五维因子初始化 (金额累加)
    factor_values = {
        "highDividend": 0.0,   # 高股息红利收息
        "fixedIncome": 0.0,    # 稳健固收 (纯债/理财)
        "globalGrowth": 0.0,   # 全球/海外科技成长 (纳指/科技)
        "megaValue": 0.0,      # 大盘价值
        "cashSafety": 0.0,     # 流动性现金与活期定存
    }

    for a in enriched:
        cat = a.get("category")
        val = float(a.get("currentValue") or 0.0)
        code = str(a.get("code") or "")
        name = str(a.get("name") or "")
        fund_type = a.get("fundType")

        if cat == "DEPOSIT":
            # 存款现金 -> 流动性现金安全垫
            sector = "现金与银行存款"
            sector_weights[sector] = sector_weights.get(sector, 0.0) + val
            factor_values["cashSafety"] += val

        elif cat == "WEALTH":
            # 银行理财 -> 固收防守
            sector = "稳健银行理财"
            sector_weights[sector] = sector_weights.get(sector, 0.0) + val
            factor_values["fixedIncome"] += val

        elif cat == "FUND":
            # 基金：区分纯债固收、海外QDII、红利ETF与常规公募
            if any(k in name for k in ["债", "恒乐", "稳福", "稳泰", "丰德", "盈润", "汇享", "稳悦", "信用"]):
                sector = "债券与固收基金"
                sector_weights[sector] = sector_weights.get(sector, 0.0) + val
                factor_values["fixedIncome"] += val
            elif code in FUND_LOOKTHROUGH_PROFILES:
                # 命中精细穿透表
                profile = FUND_LOOKTHROUGH_PROFILES[code]
                for sec, weight in profile.items():
                    sector_weights[sec] = sector_weights.get(sec, 0.0) + val * weight
                
                if "纳斯达克" in name or "标普" in name or code in ("016452", "018043", "019547", "015299", "513100"):
                    factor_values["globalGrowth"] += val
                else:
                    factor_values["highDividend"] += val * 0.8
                    factor_values["megaValue"] += val * 0.2
            elif any(k in name for k in ["纳斯达克", "标普", "海外", "美股", "QDII"]):
                sector = "全球信息科技"
                sector_weights[sector] = sector_weights.get(sector, 0.0) + val
                factor_values["globalGrowth"] += val
            elif any(k in name for k in ["红利", "高股息", "价值"]):
                sector = "高股息周期红利"
                sector_weights[sector] = sector_weights.get(sector, 0.0) + val
                factor_values["highDividend"] += val * 0.8
                factor_values["megaValue"] += val * 0.2
            else:
                sector = "公募权益综合"
                sector_weights[sector] = sector_weights.get(sector, 0.0) + val
                factor_values["megaValue"] += val

        elif cat == "STOCK":
            # 股票标的穿透
            ind = _classify_industry(code, name)
            sector_weights[ind] = sector_weights.get(ind, 0.0) + val
            div_yield = float(a.get("dividendYield") or 0.0)
            if div_yield >= 3.5 or ind in ("银行", "公用事业", "煤炭开采", "交通运输"):
                factor_values["highDividend"] += val * 0.7
                factor_values["megaValue"] += val * 0.3
            elif ind in ("全球科技", "信息科技"):
                factor_values["globalGrowth"] += val
            else:
                factor_values["megaValue"] += val

        else:
            sector = "其他类别资产"
            sector_weights[sector] = sector_weights.get(sector, 0.0) + val
            factor_values["cashSafety"] += val

    # 排序并生成行业穿透分布列表
    sector_list = []
    sector_colors = [
        "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6",
        "#06b6d4", "#f97316", "#14b8a6", "#6366f1", "#84cc16"
    ]
    sorted_sectors = sorted(sector_weights.items(), key=lambda x: x[1], reverse=True)

    for idx, (sec_name, sec_val) in enumerate(sorted_sectors):
        pct = round(sec_val / total_value * 100, 2)
        if pct > 0:
            sector_list.append({
                "sector": sec_name,
                "value": round(sec_val, 2),
                "pct": pct,
                "color": sector_colors[idx % len(sector_colors)],
                "isConcentrated": pct > 28.0 and sec_name not in ("现金与银行存款", "债券与固收基金"),
            })

    # ─── 2. 集中度指标计算 (CR3 & HHI) ─────────────────────────────
    # 剔除纯现金和纯固收后的风险行业 CR3
    risk_sectors = [s for s in sector_list if s["sector"] not in ("现金与银行存款", "债券与固收基金")]
    cr3 = round(sum(s["pct"] for s in risk_sectors[:3]), 1) if risk_sectors else 0.0
    hhi = int(sum((s["pct"]) ** 2 for s in sector_list))

    if cr3 > 60.0 or hhi > 3000:
        concentration_risk = "HIGH"
    elif cr3 > 40.0 or hhi > 2000:
        concentration_risk = "MEDIUM"
    else:
        concentration_risk = "LOW"

    # ─── 3. 五维因子雷达标准化 ──────────────────────────────────────
    factor_radar_user = {
        k: round(v / total_value * 100, 1) for k, v in factor_values.items()
    }
    factor_radar_benchmark = {
        "highDividend": 30.0,
        "fixedIncome": 30.0,
        "globalGrowth": 20.0,
        "megaValue": 10.0,
        "cashSafety": 10.0,
    }

    # ─── 4. 宏观极端情景压力测试 (Scenario Stress Testing) ───────────
    # 模拟 4 种经典冲击对组合净值的影响
    stress_results = []

    # 情景 1: 纳指科技深度回调 (-10%)
    growth_val = factor_values["globalGrowth"]
    growth_impact = -0.10 * growth_val
    growth_pct = round(growth_impact / total_value * 100, 2)
    stress_results.append({
        "id": "SCENARIO_NASDAQ_CORRECTION",
        "title": "纳指科技深度回调 (-10%)",
        "badge": "海外成长压力",
        "badgeColor": "text-rose-400 bg-rose-500/10 border-rose-500/30",
        "description": "模拟全球科技成长股遇估值杀跌，纳斯达克 100 指数单周下跌 10%",
        "impactValue": round(growth_impact, 2),
        "impactPct": growth_pct,
        "resilienceScore": "防守极强" if abs(growth_pct) < 2.0 else ("中度波及" if abs(growth_pct) < 5.0 else "高弹性暴露"),
        "analysis": f"您的海外科技敞口占总资产 {factor_radar_user['globalGrowth']}%，若纳指回调 10%，总资产预估波动 {growth_pct}% (约 ¥{abs(growth_impact):,.2f})。"
    })

    # 情景 2: 央行降息 25bp 宽松 (+债基升值 & 红利吸金)
    fixed_val = factor_values["fixedIncome"]
    div_val = factor_values["highDividend"]
    rate_cut_impact = (0.018 * fixed_val) + (0.025 * div_val)
    rate_cut_pct = round(rate_cut_impact / total_value * 100, 2)
    stress_results.append({
        "id": "SCENARIO_RATE_CUT",
        "title": "央行降息 25bp 宽松窗口",
        "badge": "流动性利好",
        "badgeColor": "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
        "description": "央行下调政策利率 25bp，无风险利率下行，带动纯债走牛与高股息资产重估",
        "impactValue": round(rate_cut_impact, 2),
        "impactPct": rate_cut_pct,
        "resilienceScore": "显著受益" if rate_cut_pct > 1.0 else "温和受益",
        "analysis": f"组合中固收稳健资产与高股息资产合计占比 {round(factor_radar_user['fixedIncome'] + factor_radar_user['highDividend'], 1)}%，降息周期下预估组合净值增厚 +{rate_cut_pct}% (约 +¥{rate_cut_impact:,.2f})。"
    })

    # 情景 3: A 股市场极端普跌 (-15%)
    stock_equity_val = factor_values["megaValue"] + (factor_values["highDividend"] * 0.8)
    # 高股息抗跌系数约 0.65，常规权益 1.0
    bear_impact = -(0.15 * factor_values["megaValue"] + 0.09 * (factor_values["highDividend"] * 0.8))
    bear_pct = round(bear_impact / total_value * 100, 2)
    stress_results.append({
        "id": "SCENARIO_A_SHARE_BEAR",
        "title": "A 股全市场极端探底 (-15%)",
        "badge": "极端黑天鹅防御",
        "badgeColor": "text-amber-400 bg-amber-500/10 border-amber-500/30",
        "description": "模拟大盘指数单月普跌 15%，检验现金仓与固收资产对整个组合的真实防御垫厚度",
        "impactValue": round(bear_impact, 2),
        "impactPct": bear_pct,
        "resilienceScore": "钢铁防守" if abs(bear_pct) < 5.0 else ("稳健适中" if abs(bear_pct) < 10.0 else "高贝塔偏大"),
        "analysis": f"得益于您的现金仓与固收垫，在大盘暴跌 15% 时，您的真实组合仅回撤 {bear_pct}%，展现出远优于大盘的避险抗震能力！"
    })

    # 情景 4: 红利与顺周期爆发 (+8%)
    dividend_rally_impact = 0.08 * factor_values["highDividend"]
    dividend_rally_pct = round(dividend_rally_impact / total_value * 100, 2)
    stress_results.append({
        "id": "SCENARIO_DIVIDEND_RALLY",
        "title": "高股息与能源公用走强 (+8%)",
        "badge": "收息主线爆发",
        "badgeColor": "text-rose-400 bg-rose-500/10 border-rose-500/30",
        "description": "低利率环境下中特估、公用事业与红利资产迎来戴维斯双击",
        "impactValue": round(dividend_rally_impact, 2),
        "impactPct": dividend_rally_pct,
        "resilienceScore": "核心主线" if dividend_rally_pct > 2.0 else "温和收益",
        "analysis": f"高股息持仓带来稳健资本增值，预估增厚收益 +{dividend_rally_pct}% (约 +¥{dividend_rally_impact:,.2f})。"
    })

    # ─── 5. 综合健康得分与诊断建议 ──────────────────────────────────
    score = 100
    strengths = []
    risks = []
    suggestions = []

    # 防守力评分
    safety_ratio = factor_radar_user["cashSafety"] + factor_radar_user["fixedIncome"]
    if safety_ratio >= 30:
        strengths.append(f"安全边际极高：现金与固收资产占比 {safety_ratio:.1f}%，具备极强的抗暴跌与黑天鹅避险能力")
    elif safety_ratio < 15:
        score -= 15
        risks.append("防守垫偏薄：流动性现金与固收占比不足 15%，市场大幅震荡时缺乏抄底子弹")
        suggestions.append("建议适当将部分高位浮盈标的获利了结，补充 15%~20% 的纯债或定期存款")

    # 集中度评分
    if concentration_risk == "HIGH":
        score -= 20
        top_sec = risk_sectors[0]["sector"] if risk_sectors else "个别行业"
        top_pct = risk_sectors[0]["pct"] if risk_sectors else 0
        risks.append(f"行业过度集中：【{top_sec}】真实敞口高达 {top_pct}%，单一板块黑天鹅易对净值造成剧烈冲击")
        suggestions.append(f"建议逐步分散减持部分【{top_sec}】相关仓位，向其他低相关性资产分流")
    elif concentration_risk == "MEDIUM":
        score -= 5
        strengths.append("行业分散适中，无单一灾难性行业重仓敞口")
    else:
        strengths.append("资产分散度极佳，有效分散了非系统性行业风险")

    # 现金流与高股息评分
    if factor_radar_user["highDividend"] >= 20:
        strengths.append(f"被动现金流充沛：高股息核心资产占比 {factor_radar_user['highDividend']:.1f}%，持续提供稳定的分红现金流")
    else:
        suggestions.append("可适度关注股息率 5.5% 以上的公用事业与央国企龙头，增强被动收入底仓")

    # 全球化成长配比
    if factor_radar_user["globalGrowth"] >= 10:
        strengths.append(f"全球资产跨币种配置：海外科技成长资产占比 {factor_radar_user['globalGrowth']:.1f}%，享受全球科技红利")

    score = max(50, min(100, score))

    health_level = "卓越稳健" if score >= 90 else ("良好稳健" if score >= 80 else ("结构欠佳" if score >= 65 else "亟待优化"))

    diagnosis = {
        "healthLevel": health_level,
        "score": score,
        "strengths": strengths,
        "risks": risks,
        "suggestions": suggestions,
    }

    return {
        "totalValue": round(total_value, 2),
        "healthScore": score,
        "healthLevel": health_level,
        "cr3": cr3,
        "hhi": hhi,
        "concentrationRisk": concentration_risk,
        "sectorBreakdown": sector_list,
        "factorRadar": {
            "user": factor_radar_user,
            "benchmark": factor_radar_benchmark
        },
        "stressTesting": stress_results,
        "diagnosis": diagnosis,
    }
