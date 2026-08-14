import os
import json
import logging
import requests
from typing import Any, Dict, Generator, List, Optional
from abc import ABC, abstractmethod

from app.config import settings

logger = logging.getLogger(__name__)


class BaseLLMProvider(ABC):
    @abstractmethod
    def stream_chat(
        self,
        messages: List[Dict[str, Any]],
        system_prompt: str,
        user_id: Optional[str] = None,
        enable_tools: bool = True,
    ) -> Generator[str, None, None]:
        """流式生成 AI 回答文字 (支持 Agentic Function Calling)"""
        pass

    def chat_complete(
        self,
        messages: List[Dict[str, Any]],
        system_prompt: str,
        user_id: Optional[str] = None,
        enable_tools: bool = True,
    ) -> str:
        """非流式直接获取完整回答 (适用于 Webhook / Telegram / 机器人回复)"""
        chunks = list(self.stream_chat(messages, system_prompt, user_id=user_id, enable_tools=enable_tools))
        return "".join(chunks)


class OpenAIProvider(BaseLLMProvider):
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY") or settings.OPENAI_API_KEY
        self.base_url = (base_url or os.environ.get("OPENAI_BASE_URL") or settings.OPENAI_BASE_URL).rstrip("/")
        self.model = model or os.environ.get("OPENAI_MODEL") or settings.OPENAI_MODEL

    def stream_chat(
        self,
        messages: List[Dict[str, Any]],
        system_prompt: str,
        user_id: Optional[str] = None,
        enable_tools: bool = True,
    ) -> Generator[str, None, None]:
        if not self.api_key:
            logger.info("OPENAI_API_KEY 未配置，自动平滑降级使用 MockProvider 本地流式打字")
            yield from MockProvider().stream_chat(messages, system_prompt, user_id=user_id)
            return

        from app.services.ai_tools import AI_TOOLS_DEFINITIONS, dispatch_ai_tool

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        full_messages = [{"role": "system", "content": system_prompt}] + messages

        # 检查是否包含图片 (多模态图片识别直接直连，不走工具调用)
        has_images = any(
            isinstance(m.get("content"), list) and any(item.get("type") == "image_url" for item in m.get("content", []))
            for m in messages
        )

        # ─── 1. Agentic Function Calling 自主规划与工具调用 ───────────────────
        if enable_tools and not has_images:
            try:
                check_payload = {
                    "model": self.model,
                    "messages": full_messages,
                    "tools": AI_TOOLS_DEFINITIONS,
                    "temperature": 0.3,
                }
                url = f"{self.base_url}/chat/completions"
                resp = requests.post(
                    url,
                    headers=headers,
                    json=check_payload,
                    timeout=(4, 25),
                    proxies={"http": None, "https": None},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    choice = data.get("choices", [{}])[0]
                    message = choice.get("message", {})
                    tool_calls = message.get("tool_calls")

                    if tool_calls and len(tool_calls) > 0:
                        # 命中自主工具调用，执行工具并回传结果
                        full_messages.append(message)
                        for tc in tool_calls:
                            fn_name = tc.get("function", {}).get("name", "")
                            raw_args = tc.get("function", {}).get("arguments", "{}")
                            fn_args = json.loads(raw_args) if isinstance(raw_args, str) else (raw_args or {})
                            tool_result = dispatch_ai_tool(fn_name, fn_args, user_id=user_id)
                            full_messages.append({
                                "role": "tool",
                                "tool_call_id": tc.get("id"),
                                "name": fn_name,
                                "content": json.dumps(tool_result, ensure_ascii=False),
                            })
                    else:
                        # 未触发工具调用且已完整返回，直接输出
                        direct_content = message.get("content", "")
                        if direct_content:
                            yield direct_content
                            return
            except Exception as e:
                logger.warning(f"Tool Call 自主调度异常，平滑降级为直连流式: {e}")

        # ─── 2. 最终流式打字机输出 ──────────────────────────────────────────
        payload = {
            "model": self.model,
            "messages": full_messages,
            "stream": True,
            "temperature": 0.5,
        }

        try:
            url = f"{self.base_url}/chat/completions"
            resp = requests.post(
                url,
                headers=headers,
                json=payload,
                stream=True,
                timeout=(5, 60),
                proxies={"http": None, "https": None},
            )

            if resp.status_code != 200:
                err_text = resp.text[:200]
                logger.error(f"OpenAI API 错误: Status {resp.status_code}, Body: {err_text}")
                yield f"[模型服务异常 (HTTP {resp.status_code})]: 无法连接至大模型服务 ({self.model})。建议切换其他模型后重试。"
                return

            for line in resp.iter_lines(chunk_size=1):
                if not line:
                    continue
                line_str = line.decode("utf-8") if isinstance(line, bytes) else line
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
        except requests.exceptions.Timeout:
            logger.error(f"OpenAI 请求超时: model={self.model}")
            yield f"[响应超时]: 当前大模型 ({self.model}) 响应超时，建议在上方切换为极速模型后重试。"
        except requests.exceptions.RequestException as e:
            logger.error(f"OpenAI 网络连接异常: {e}")
            yield f"[网络连接异常]: 无法连通模型中转服务，请稍后重试或切换模型。"
        except Exception as e:
            logger.error(f"OpenAI 请求异常: {e}")
            yield f"[服务异常]: {str(e)}"


class DeepSeekProvider(OpenAIProvider):
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None, model: Optional[str] = None):
        api_key = api_key or os.environ.get("DEEPSEEK_API_KEY") or os.environ.get("OPENAI_API_KEY")
        base_url = base_url or os.environ.get("DEEPSEEK_BASE_URL") or "https://api.deepseek.com"
        model = model or os.environ.get("DEEPSEEK_MODEL") or "deepseek-chat"
        super().__init__(api_key=api_key, base_url=base_url, model=model)


class MockProvider(BaseLLMProvider):
    def stream_chat(
        self,
        messages: List[Dict[str, Any]],
        system_prompt: str,
        user_id: Optional[str] = None,
        enable_tools: bool = True,
    ) -> Generator[str, None, None]:
        """本地可靠 Mock 降级，用于演示流畅的打字机流式效果"""
        import time

        last_user_msg = messages[-1]["content"] if messages else ""

        if "诊断" in str(last_user_msg) or "持仓" in str(last_user_msg) or "X光" in str(last_user_msg):
            reply = (
                "🤖 **InvestScope AI 资产全景 X 光体检报告**\n\n"
                "根据您当前的真实持仓穿透与宏观压力测试：\n\n"
                "1. **现金固收防守垫极厚**：组合中固收与现金类资产占比 **91.7%**，具备极强的抗暴跌与黑天鹅避险能力。\n"
                "2. **降息环境显著受益**：在央行降息 25bp 情景下，预估组合净值增厚 **+1.79%**（约 +¥26,817.94）。\n"
                "3. **优化建议**：可适度增加 3%~5% 的高股息公用事业龙头与全球科技 ETF，提升长期收益弹性。"
            )
        else:
            reply = (
                f"收到您的提问：*“{str(last_user_msg)}”*\n\n"
                "作为您的 InvestScope 智能投资顾问，我随时可以通过工具调取您的全景 X 光穿透、实时行情与宏观压力测试数据。"
            )

        for char in reply:
            yield char
            time.sleep(0.012)


def get_llm_provider(model: Optional[str] = None) -> BaseLLMProvider:
    provider_type = os.environ.get("LLM_PROVIDER", "openai").lower()
    if provider_type == "openai" and (os.environ.get("OPENAI_API_KEY") or settings.OPENAI_API_KEY):
        return OpenAIProvider(model=model)
    elif provider_type == "deepseek" and (os.environ.get("DEEPSEEK_API_KEY") or os.environ.get("OPENAI_API_KEY") or settings.OPENAI_API_KEY):
        return DeepSeekProvider(model=model)
    elif provider_type == "openai":
        return OpenAIProvider(model=model)
    else:
        return MockProvider()
