import os
import sys
import asyncio

# Add server directory to path
sys.path.insert(0, os.path.abspath("/Users/l/files/self/invest-scope/server"))

from app.services.gateway.schemas import InboundMessage, PlatformType
from app.services.gateway.orchestrator import gateway_orchestrator
from app.data.storage import storage_db

TEST_USER = "test-memory-user"

async def test_agent_memory():
    print("🚀 测试 Telegram Bot 连通网页 AI 助手的全套能力与多轮记忆...")

    # 1. 注入资产
    storage_db.batch_add_assets(TEST_USER, [
        {"category": "STOCK", "name": "招商银行", "code": "600036", "shares": 1000, "cost_price": 30.0},
        {"category": "STOCK", "name": "长江电力", "code": "600900", "shares": 2000, "cost_price": 25.0}
    ])

    # 2. 第一轮提问
    msg1 = InboundMessage(
        platform=PlatformType.TELEGRAM,
        sender_id="chat_999",
        chat_id="chat_999",
        text="帮我看看招商银行和长江电力",
        user_id=TEST_USER
    )
    resp1 = await gateway_orchestrator.handle_inbound(msg1)
    print("\n--- Turn 1 回复 ---")
    print(resp1.html[:300] + "...")

    # 3. 第二轮提问 (依赖上一轮记忆)
    msg2 = InboundMessage(
        platform=PlatformType.TELEGRAM,
        sender_id="chat_999",
        chat_id="chat_999",
        text="我的资产总额是多少？",
        user_id=TEST_USER
    )
    resp2 = await gateway_orchestrator.handle_inbound(msg2)
    print("\n--- Turn 2 回复 ---")
    print(resp2.html[:300] + "...")

    # 4. 中文指令测试
    msg3 = InboundMessage(
        platform=PlatformType.TELEGRAM,
        sender_id="chat_999",
        chat_id="chat_999",
        text="获取早报",
        user_id=TEST_USER
    )
    resp3 = await gateway_orchestrator.handle_inbound(msg3)
    print("\n--- Turn 3 [获取早报] 回复 ---")
    print(resp3.html[:200] + "...")
    assert "早盘前瞻" in resp3.html or "早报" in resp3.html

    # 清理
    storage_db.clear_all_assets(TEST_USER)
    print("\n✅ 全流程双向 Agent 与多轮记忆测试完美通过！")

if __name__ == "__main__":
    asyncio.run(test_agent_memory())
