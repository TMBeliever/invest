import os
import sys

# Add server directory to path
sys.path.insert(0, os.path.abspath("/Users/l/files/self/invest-scope/server"))

from app.data.storage import storage_db

TEST_USER = "test-clear-user"

def test_clear_and_rollback():
    # 1. 插入两条测试资产
    storage_db.batch_add_assets(TEST_USER, [
        {"category": "STOCK", "name": "招商银行", "code": "600036", "shares": 1000, "cost_price": 30.0},
        {"category": "STOCK", "name": "中国神华", "code": "601088", "shares": 500, "cost_price": 40.0}
    ])
    
    assets_before = storage_db.get_all_assets(TEST_USER)
    print(f"1. 插入后资产数量: {len(assets_before)}")
    assert len(assets_before) == 2, "资产插入失败"

    # 2. 清空资产
    deleted_count = storage_db.clear_all_assets(TEST_USER, source="TEST_CLEAR")
    print(f"2. 清空资产数量: {deleted_count}")
    assert deleted_count == 2, "清空数量不符"

    assets_after = storage_db.get_all_assets(TEST_USER)
    print(f"3. 清空后资产数量: {len(assets_after)}")
    assert len(assets_after) == 0, "资产未清空"

    # 4. 从审计日志时光机恢复
    logs = storage_db.get_asset_audit_logs(TEST_USER, limit=1)
    assert len(logs) > 0, "未产生审计日志"
    clear_log = logs[0]
    print(f"4. 最新审计日志: ID={clear_log['id']}, Action={clear_log['action']}, Desc={clear_log['description']}")

    res = storage_db.rollback_asset_action(TEST_USER, clear_log['id'])
    print(f"5. 回滚结果: {res}")

    assets_restored = storage_db.get_all_assets(TEST_USER)
    print(f"6. 回滚后恢复资产数量: {len(assets_restored)}")
    assert len(assets_restored) == 2, "回滚恢复失败"

    # 清理测试数据
    storage_db.clear_all_assets(TEST_USER)
    print("✅ 全部清空与时光机回滚测试通过！")

if __name__ == "__main__":
    test_clear_and_rollback()
