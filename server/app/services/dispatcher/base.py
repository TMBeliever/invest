from abc import ABC, abstractmethod
from typing import Dict, Any
from app.schemas.intelligence import IntelligencePayload

class BaseChannelAdapter(ABC):
    channel_name: str

    @abstractmethod
    async def send(self, payload: IntelligencePayload, target_config: Dict[str, Any]) -> bool:
        """
        根据渠道特性将标准情报数据格式化并发送。
        target_config 中包含该渠道特有的目标地址（如 webhook_url、email 等）。
        返回 True 表示成功，False 表示失败。
        """
        pass
