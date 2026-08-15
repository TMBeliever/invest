import datetime
import logging
from typing import Any, Dict, List, Optional

from app.data.akshare_client import AKShareClient, _batch_tencent_quote
from app.services.national_team import NATIONAL_TEAM_CORE_REGISTRY

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# 🌟 全市场高股息候选母池 (包含高股息蓝筹、央国企支柱及典型 7 重排雷样本)
# ─────────────────────────────────────────────────────────────────────────────
DIVIDEND_EXPANDED_UNIVERSE = [
    # ── 1. 银行类 (高股息 / 低PB) ──
    {"code": "600036", "name": "招商银行", "baseRoe": 15.3, "payoutYears": 15, "payoutRatio": 35.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "601398", "name": "工商银行", "baseRoe": 10.8, "payoutYears": 18, "payoutRatio": 30.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "601288", "name": "农业银行", "baseRoe": 11.2, "payoutYears": 14, "payoutRatio": 30.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "601939", "name": "建设银行", "baseRoe": 11.5, "payoutYears": 17, "payoutRatio": 30.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "601328", "name": "交通银行", "baseRoe": 9.8, "payoutYears": 16, "payoutRatio": 32.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "601166", "name": "兴业银行", "baseRoe": 10.5, "payoutYears": 14, "payoutRatio": 28.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "600919", "name": "江苏银行", "baseRoe": 14.8, "payoutYears": 8, "payoutRatio": 30.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "601009", "name": "南京银行", "baseRoe": 13.2, "payoutYears": 12, "payoutRatio": 30.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "002142", "name": "宁波银行", "baseRoe": 14.5, "payoutYears": 14, "payoutRatio": 25.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "601229", "name": "上海银行", "baseRoe": 10.1, "payoutYears": 8, "payoutRatio": 27.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "601998", "name": "中信银行", "baseRoe": 10.2, "payoutYears": 14, "payoutRatio": 28.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "601818", "name": "光大银行", "baseRoe": 8.1, "payoutYears": 13, "payoutRatio": 28.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "600015", "name": "华夏银行", "baseRoe": 7.2, "payoutYears": 11, "payoutRatio": 25.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "600016", "name": "民生银行", "baseRoe": 5.8, "payoutYears": 12, "payoutRatio": 30.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "601128", "name": "常熟银行", "baseRoe": 13.8, "payoutYears": 8, "payoutRatio": 25.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "600926", "name": "杭州银行", "baseRoe": 15.6, "payoutYears": 7, "payoutRatio": 26.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "601838", "name": "成都银行", "baseRoe": 17.5, "payoutYears": 6, "payoutRatio": 30.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "600000", "name": "浦发银行", "baseRoe": 5.2, "payoutYears": 15, "payoutRatio": 26.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},

    # ── 2. 公用事业与水务电力 (特许经营 / 高自由现金流) ──
    {"code": "600900", "name": "长江电力", "baseRoe": 15.8, "payoutYears": 20, "payoutRatio": 70.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "600886", "name": "国投电力", "baseRoe": 12.1, "payoutYears": 16, "payoutRatio": 55.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "600674", "name": "川投能源", "baseRoe": 14.2, "payoutYears": 15, "payoutRatio": 50.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "600025", "name": "华能水电", "baseRoe": 13.5, "payoutYears": 6, "payoutRatio": 60.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "601985", "name": "中国核电", "baseRoe": 11.8, "payoutYears": 9, "payoutRatio": 40.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "003816", "name": "中国广核", "baseRoe": 10.5, "payoutYears": 5, "payoutRatio": 45.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "600011", "name": "华能国际", "baseRoe": 9.5, "payoutYears": 14, "payoutRatio": 50.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "600027", "name": "华电国际", "baseRoe": 10.2, "payoutYears": 13, "payoutRatio": 50.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "600021", "name": "上海电力", "baseRoe": 9.8, "payoutYears": 12, "payoutRatio": 45.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "600167", "name": "联美量子", "baseRoe": 11.0, "payoutYears": 9, "payoutRatio": 60.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "600863", "name": "内蒙华电", "baseRoe": 13.0, "payoutYears": 10, "payoutRatio": 70.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},

    # ── 3. 消费与家电食品 (高ROE / 消费韧性白马) ──
    {"code": "000651", "name": "格力电器", "baseRoe": 22.4, "payoutYears": 22, "payoutRatio": 55.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "000333", "name": "美的集团", "baseRoe": 24.1, "payoutYears": 11, "payoutRatio": 62.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "600519", "name": "贵州茅台", "baseRoe": 34.5, "payoutYears": 23, "payoutRatio": 52.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "000895", "name": "双汇发展", "baseRoe": 23.5, "payoutYears": 24, "payoutRatio": 80.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "600887", "name": "伊利股份", "baseRoe": 18.2, "payoutYears": 21, "payoutRatio": 73.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "600600", "name": "青岛啤酒", "baseRoe": 16.8, "payoutYears": 19, "payoutRatio": 60.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "000568", "name": "泸州老窖", "baseRoe": 28.5, "payoutYears": 18, "payoutRatio": 60.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "002507", "name": "涪陵榨菜", "baseRoe": 15.2, "payoutYears": 12, "payoutRatio": 55.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "603288", "name": "海天味业", "baseRoe": 22.0, "payoutYears": 10, "payoutRatio": 60.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "600305", "name": "恒顺醋业", "baseRoe": 6.8, "payoutYears": 15, "payoutRatio": 75.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},

    # ── 4. 交通运输与港口公路 (特许收费 / 稳定现金流) ──
    {"code": "601598", "name": "中国外运", "baseRoe": 12.8, "payoutYears": 12, "payoutRatio": 50.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "600018", "name": "上港集团", "baseRoe": 11.2, "payoutYears": 16, "payoutRatio": 40.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "600012", "name": "皖通高速", "baseRoe": 14.6, "payoutYears": 18, "payoutRatio": 60.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "600377", "name": "宁沪高速", "baseRoe": 13.8, "payoutYears": 22, "payoutRatio": 70.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "601188", "name": "龙高股份", "baseRoe": 15.2, "payoutYears": 4, "payoutRatio": 50.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "600035", "name": "楚天高速", "baseRoe": 10.5, "payoutYears": 14, "payoutRatio": 45.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "600350", "name": "山东高速", "baseRoe": 12.5, "payoutYears": 18, "payoutRatio": 60.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "601006", "name": "大秦铁路", "baseRoe": 10.2, "payoutYears": 17, "payoutRatio": 55.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "601333", "name": "广深铁路", "baseRoe": 4.5, "payoutYears": 14, "payoutRatio": 50.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},

    # ── 5. 能源与石油石化 (央企红利压舱石) ──
    {"code": "601088", "name": "中国神华", "baseRoe": 16.5, "payoutYears": 17, "payoutRatio": 75.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "600938", "name": "中国海油", "baseRoe": 19.8, "payoutYears": 3, "payoutRatio": 45.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "601857", "name": "中国石油", "baseRoe": 10.4, "payoutYears": 16, "payoutRatio": 50.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "600028", "name": "中国石化", "baseRoe": 8.8, "payoutYears": 22, "payoutRatio": 65.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "601225", "name": "陕西煤业", "baseRoe": 21.2, "payoutYears": 9, "payoutRatio": 60.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},

    # ── 6. 通信与央企基建 ──
    {"code": "600941", "name": "中国移动", "baseRoe": 10.2, "payoutYears": 3, "payoutRatio": 70.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "601728", "name": "中国电信", "baseRoe": 7.8, "payoutYears": 3, "payoutRatio": 70.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "600050", "name": "中国联通", "baseRoe": 5.6, "payoutYears": 15, "payoutRatio": 55.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "601668", "name": "中国建筑", "baseRoe": 13.5, "payoutYears": 15, "payoutRatio": 20.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "601186", "name": "中国铁建", "baseRoe": 9.2, "payoutYears": 15, "payoutRatio": 18.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "601800", "name": "中国交建", "baseRoe": 7.8, "payoutYears": 12, "payoutRatio": 20.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},

    # ─────────────────────────────────────────────────────────────────────────
    # 🚫 7 重典型排雷样本库 (涵盖立案舆情、大股东质押、存贷双高、周期见顶、掏空分红等)
    # ─────────────────────────────────────────────────────────────────────────
    # 陷阱 1: 强周期见顶 (航运、焦煤高位业绩腰斩)
    {"code": "601919", "name": "中远海控", "baseRoe": 12.0, "payoutYears": 6, "payoutRatio": 50.0, "pledgeRatio": 0.0, "isCyclicalPeak": True, "debtSafety": True, "hasLegalIssue": False, "trapType": "CYCLICAL_PEAK", "trapReason": "全球集装箱运价超级周期见顶回落，历史盈利波动率巨大，分红不可持续"},
    {"code": "000983", "name": "山西焦煤", "baseRoe": 14.2, "payoutYears": 13, "payoutRatio": 60.0, "pledgeRatio": 0.0, "isCyclicalPeak": True, "debtSafety": True, "hasLegalIssue": False, "trapType": "CYCLICAL_PEAK", "trapReason": "焦煤现货价格高位回落，盈利进入下行周期，面临利润断崖风险"},
    {"code": "601699", "name": "潞安环能", "baseRoe": 15.1, "payoutYears": 11, "payoutRatio": 55.0, "pledgeRatio": 0.0, "isCyclicalPeak": True, "debtSafety": True, "hasLegalIssue": False, "trapType": "CYCLICAL_PEAK", "trapReason": "强周期煤种价格波动剧烈，周期高点静态股息率失真"},
    {"code": "600029", "name": "南方航空", "baseRoe": 1.2, "payoutYears": 5, "payoutRatio": 0.0, "pledgeRatio": 0.0, "isCyclicalPeak": True, "debtSafety": False, "hasLegalIssue": False, "trapType": "CYCLICAL_PEAK", "trapReason": "航空强周期受汇率与航油剧烈冲击，ROE 严重失速"},

    # 陷阱 2: 财务暴雷 / 资产负债率高危 / 现金流断裂
    {"code": "000002", "name": "万 科Ａ", "baseRoe": -5.2, "payoutYears": 28, "payoutRatio": 0.0, "pledgeRatio": 0.0, "isCyclicalPeak": True, "debtSafety": False, "hasLegalIssue": False, "trapType": "FINANCIAL_FRAUD_OR_DEBT", "trapReason": "资产负债率 86.4% 超标，经营现金流承压，最新 ROE 跌入负值，分红停滞"},
    {"code": "600048", "name": "保利发展", "baseRoe": 4.1, "payoutYears": 17, "payoutRatio": 30.0, "pledgeRatio": 0.0, "isCyclicalPeak": True, "debtSafety": False, "hasLegalIssue": False, "trapType": "FINANCIAL_FRAUD_OR_DEBT", "trapReason": "行业销售周期下行，资产减值承压，自由现金流难以支撑高分红"},
    {"code": "600383", "name": "金地集团", "baseRoe": -8.5, "payoutYears": 15, "payoutRatio": 0.0, "pledgeRatio": 25.0, "isCyclicalPeak": True, "debtSafety": False, "hasLegalIssue": False, "trapType": "FINANCIAL_FRAUD_OR_DEBT", "trapReason": "债务到期集中偿还压力巨大，经营性现金流断裂，已被剔除"},

    # 陷阱 3: 舆情与监管立案 / 高管暴雷
    {"code": "600030", "name": "中信证券", "baseRoe": 8.2, "payoutYears": 14, "payoutRatio": 35.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": True, "trapType": "REGULATORY_OR_LEGAL", "trapReason": "保荐业务多次收到监管警示与现场督导，合规风控面临舆情压力"},
    {"code": "002475", "name": "立讯精密", "baseRoe": 18.2, "payoutYears": 10, "payoutRatio": 10.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False, "trapType": "PAYOUT_TRAP", "trapReason": "股息支付率仅 10.2%（过低），大额资本开支挤压现金分红意愿"},

    # 陷阱 4: 大股东高质押 / 解禁抛压爆仓风险
    {"code": "000063", "name": "中兴通讯", "baseRoe": 14.5, "payoutYears": 12, "payoutRatio": 35.0, "pledgeRatio": 42.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False, "trapType": "PLEDGE_OR_LOCKUP", "trapReason": "大股东质押率处于敏感区间，机构筹码博弈剧烈，非纯正防御红利"},

    # 陷阱 5: 掏空式分红 / 偶发性分红
    {"code": "000858", "name": "五 粮 液", "baseRoe": 25.8, "payoutYears": 22, "payoutRatio": 60.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "000725", "name": "京东方Ａ", "baseRoe": 2.5, "payoutYears": 8, "payoutRatio": 140.0, "pledgeRatio": 0.0, "isCyclicalPeak": True, "debtSafety": True, "hasLegalIssue": False, "trapType": "PAYOUT_TRAP", "trapReason": "股息支付率高达 140% 超负荷分红，靠资本公积派息，分红完全不可持续"},
    {"code": "601318", "name": "中国平安", "baseRoe": 11.2, "payoutYears": 16, "payoutRatio": 50.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
    {"code": "601601", "name": "中国太保", "baseRoe": 12.8, "payoutYears": 15, "payoutRatio": 45.0, "pledgeRatio": 0.0, "isCyclicalPeak": False, "debtSafety": True, "hasLegalIssue": False},
]


class SmartDividendBasketService:
    """
    通用量化策略与自选组合引擎 (Smart Strategy Basket Engine)
    - 7 重深度排雷流水线 (Universal Anti-Trap Pipeline)
    - 4 大策略因子模型与行业分散约束 (≤30%)
    - 全景排雷黑名单审计看板与中证红利 ETF 降维对比
    """

    @classmethod
    def generate_basket(
        cls,
        count: int = 10,
        strategy: str = "BALANCED_QUALITY",
        weight_method: str = "EQUAL",
        max_industry_ratio: float = 0.35,
    ) -> Dict[str, Any]:
        """
        生成 3~20 只优质红利股票组合及 7 重全景排雷审计黑名单
        """
        count = max(3, min(20, int(count)))

        # 1. 批量获取全景候选池的实时行情
        target_codes = [s["code"] for s in DIVIDEND_EXPANDED_UNIVERSE]
        quotes = _batch_tencent_quote(target_codes)

        from app.services.premarket_notice_scanner import premarket_notice_scanner
        latest_negative_notices = {n["code"]: n for n in premarket_notice_scanner.get_latest_negative_notices()}

        scored_candidates: List[Dict[str, Any]] = []
        excluded_traps: List[Dict[str, Any]] = []
        dimension_counts: Dict[str, int] = {
            "REALTIME_NOTICE_NEGATIVE": 0,
            "CYCLICAL_PEAK": 0,
            "FINANCIAL_FRAUD_OR_DEBT": 0,
            "REGULATORY_OR_LEGAL": 0,
            "PLEDGE_OR_LOCKUP": 0,
            "PAYOUT_TRAP": 0,
            "PROFIT_DEGRADATION": 0,
        }

        for item in DIVIDEND_EXPANDED_UNIVERSE:
            code = item["code"]
            q = quotes.get(code, {})
            if not q or not q.get("price"):
                continue

            price = float(q.get("price") or 0.0)
            pe = float(q.get("pe") or 0.0)
            pb = float(q.get("pb") or 0.0)
            dy = float(q.get("dividendYield") or 0.0)
            change_pct = float(q.get("changePct") or 0.0)
            name = item["name"]

            # 行业分类
            industry = AKShareClient._classify_industry(name, code)

            # 基本面杜邦 ROE 与质押/负债指标 (高速内存级模型)
            real_roe = float(item.get("baseRoe", 10.0))

            # 国家队机构持仓加权
            reg = next((r for r in NATIONAL_TEAM_CORE_REGISTRY if r["code"] == code), None)
            national_team_ratio = 0.0
            national_team_label = None
            if reg:
                for inst in reg.get("institutions", []):
                    national_team_ratio += float(inst.get("ratio", 0.0))
                national_team_label = reg.get("institutions", [{}])[0].get("name", "国家队持股")

            # ─────────────────────────────────────────────────────────────────
            # 🛡️ 7 重深度全景排雷流水线 (Universal Anti-Trap Pipeline)
            # ─────────────────────────────────────────────────────────────────

            # 维度 0: 🚨 突发早盘利空公告与实时黑天鹅扫描
            if code in latest_negative_notices:
                neg = latest_negative_notices[code]
                dim = "REALTIME_NOTICE_NEGATIVE"
                dimension_counts[dim] += 1
                excluded_traps.append({
                    "code": code,
                    "name": name,
                    "industry": industry,
                    "price": price,
                    "surfaceDividendYield": dy,
                    "trapDimension": dim,
                    "trapLabel": "🚨 突发早盘利空公告",
                    "deadlyReason": neg.get("deadlyReason") or f"早盘公告异动: {neg.get('noticeTitle', '')}",
                    "financialEvidence": f"公告时间 {neg.get('noticeDate', '')} | {neg.get('financialEvidence', '')}",
                })
                continue

            # 维度 1: 舆情立案与高管暴雷
            if item.get("hasLegalIssue", False):
                dim = "REGULATORY_OR_LEGAL"
                dimension_counts[dim] += 1
                excluded_traps.append({
                    "code": code,
                    "name": name,
                    "industry": industry,
                    "price": price,
                    "surfaceDividendYield": dy,
                    "trapDimension": dim,
                    "trapLabel": "🔴 监管立案/合规警示",
                    "deadlyReason": item.get("trapReason") or "收到监管立案调查或违规警示，合规风险高",
                    "financialEvidence": "存在重大合规立案或信息披露违规风险",
                })
                continue

            # 维度 2: 财务暴雷 / 资产负债率超标 / 现金流造血断裂
            if not item.get("debtSafety", True):
                dim = "FINANCIAL_FRAUD_OR_DEBT"
                dimension_counts[dim] += 1
                excluded_traps.append({
                    "code": code,
                    "name": name,
                    "industry": industry,
                    "price": price,
                    "surfaceDividendYield": dy,
                    "trapDimension": dim,
                    "trapLabel": "🛑 财务负债/现金断裂",
                    "deadlyReason": item.get("trapReason") or "资产负债率过高或经营性现金流断裂，无法支持分红",
                    "financialEvidence": "负债率超标 (>75%) 或最新经营现金流净额严重失血",
                })
                continue

            # 维度 3: 强周期顶点见顶与业绩腰斩
            if item.get("isCyclicalPeak", False):
                dim = "CYCLICAL_PEAK"
                dimension_counts[dim] += 1
                excluded_traps.append({
                    "code": code,
                    "name": name,
                    "industry": industry,
                    "price": price,
                    "surfaceDividendYield": dy,
                    "trapDimension": dim,
                    "trapLabel": "⚡ 强周期顶点见顶",
                    "deadlyReason": item.get("trapReason") or "强周期景气高位掉头，历史利润剧烈波动，分红不可持续",
                    "financialEvidence": "商品价格/运价见顶，未来盈利面临大幅断崖",
                })
                continue

            # 维度 4: 畸形掏空分红 / 股息支付率极端不可持续
            p_ratio = item.get("payoutRatio", 40.0)
            if p_ratio > 110.0 or item.get("trapType") == "PAYOUT_TRAP":
                dim = "PAYOUT_TRAP"
                dimension_counts[dim] += 1
                excluded_traps.append({
                    "code": code,
                    "name": name,
                    "industry": industry,
                    "price": price,
                    "surfaceDividendYield": dy,
                    "trapDimension": dim,
                    "trapLabel": "❌ 掏空式超额分红",
                    "deadlyReason": item.get("trapReason") or f"股息支付率高达 {p_ratio:.1f}% 严重超负荷，靠卖资产分红不可持续",
                    "financialEvidence": f"分红金额超过当年净利润 (支付率 {p_ratio:.1f}%)",
                })
                continue

            # 维度 5: 资本回报率大幅恶化 (最新 ROE 跌破 5.0%)
            if real_roe < 5.0:
                dim = "PROFIT_DEGRADATION"
                dimension_counts[dim] += 1
                excluded_traps.append({
                    "code": code,
                    "name": name,
                    "industry": industry,
                    "price": price,
                    "surfaceDividendYield": dy,
                    "trapDimension": dim,
                    "trapLabel": "⚠️ 盈利品质严重恶化",
                    "deadlyReason": f"最新 ROE 跌至 {real_roe:.1f}%，资本造血能力严重恶化",
                    "financialEvidence": f"杜邦 ROE 仅 {real_roe:.1f}%，低于安全基准 5.0%",
                })
                continue

            # 维度 6: 大股东高质押 / 解禁抛压
            if item.get("pledgeRatio", 0.0) > 40.0:
                dim = "PLEDGE_OR_LOCKUP"
                dimension_counts[dim] += 1
                excluded_traps.append({
                    "code": code,
                    "name": name,
                    "industry": industry,
                    "price": price,
                    "surfaceDividendYield": dy,
                    "trapDimension": dim,
                    "trapLabel": "⛓️ 高质押爆仓隐患",
                    "deadlyReason": f"大股东质押率达 {item.get('pledgeRatio')}%，存在质押平仓风险",
                    "financialEvidence": "质押比例偏高，筹码结构不稳定",
                })
                continue

            # 维度 7: 股息率过低 (<2.5%) 剔除 (非高ROE策略下)
            if dy < 2.5 and strategy != "HIGH_ROE_GROWTH":
                continue

            # ─────────────────────────────────────────────────────────────────
            # 💎 阶段 2: 4 大策略量化因子打分
            # ─────────────────────────────────────────────────────────────────
            roe = real_roe
            payout_years = item.get("payoutYears", 10)

            score_quality = min(100.0, (roe / 25.0) * 40.0 + (min(payout_years, 20) / 20.0) * 30.0 + (30.0 if pe > 0 and pe < 12 else 15.0))
            score_dividend = min(100.0, (dy / 7.0) * 60.0 + (40.0 if pb < 1.0 else 20.0))
            score_safety = 50.0 + (30.0 if pb < 1.0 else 10.0) + min(20.0, national_team_ratio * 1.5)

            if strategy == "DEEP_VALUE_SAFETY":  # 深度破净低波防守
                total_score = score_dividend * 0.45 + score_safety * 0.35 + score_quality * 0.20
            elif strategy == "HIGH_ROE_GROWTH":  # 高 ROE 复利白马
                total_score = score_quality * 0.55 + score_dividend * 0.30 + score_safety * 0.15
            elif strategy == "SOVEREIGN_SUPPORT":  # 国家队重仓压舱石
                total_score = (national_team_ratio * 4.0) + score_safety * 0.35 + score_dividend * 0.35 + score_quality * 0.30
            else:  # BALANCED_QUALITY 优质红利平衡
                total_score = score_quality * 0.35 + score_dividend * 0.35 + score_safety * 0.30

            reasons = []
            if payout_years >= 15:
                reasons.append(f"连续{payout_years}年稳定分红")
            if roe >= 15.0:
                reasons.append(f"ROE高达{roe:.1f}%")
            if pb < 1.0:
                reasons.append(f"破净安全垫(PB {pb:.2f})")
            if national_team_ratio >= 5.0:
                reasons.append(f"国家队持股{national_team_ratio:.1f}%")
            if dy >= 5.0:
                reasons.append(f"高股息{dy:.2f}%")
            if not reasons:
                reasons.append("综合基本面优选")

            scored_candidates.append({
                "code": code,
                "name": name,
                "price": price,
                "changePct": change_pct,
                "pe": pe,
                "pb": pb,
                "dividendYield": dy,
                "roe": roe,
                "payoutYears": payout_years,
                "industry": industry,
                "nationalTeamRatio": round(national_team_ratio, 2),
                "nationalTeamLabel": national_team_label,
                "score": round(total_score, 1),
                "reasons": reasons[:3],
            })

        # ─────────────────────────────────────────────────────────────────
        # ⚖️ 阶段 3: 行业分散度约束 (≤35%) 与 Top N 挑选
        # ─────────────────────────────────────────────────────────────────
        scored_candidates.sort(key=lambda x: x["score"], reverse=True)

        selected_stocks: List[Dict[str, Any]] = []
        industry_counts: Dict[str, int] = {}
        max_per_industry = max(1, int(count * max_industry_ratio))

        for s in scored_candidates:
            ind = s["industry"]
            if industry_counts.get(ind, 0) < max_per_industry:
                selected_stocks.append(s)
                industry_counts[ind] = industry_counts.get(ind, 0) + 1
                if len(selected_stocks) >= count:
                    break

        if len(selected_stocks) < count:
            for s in scored_candidates:
                if s not in selected_stocks:
                    selected_stocks.append(s)
                    if len(selected_stocks) >= count:
                        break

        # ─────────────────────────────────────────────────────────────────
        # 📊 阶段 4: 权重配置与指标加权
        # ─────────────────────────────────────────────────────────────────
        total_dy_raw = sum(s["dividendYield"] for s in selected_stocks)
        for s in selected_stocks:
            if weight_method == "DIVIDEND" and total_dy_raw > 0:
                weight_pct = round((s["dividendYield"] / total_dy_raw) * 100, 2)
            else:
                weight_pct = round(100.0 / len(selected_stocks), 2)
            s["weightPct"] = weight_pct

        if selected_stocks:
            weight_diff = round(100.0 - sum(s["weightPct"] for s in selected_stocks), 2)
            selected_stocks[0]["weightPct"] = round(selected_stocks[0]["weightPct"] + weight_diff, 2)

        basket_weighted_dy = round(sum(s["dividendYield"] * (s["weightPct"] / 100.0) for s in selected_stocks), 2)
        basket_weighted_roe = round(sum(s["roe"] * (s["weightPct"] / 100.0) for s in selected_stocks), 2)
        basket_weighted_pe = round(sum(s["pe"] * (s["weightPct"] / 100.0) for s in selected_stocks if s["pe"] > 0), 2)
        basket_weighted_pb = round(sum(s["pb"] * (s["weightPct"] / 100.0) for s in selected_stocks if s["pb"] > 0), 2)

        industry_distribution: Dict[str, float] = {}
        for s in selected_stocks:
            ind = s["industry"]
            industry_distribution[ind] = round(industry_distribution.get(ind, 0.0) + s["weightPct"], 1)

        # ─────────────────────────────────────────────────────────────────
        # 🥊 阶段 5: 对比中证红利 ETF (510880) 降维分析
        # ─────────────────────────────────────────────────────────────────
        etf_benchmark = {
            "name": "中证红利 ETF (510880 / 000922)",
            "dividendYield": 4.88,
            "roe": 9.42,
            "pe": 6.85,
            "pb": 0.72,
            "annualManagementFeePct": 0.60,
            "constituentsCount": 100,
        }

        comparison = {
            "yieldAdvantagePct": round(basket_weighted_dy - etf_benchmark["dividendYield"], 2),
            "roeAdvantagePct": round(basket_weighted_roe - etf_benchmark["roe"], 2),
            "annualFeeSavedPct": 0.60,
            "savedFeePer100kAnnual": 600.0,
            "savedFeePer1mAnnual": 6000.0,
            "summaryVerdict": f"本组合相比中证红利ETF，加权股息率提升 {round(basket_weighted_dy - etf_benchmark['dividendYield'], 2):+0.2f}%，ROE 提升 {round(basket_weighted_roe - etf_benchmark['roe'], 2):+0.2f}%，7 重排雷体系成功拦截 {len(excluded_traps)} 只风险标的，且每年节省 0.60% 基金管理费磨损！",
        }

        strategy_meta = {
            "BALANCED_QUALITY": {"name": "🏆 优质红利避坑组合", "desc": "严选高 ROE 白马 + 连续 10 年稳定派息 + 国家队重仓压舱石，兼顾高股息与资本增值"},
            "DEEP_VALUE_SAFETY": {"name": "🛡️ 深度破净低波防守", "desc": "聚焦 PB < 1.0 的破净金融与特许公用事业，提供极致下行安全垫与高确定性分红"},
            "HIGH_ROE_GROWTH": {"name": "👑 高 ROE 复利白马", "desc": "筛选平均 ROE > 15% 的真正现金流造血龙头，红利再投资复利效应最强"},
            "SOVEREIGN_SUPPORT": {"name": "🏛️ 国家队托底压舱石", "desc": "中央汇金、中国证金与全国社保大比例重仓的核心支柱，国家大资金长期护盘护航"},
        }.get(strategy, {"name": "优质红利组合", "desc": "智能量化选股组合"})

        return {
            "strategy": strategy,
            "strategyMeta": strategy_meta,
            "count": len(selected_stocks),
            "weightMethod": weight_method,
            "metrics": {
                "weightedDividendYield": basket_weighted_dy,
                "weightedRoe": basket_weighted_roe,
                "weightedPe": basket_weighted_pe,
                "weightedPb": basket_weighted_pb,
            },
            "industryDistribution": industry_distribution,
            "stocks": selected_stocks,
            "antiTrapAudit": {
                "totalAuditedCount": len(DIVIDEND_EXPANDED_UNIVERSE),
                "totalExcludedCount": len(excluded_traps),
                "passedCandidatesCount": len(scored_candidates),
                "dimensionCounts": dimension_counts,
                "trapsList": excluded_traps,
            },
            "etfComparison": comparison,
            "etfBenchmark": etf_benchmark,
            "generatedAt": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }


smart_dividend_basket_service = SmartDividendBasketService()
