import sqlite3
import os
import uuid
from typing import List, Dict, Any, Optional

DB_PATH = os.environ.get("DB_PATH") or os.path.join(os.path.dirname(__file__), "investscope.db")

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
            # 组合持仓表 (包含 user_id)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS holdings (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                code TEXT NOT NULL,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                shares REAL NOT NULL,
                cost_price REAL NOT NULL,
                current_price REAL NOT NULL
            )
            """)
            cursor.execute("PRAGMA table_info(holdings)")
            holding_cols = {row[1] for row in cursor.fetchall()}
            if "user_id" not in holding_cols:
                cursor.execute("ALTER TABLE holdings ADD COLUMN user_id TEXT")

            cursor.execute("CREATE INDEX IF NOT EXISTS idx_holdings_user_id ON holdings(user_id)")

            # 多品类资产统一表 (DEPOSIT / STOCK / FUND / WEALTH / OTHER，包含 user_id)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS assets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                category TEXT NOT NULL,
                name TEXT NOT NULL,
                code TEXT,
                amount REAL,
                shares REAL,
                cost_price REAL,
                annual_rate REAL,
                deposit_type TEXT,
                maturity_date TEXT,
                fund_type TEXT,
                notes TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """)

            cursor.execute("PRAGMA table_info(assets)")
            asset_cols = {row[1] for row in cursor.fetchall()}
            if "fund_type" not in asset_cols:
                cursor.execute("ALTER TABLE assets ADD COLUMN fund_type TEXT")
            if "user_id" not in asset_cols:
                cursor.execute("ALTER TABLE assets ADD COLUMN user_id TEXT")

            cursor.execute("CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets(user_id)")

            conn.commit()

    # ─── 资产管理 (多品类 & 按用户隔离) ───────────────────────────

    def get_all_assets(self, user_id: str) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM assets WHERE user_id = ? ORDER BY id DESC", (user_id,))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    def add_asset(self, user_id: str, data: Dict[str, Any]) -> int:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO assets (user_id, category, name, code, amount, shares, cost_price, annual_rate, deposit_type, maturity_date, fund_type, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                user_id,
                data.get("category"),
                data.get("name"),
                data.get("code"),
                float(data["amount"]) if data.get("amount") is not None else None,
                float(data["shares"]) if data.get("shares") is not None else None,
                float(data["cost_price"]) if data.get("cost_price") is not None else None,
                float(data["annual_rate"]) if data.get("annual_rate") is not None else None,
                data.get("deposit_type"),
                data.get("maturity_date"),
                data.get("fund_type"),
                data.get("notes"),
            ))
            conn.commit()
            return cursor.lastrowid

    def update_asset(self, asset_id: int, user_id: str, data: Dict[str, Any]) -> bool:
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
                fund_type = ?,
                notes = ?,
                updated_at = datetime('now')
            WHERE id = ? AND user_id = ?
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
                data.get("fund_type"),
                data.get("notes"),
                asset_id,
                user_id
            ))
            conn.commit()
            return cursor.rowcount > 0

    def delete_asset(self, asset_id: int, user_id: str) -> bool:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM assets WHERE id = ? AND user_id = ?", (asset_id, user_id))
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

    # ─── 持仓 (按用户隔离) ───────────────────────────────────────

    def get_all_holdings(self, user_id: str) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM holdings WHERE user_id = ?", (user_id,))
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

    def add_holding(self, user_id: str, holding: Dict[str, Any]):
        holding_id = holding.get("id") or str(uuid.uuid4())
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO holdings (id, user_id, code, name, category, shares, cost_price, current_price)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                holding_id,
                user_id,
                holding["code"],
                holding["name"],
                holding["category"],
                float(holding["shares"]),
                float(holding["costPrice"]),
                float(holding.get("currentPrice", holding["costPrice"])),
            ))
            conn.commit()
        return holding_id

    def delete_holding(self, holding_id: str, user_id: str):
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM holdings WHERE id = ? AND user_id = ?", (holding_id, user_id))
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

