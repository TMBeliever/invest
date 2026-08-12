import sqlite3
import os
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "investscope.db")

class StorageDB:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _get_conn(self):
        return sqlite3.connect(self.db_path)

    def _init_db(self):
        with self._get_conn() as conn:
            cursor = conn.cursor()
            # 组合持仓表
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS holdings (
                id TEXT PRIMARY KEY,
                code TEXT NOT NULL,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                shares REAL NOT NULL,
                cost_price REAL NOT NULL,
                current_price REAL NOT NULL
            )
            """)
            # 如果是空表，插入默认的示范持仓
            cursor.execute("SELECT COUNT(*) FROM holdings")
            count = cursor.fetchone()[0]
            if count == 0:
                default_holdings = [
                    ("h1", "510880", "红利ETF", "CORE_DIVIDEND", 100000.0, 3.12, 3.45),
                    ("h2", "601939", "建设银行", "CORE_DIVIDEND", 40000.0, 6.50, 7.80),
                    ("h3", "511010", "国债ETF", "CORE_BOND", 6000.0, 102.50, 104.20),
                    ("h4", "510300", "沪深300ETF", "SATELLITE_INDEX", 80000.0, 3.80, 4.15),
                    ("h5", "159915", "创业板ETF", "SATELLITE_SECTOR", 120000.0, 1.95, 2.05),
                    ("h6", "CASH", "货币基金/现金", "RESERVE_CASH", 174367.89, 1.00, 1.00),
                ]
                cursor.executemany("""
                INSERT INTO holdings (id, code, name, category, shares, cost_price, current_price)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, default_holdings)
            conn.commit()

    def get_all_holdings(self) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM holdings")
            rows = cursor.fetchall()
            result = []
            for row in rows:
                result.append({
                    "id": row["id"],
                    "code": row["code"],
                    "name": row["name"],
                    "category": row["category"],
                    "shares": row["shares"],
                    "costPrice": row["cost_price"],
                    "currentPrice": row["current_price"],
                })
            return result

    def add_holding(self, holding: Dict[str, Any]):
        import uuid
        holding_id = holding.get("id") or str(uuid.uuid4())
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO holdings (id, code, name, category, shares, cost_price, current_price)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                holding_id,
                holding["code"],
                holding["name"],
                holding["category"],
                float(holding["shares"]),
                float(holding["costPrice"]),
                float(holding.get("currentPrice", holding["costPrice"])),
            ))
            conn.commit()
        return holding_id

    def delete_holding(self, holding_id: str):
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM holdings WHERE id = ?", (holding_id,))
            conn.commit()

storage_db = StorageDB()
