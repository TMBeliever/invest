import os
import sys
import asyncio

# Add server directory to path
sys.path.insert(0, os.path.abspath("/Users/l/files/self/invest-scope/server"))
os.chdir(os.path.abspath("/Users/l/files/self/invest-scope/server"))

from app.api.actions import execute_agent_action, ActionExecutionRequest
from app.api.assets import get_assets_summary
from app.api.xray import get_portfolio_xray
from app.api.ai import get_portfolio_diagnosis
from app.services.intelligence.sentinel_risk import sentinel_risk_generator
from app.data.storage import storage_db

TEST_USER = "test-bank-deposit-user"

async def test_full_deposit_pipeline():
    print("🚀 测试图片中【享存3月 / 按季付息 4.00% 定期存款】全流程录入与量化解析...")

    # 1. 模拟 AI 识别到的 Action 数据结构 (带字符串格式与不同别名)
    mock_action = ActionExecutionRequest(
        type="IMPORT_ASSETS",
        title="识别到 2 笔享存定期存款",
        summary="提取出享存3月共 2 笔定存，年利率 4.00%，按季付息",
        source="AI_OCR",
        payload={
            "duplicateStrategy": "SYNC_UPDATE",
            "items": [
                {
                    "category": "DEPOSIT",
                    "name": "享存3月 (9.84万)",
                    "amount": 98450.88,
                    "annualRate": "4.00%",      # 测试带 % 的字符串容错
                    "payoutMethod": "按季付息",  # 测试中文结息方式映射
                    "depositType": "定期存款",   # 测试中文存单类型映射
                    "startDate": "2022-11-13",
                    "maturityDate": "2027-11-12",
                    "notes": "按季付息984.51元"
                },
                {
                    "category": "存款",          # 测试中文类别映射
                    "name": "享存3月 (5.11万)",
                    "amount": "51,161.61",      # 测试带千分位逗号的字符串容错
                    "annualRate": 4.0,
                    "payoutMethod": "QUARTERLY",
                    "depositType": "FIXED",
                    "startDate": "2022-10-26",
                    "maturityDate": "2027-10-25",
                    "notes": "按季付息511.62元"
                }
            ]
        }
    )

    mock_user = {"id": TEST_USER, "username": "test_user"}

    # 2. 执行 Action 入库
    exec_res = execute_agent_action(mock_action, mock_user)
    print("✅ Action 执行结果:", exec_res)
    assert exec_res.get("success") is True or "新增" in exec_res.get("message", "")

    # 3. 验证资产总览与预估年收益 (现金流)
    s = get_assets_summary(mock_user)
    summary = s["summary"]
    print("\n📊 资产账本汇总:")
    print(f"• 总资产净值: ¥{summary['totalValue']:,.2f} (预期 149,612.49)")
    print(f"• 预估年利息现金流: ¥{summary['estimatedAnnualIncome']:,.2f}/年 (预期 5,984.50)")
    assert abs(summary["totalValue"] - 149612.49) < 0.1
    assert abs(summary["estimatedAnnualIncome"] - 5984.50) < 0.1

    # 4. 验证 X-Ray 组合穿透
    xray = get_portfolio_xray(mock_user)
    print("\n🩻 X-Ray 全景穿透:")
    print(f"• 穿透行业数: {len(xray.get('sectorBreakdown', []))}")
    print(f"• 现金与银行存款敞口: {xray.get('factorRadar', {}).get('user', {}).get('cashSafety')}%")

    # 5. 验证 AI 组合体检
    diagnose = get_portfolio_diagnosis(mock_user)
    print("\n🤖 AI 组合体检评分:")
    print(f"• 健康度得分: {diagnose['score']} 分")
    print(f"• 诊断建议条数: {len(diagnose['diagnosisText'])}")
    assert len(diagnose["diagnosisText"]) == 3

    # 6. 验证风险哨兵扫描 (绝不崩溃)
    alerts = await sentinel_risk_generator.scan_and_generate_alerts(TEST_USER, force=True)
    print(f"\n🛡️ 风险哨兵扫描完成，生成预警数: {len(alerts)}")

    # 清理测试数据
    storage_db.clear_all_assets(TEST_USER)
    print("\n🎉 全套银行存款/按季付息流程测试 100% 通过！")

if __name__ == "__main__":
    asyncio.run(test_full_deposit_pipeline())
