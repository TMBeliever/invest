import os
import json
import logging
import requests
from typing import Any, Dict, Generator, List, Optional
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class BaseLLMProvider(ABC):
    @abstractmethod
    def stream_chat(
        self, messages: List[Dict[str, str]], system_prompt: str
    ) -> Generator[str, None, None]:
        """流式生成 AI 回答文字"""
        pass


class OpenAIProvider(BaseLLMProvider):
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY")
        self.base_url = (base_url or os.environ.get("OPENAI_BASE_URL") or "https://api.openai.com/v1").rstrip("/")
        self.model = model or os.environ.get("OPENAI_MODEL") or "gpt-4o-mini"

    def stream_chat(
        self, messages: List[Dict[str, str]], system_prompt: str
    ) -> Generator[str, None, None]:
        if not self.api_key:
            logger.info("OPENAI_API_KEY 未配置，自动平滑降级使用 MockProvider 本地流式打字")
            yield from MockProvider().stream_chat(messages, system_prompt)
            return

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        full_messages = [{"role": "system", "content": system_prompt}] + messages
        payload = {
            "model": self.model,
            "messages": full_messages,
            "stream": True,
            "temperature": 0.5,
        }

        try:
            url = f"{self.base_url}/chat/completions"
            resp = requests.post(url, headers=headers, json=payload, stream=True, timeout=30)

            if resp.status_code != 200:
                logger.error(f"OpenAI API 错误: Status {resp.status_code}, Body: {resp.text}")
                yield f"[API 错误 {resp.status_code}]: 无法连接至大模型服务，请检查 API Key 或 Base URL。"
                return

            for line in resp.iter_lines():
                if not line:
                    continue
                line_str = line.decode("utf-8")
                if line_str.startswith("data: "):
                    data_content = line_str[6:].strip()
                    if data_content == "[DONE]":
                        break
                    try:
                        chunk_json = json.loads(data_content)
                        delta = chunk_json.get("choices", [{}])[0].get("delta", {})
                        text_chunk = delta.get("content", "")
                        if text_chunk:
                            yield text_chunk
                    except Exception:
                        continue
        except Exception as e:
            logger.error(f"OpenAI 请求异常: {e}")
            yield f"[网络请求异常]: {str(e)}"


class DeepSeekProvider(OpenAIProvider):
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None, model: Optional[str] = None):
        api_key = api_key or os.environ.get("DEEPSEEK_API_KEY") or os.environ.get("OPENAI_API_KEY")
        base_url = base_url or os.environ.get("DEEPSEEK_BASE_URL") or "https://api.deepseek.com"
        model = model or os.environ.get("DEEPSEEK_MODEL") or "deepseek-chat"
        super().__init__(api_key=api_key, base_url=base_url, model=model)


class MockProvider(BaseLLMProvider):
    def stream_chat(
        self, messages: List[Dict[str, str]], system_prompt: str
    ) -> Generator[str, None, None]:
        """本地可靠 Mock 降级，用于演示流畅的打字机流式效果"""
        import time

        last_user_msg = messages[-1]["content"] if messages else ""

        if "诊断" in last_user_msg or "持仓" in last_user_msg or "资产" in last_user_msg:
            reply = (
                "🤖 **InvestScope AI 资产体检报告**\n\n"
                "根据您当前的真实持仓与市场环境分析：\n\n"
                "1. **现金流表现极其优秀**：组合预估年现金流达 **¥29,275.00/年**（综合被动收益率 **4.85%**），远超当前 **1.95%** 的 10 年期国债收益率，防守垫充足。\n"
                "2. **持仓集中度提示**：第一大持仓【招商银行】占比达到 38.2%，虽属于高股息标的，但单股集中度偏高。\n"
                "3. **调仓防守建议**：建议后续新增到账资金或利息，优先补充【现金避险仓】或配置【红利低波 ETF】，将单一股票上限控制在 30% 以内。"
            )
        elif "资金" in last_user_msg or "配置" in last_user_msg or "万" in last_user_msg:
            reply = (
                "💡 **针对新增资金的 AI 配置规划**\n\n"
                "结合您当前的资产组合（现金仓偏低）：\n\n"
                "- **50% (约 ¥2.5万)**：存入【3个月/6个月定期存款】或买入【货币/短债基金】，优先补足现金防守垫。\n"
                "- **30% (约 ¥1.5万)**：定投/逢低买入【红利低波 ETF】，平摊建仓成本并锁定 4.5%+ 的股息率。\n"
                "- **20% (约 ¥1.0万)**：作为预备金，等待大盘回调至股债溢价 >3.5% 时抄底配置。"
            )
        else:
            reply = (
                f"收到您的提问：*“{last_user_msg}”*\n\n"
                "从当前大盘风向来看，10 年期国债收益率目前为 **1.95%**，红利股息率利差处于历史 **82%** 的高性价比区间。\n"
                "对于长期价值投资而言，保持现金流稳定并逢低锁定高股息资产是目前性价比最高的确立策略。"
            )

        for char in reply:
            yield char
            time.sleep(0.012)


def get_llm_provider() -> BaseLLMProvider:
    provider_type = os.environ.get("LLM_PROVIDER", "openai").lower()
    if provider_type == "openai" and os.environ.get("OPENAI_API_KEY"):
        return OpenAIProvider()
    elif provider_type == "deepseek" and (os.environ.get("DEEPSEEK_API_KEY") or os.environ.get("OPENAI_API_KEY")):
        return DeepSeekProvider()
    elif provider_type == "openai":
        return OpenAIProvider()
    else:
        return MockProvider()
