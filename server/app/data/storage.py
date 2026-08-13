import sqlite3
import os
import uuid
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
            # 用户表
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id          TEXT PRIMARY KEY,
                username    TEXT UNIQUE NOT NULL,
                email       TEXT UNIQUE,
                hashed_pwd  TEXT NOT NULL,
                nickname    TEXT,
                avatar_url  TEXT,
                created_at  TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """)
            # 财报数据本地缓存表
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS financial_cache (
                code        TEXT NOT NULL,
                data_type   TEXT NOT NULL,
                json_content TEXT NOT NULL,
                updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
                PRIMARY KEY (code, data_type)
            )
            """)
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
            # 多品类资产统一表 (DEPOSIT / STOCK / FUND / WEALTH / OTHER)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS assets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL,
                name TEXT NOT NULL,
                code TEXT,
                amount REAL,
                shares REAL,
                cost_price REAL,
                annual_rate REAL,
                deposit_type TEXT,
                maturity_date TEXT,
                notes TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """)
            
            cursor.execute("SELECT COUNT(*) FROM assets")
            asset_count = cursor.fetchone()[0]
            if asset_count == 0:
                default_assets = [
                    ("DEPOSIT", "招商银行活期存款", None, 200000.0, None, None, 0.2, "DEMAND", None, "日常应急流动资金"),
                    ("DEPOSIT", "工商银行3年定期", None, 300000.0, None, None, 2.3, "FIXED", "2027-06-15", "稳健定期利息收息"),
                    ("STOCK", "招商银行", "600036", None, 10000.0, 32.5, None, None, None, "核心收息底仓"),
                    ("STOCK", "贵州茅台", "600519", None, 200.0, 1450.0, None, None, None, "高端白酒龙头"),
                    ("FUND", "易方达沪深300ETF", "510300", None, 50000.0, 3.85, None, None, None, "宽基指数配置"),
                    ("WEALTH", "建行日日鑫理财", None, 150000.0, None, None, 2.85, None, "2026-12-31", "短债稳健理财"),
                    ("OTHER", "黄金积存", None, 35000.0, None, None, None, None, None, "避险资产配置"),
                ]
                cursor.executemany("""
                INSERT INTO assets (category, name, code, amount, shares, cost_price, annual_rate, deposit_type, maturity_date, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, default_assets)

            conn.commit()

    # ─── 资产管理 (多品类) ───────────────────────────────────────

    def get_all_assets(self) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM assets ORDER BY id DESC")
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    def add_asset(self, data: Dict[str, Any]) -> int:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO assets (category, name, code, amount, shares, cost_price, annual_rate, deposit_type, maturity_date, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                data.get("category"),
                data.get("name"),
                data.get("code"),
                float(data["amount"]) if data.get("amount") is not None else None,
                float(data["shares"]) if data.get("shares") is not None else None,
                float(data["cost_price"]) if data.get("cost_price") is not None else None,
                float(data["annual_rate"]) if data.get("annual_rate") is not None else None,
                data.get("deposit_type"),
                data.get("maturity_date"),
                data.get("notes"),
            ))
            conn.commit()
            return cursor.lastrowid

    def update_asset(self, asset_id: int, data: Dict[str, Any]) -> bool:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            UPDATE assets SET
                category = ?,
                name = ?,
                code = ?,
                amount = ?,
                shares = ?,
                cost_price = ?,
                annual_rate = ?,
                deposit_type = ?,
                maturity_date = ?,
                notes = ?,
                updated_at = datetime('now')
            WHERE id = ?
            """, (
                data.get("category"),
                data.get("name"),
                data.get("code"),
                float(data["amount"]) if data.get("amount") is not None else None,
                float(data["shares"]) if data.get("shares") is not None else None,
                float(data["cost_price"]) if data.get("cost_price") is not None else None,
                float(data["annual_rate"]) if data.get("annual_rate") is not None else None,
                data.get("deposit_type"),
                data.get("maturity_date"),
                data.get("notes"),
                asset_id
            ))
            conn.commit()
            return cursor.rowcount > 0

    def delete_asset(self, asset_id: int) -> bool:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM assets WHERE id = ?", (asset_id,))
            conn.commit()
            return cursor.rowcount > 0

    # ─── 用户 ───────────────────────────────────────────────────

    def create_user(self, username: str, hashed_pwd: str, email: Optional[str] = None, nickname: Optional[str] = None) -> Dict[str, Any]:
        user_id = str(uuid.uuid4())
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO users (id, username, email, hashed_pwd, nickname)
            VALUES (?, ?, ?, ?, ?)
            """, (user_id, username, email, hashed_pwd, nickname or username))
            conn.commit()
        return self.get_user_by_id(user_id)

    def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        with self._get_conn() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        with self._get_conn() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def update_user(self, user_id: str, nickname: Optional[str] = None, avatar_url: Optional[str] = None) -> Optional[Dict[str, Any]]:
        fields = []
        values: List[Any] = []
        if nickname is not None:
            fields.append("nickname = ?")
            values.append(nickname)
        if avatar_url is not None:
            fields.append("avatar_url = ?")
            values.append(avatar_url)
        if not fields:
            return self.get_user_by_id(user_id)
        fields.append("updated_at = datetime('now')")
        values.append(user_id)
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(f"UPDATE users SET {', '.join(fields)} WHERE id = ?", values)
            conn.commit()
        return self.get_user_by_id(user_id)

    # ─── 持仓 ───────────────────────────────────────────────────

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

    def get_financial_cache(self, code: str, data_type: str) -> Optional[str]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT json_content FROM financial_cache WHERE code = ? AND data_type = ?",
                (code, data_type)
            )
            row = cursor.fetchone()
            return row[0] if row else None

    def set_financial_cache(self, code: str, data_type: str, json_content: str):
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT OR REPLACE INTO financial_cache (code, data_type, json_content, updated_at)
            VALUES (?, ?, ?, datetime('now'))
            """, (code, data_type, json_content))
            conn.commit()

storage_db = StorageDB()

