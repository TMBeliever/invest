from typing import Any, Dict, Optional, List
from enum import Enum
from pydantic import BaseModel, Field

class PlatformType(str, Enum):
    TELEGRAM = "TELEGRAM"
    FEISHU = "FEISHU"
    WECHAT = "WECHAT"
    DISCORD = "DISCORD"
    SLACK = "SLACK"
    CUSTOM = "CUSTOM"

class InboundMessage(BaseModel):
    platform: PlatformType
    sender_id: str                      # 平台侧发送者标识 (如 Telegram chat_id / 飞书 open_id)
    chat_id: str                        # 会话 ID (个人私聊或群聊 ID)
    text: str                           # 用户输入的原始文本
    sender_name: Optional[str] = None   # 昵称 (如 Telegram username)
    user_id: Optional[str] = None       # 映射绑定的 InvestScope 内部系统用户 ID
    raw_payload: Dict[str, Any] = Field(default_factory=dict)

class OutboundResponse(BaseModel):
    platform: PlatformType
    chat_id: str
    text: str                           # 纯文本 (兜底)
    html: Optional[str] = None          # HTML 富文本 (针对 Telegram)
    markdown: Optional[str] = None      # Markdown 文本 (针对 飞书/企微/钉钉)
    reply_to_message_id: Optional[str] = None
    extra: Dict[str, Any] = Field(default_factory=dict)
