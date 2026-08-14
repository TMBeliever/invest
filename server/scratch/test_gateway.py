import os
import sys
import asyncio

# Add server directory to path
sys.path.insert(0, os.path.abspath("/Users/l/files/self/invest-scope/server"))

from app.services.gateway.schemas import InboundMessage, PlatformType
from app.services.gateway.orchestrator import gateway_orchestrator
from app.data.storage import storage_db

TEST_USER = "test-gateway-user"

async def test_gateway_flows():
    print("🚀 开始测试 Universal Agent Gateway...")

    # 准备测试数据
    storage_db.batch_add_assets(TEST_USER, [
        {"category": "STOCK", "name": "招商银行", "code": "600036", "shares": 1000, "cost_price": 30.0},
        {"category": "STOCK", "name": "中国神华", "code": "601088", "shares": 500, "cost_price": 40.0}
    ])

    # 1. 测试 /help
    msg_help = InboundMessage(
        platform=PlatformType.TELEGRAM,
        sender_id="123456",
        chat_id="123456",
        text="/help",
        user_id=TEST_USER
    )
    resp_help = await gateway_orchestrator.handle_inbound(msg_help)
    print("\n1. [/help 回复]:")
    print(resp_help.html[:150] + "...")
    assert "InvestScope" in resp_help.html

    # 2. 测试 /summary
    msg_summary = InboundMessage(
        platform=PlatformType.TELEGRAM,
        sender_id="123456",
        chat_id="123456",
        text="/summary",
        user_id=TEST_USER
    )
    resp_summary = await gateway_orchestrator.handle_inbound(msg_summary)
    print("\n2. [/summary 回复]:")
    print(resp_summary.html[:200] + "...")
    assert "总资产净值" in resp_summary.html

    # 3. 测试 /xray
    msg_xray = InboundMessage(
        platform=PlatformType.TELEGRAM,
        sender_id="123456",
        chat_id="123456",
        text="/xray",
        user_id=TEST_USER
    )
    resp_xray = await gateway_orchestrator.handle_inbound(msg_xray)
    print("\n3. [/xray 回复]:")
    print(resp_xray.html[:200] + "...")
    assert "X-Ray" in resp_xray.html

    # 4. 测试 股票直查 "600036"
    msg_stock = InboundMessage(
        platform=PlatformType.TELEGRAM,
        sender_id="123456",
        chat_id="123456",
        text="600036",
        user_id=TEST_USER
    )
    resp_stock = await gateway_orchestrator.handle_inbound(msg_stock)
    print("\n4. [股票 600036 直查回复]:")
    print(resp_stock.html[:200] + "...")
    assert "招商银行" in resp_stock.html

    # 5. 测试自然语言提问
    msg_chat = InboundMessage(
        platform=PlatformType.TELEGRAM,
        sender_id="123456",
        chat_id="123456",
        text="帮我看看招商银行的股息率和排雷情况",
        user_id=TEST_USER
    )
    resp_chat = await gateway_orchestrator.handle_inbound(msg_chat)
    print("\n5. [自然语言问答回复]:")
    print(resp_chat.html[:250] + "...")

    # 清理测试数据
    storage_db.clear_all_assets(TEST_USER)
    print("\n✅ 所有 Universal Gateway 双向交互测试通过！")

if __name__ == "__main__":
    asyncio.run(test_gateway_flows())
