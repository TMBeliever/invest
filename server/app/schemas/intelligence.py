from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from enum import Enum
import datetime

class ReportType(str, Enum):
    SENTINEL_ALERT = "SENTINEL_ALERT"        # 个人持仓哨兵与风控预警
    MORNING_RADAR = "MORNING_RADAR"          # 每日早盘前瞻
    CLOSING_REVIEW = "CLOSING_REVIEW"        # 每日收盘复盘
    SECTOR_INSIGHT = "SECTOR_INSIGHT"        # 行业/黄金/大宗商品专题

class Severity(str, Enum):
    INFO = "INFO"                            # 蓝色：温和关注 / 提示
    OPPORTUNITY = "OPPORTUNITY"              # 绿色：投资机会
    WARNING = "WARNING"                      # 黄色：结构失衡 / 预警
    CRITICAL = "CRITICAL"                    # 红色：重大风险 / 逻辑破坏

class AlertStatus(str, Enum):
    UNREAD = "UNREAD"                        # 未读
    ACKNOWLEDGED = "ACKNOWLEDGED"            # 已阅
    AUTO_RESOLVED = "AUTO_RESOLVED"          # 自动消除 (自愈)
    DISMISSED = "DISMISSED"                  # 主动忽略

class DecisionOption(BaseModel):
    key: str                                 # "OPTION_A" | "OPTION_B" | "OPTION_C"
    name: str                                # 如 "【稳健守成】(维持现状)"
    tag: str                                 # 如 "保守方案" | "推荐优化" | "绝对防守"
    analysis: str                            # 详细量化推演与收益风险说明
    action_type: Optional[str] = None        # 如 "REBALANCE" | "HOLD" | "TAKE_PROFIT"

class IntelligencePayload(BaseModel):
    id: str
    report_type: ReportType
    severity: Severity = Severity.INFO
    user_id: Optional[str] = None            # None 代表全员公共研报，有值代表个人持仓专属
    title: str
    summary: str
    markdown_content: str
    symbol: Optional[str] = None
    symbol_name: Optional[str] = None
    structured_metrics: Dict[str, Any] = Field(default_factory=dict)
    decision_options: Optional[List[DecisionOption]] = None
    created_at: str = Field(default_factory=lambda: datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

class UserSubscriptionConfig(BaseModel):
    user_id: str
    enable_morning_radar: bool = True
    enable_closing_review: bool = True
    enable_sentinel_alert: bool = True
    channel_types: List[str] = Field(default_factory=lambda: ["IN_APP"]) # "IN_APP", "FEISHU", "WECHAT", "EMAIL", "TELEGRAM"
    feishu_webhook_url: Optional[str] = None
    wechat_webhook_url: Optional[str] = None
    email_address: Optional[str] = None
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    telegram_api_host: Optional[str] = "https://api.telegram.org"
    updated_at: Optional[str] = None

class PushTestRequest(BaseModel):
    channel: str                             # "FEISHU" | "WECHAT" | "EMAIL" | "TELEGRAM"
    target_url_or_email: Optional[str] = None
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    telegram_api_host: Optional[str] = "https://api.telegram.org"
    report_type: Optional[ReportType] = ReportType.SENTINEL_ALERT
