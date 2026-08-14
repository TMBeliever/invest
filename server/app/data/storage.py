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
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        return conn

    def _init_db(self):
        with self._get_conn() as conn:
            conn.execute("PRAGMA journal_mode=WAL;")
            conn.execute("PRAGMA synchronous=NORMAL;")
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
            if "start_date" not in asset_cols:
                cursor.execute("ALTER TABLE assets ADD COLUMN start_date TEXT")
            if "payout_method" not in asset_cols:
                cursor.execute("ALTER TABLE assets ADD COLUMN payout_method TEXT")

            cursor.execute("CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets(user_id)")

            # AI 对话会话表与消息表
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id          TEXT PRIMARY KEY,
                user_id     TEXT NOT NULL,
                title       TEXT NOT NULL DEFAULT '新对话',
                summary     TEXT,
                created_at  TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS chat_messages (
                id          TEXT PRIMARY KEY,
                session_id  TEXT NOT NULL,
                role        TEXT NOT NULL,
                content     TEXT NOT NULL,
                timestamp   TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """)

            cursor.execute("CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id)")

            # 资产变更与审计日志流水表 (支持全链路追溯与一键时光机回滚)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS asset_audit_logs (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     TEXT NOT NULL,
                asset_id    INTEGER,
                action      TEXT NOT NULL, -- 'CREATE' | 'UPDATE' | 'DELETE' | 'BATCH_IMPORT' | 'ROLLBACK'
                source      TEXT NOT NULL DEFAULT 'MANUAL', -- 'MANUAL' | 'AI_OCR' | 'AI_CHAT' | 'ROLLBACK'
                description TEXT,
                before_data TEXT,          -- JSON 快照
                after_data  TEXT,          -- JSON 快照
                created_at  TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_asset_audit_user ON asset_audit_logs(user_id)")

            conn.commit()

    # ─── 资产管理 (多品类 & 按用户隔离) ───────────────────────────

    def get_all_assets(self, user_id: str) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("UPDATE assets SET user_id = ? WHERE user_id IS NULL", (user_id,))
            conn.commit()
            cursor.execute("SELECT * FROM assets WHERE user_id = ? ORDER BY id DESC", (user_id,))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    def add_asset(self, user_id: str, data: Dict[str, Any], source: str = "MANUAL", description: str = "手动添加资产") -> int:
        import json
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO assets (user_id, category, name, code, amount, shares, cost_price, annual_rate, deposit_type, start_date, maturity_date, payout_method, fund_type, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                data.get("start_date"),
                data.get("maturity_date"),
                data.get("payout_method"),
                data.get("fund_type"),
                data.get("notes"),
            ))
            asset_id = cursor.lastrowid
            
            # 记录审计日志
            after_snapshot = json.dumps({**data, "id": asset_id}, ensure_ascii=False)
            cursor.execute("""
            INSERT INTO asset_audit_logs (user_id, asset_id, action, source, description, before_data, after_data)
            VALUES (?, ?, 'CREATE', ?, ?, NULL, ?)
            """, (user_id, asset_id, source, description, after_snapshot))

            conn.commit()
            return asset_id

    def update_asset(self, asset_id: int, user_id: str, data: Dict[str, Any], source: str = "MANUAL") -> bool:
        import json
        with self._get_conn() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # 提取旧数据快照
            cursor.execute("SELECT * FROM assets WHERE id = ? AND user_id = ?", (asset_id, user_id))
            old_row = cursor.fetchone()
            if not old_row:
                return False
            before_snapshot = json.dumps(dict(old_row), ensure_ascii=False)

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
                start_date = ?,
                maturity_date = ?,
                payout_method = ?,
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
                data.get("start_date"),
                data.get("maturity_date"),
                data.get("payout_method"),
                data.get("fund_type"),
                data.get("notes"),
                asset_id,
                user_id
            ))
            
            after_snapshot = json.dumps({**dict(old_row), **data}, ensure_ascii=False)
            cursor.execute("""
            INSERT INTO asset_audit_logs (user_id, asset_id, action, source, description, before_data, after_data)
            VALUES (?, ?, 'UPDATE', ?, ?, ?, ?)
            """, (user_id, asset_id, source, f"修改资产【{data.get('name', '')}】", before_snapshot, after_snapshot))

            conn.commit()
            return cursor.rowcount > 0

    def delete_asset(self, asset_id: int, user_id: str, source: str = "MANUAL") -> bool:
        import json
        with self._get_conn() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute("SELECT * FROM assets WHERE id = ? AND user_id = ?", (asset_id, user_id))
            old_row = cursor.fetchone()
            if not old_row:
                return False
            before_snapshot = json.dumps(dict(old_row), ensure_ascii=False)
            asset_name = old_row["name"]

            cursor.execute("DELETE FROM assets WHERE id = ? AND user_id = ?", (asset_id, user_id))
            
            cursor.execute("""
            INSERT INTO asset_audit_logs (user_id, asset_id, action, source, description, before_data, after_data)
            VALUES (?, ?, 'DELETE', ?, ?, ?, NULL)
            """, (user_id, asset_id, source, f"删除资产【{asset_name}】", before_snapshot))

            conn.commit()
            return cursor.rowcount > 0

    def batch_add_assets(self, user_id: str, items: List[Dict[str, Any]], source: str = "AI_OCR", description: str = "AI 识别批量录入") -> List[int]:
        import json
        created_ids = []
        with self._get_conn() as conn:
            cursor = conn.cursor()
            created_records = []
            for data in items:
                cursor.execute("""
                INSERT INTO assets (user_id, category, name, code, amount, shares, cost_price, annual_rate, deposit_type, start_date, maturity_date, payout_method, fund_type, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    data.get("start_date"),
                    data.get("maturity_date"),
                    data.get("payout_method"),
                    data.get("fund_type"),
                    data.get("notes"),
                ))
                aid = cursor.lastrowid
                created_ids.append(aid)
                created_records.append({**data, "id": aid})

            after_snapshot = json.dumps(created_records, ensure_ascii=False)
            cursor.execute("""
            INSERT INTO asset_audit_logs (user_id, asset_id, action, source, description, before_data, after_data)
            VALUES (?, NULL, 'BATCH_IMPORT', ?, ?, NULL, ?)
            """, (user_id, source, f"{description} (共 {len(created_ids)} 笔)", after_snapshot))

            conn.commit()
        return created_ids

    def batch_delete_assets(self, user_id: str, asset_ids: List[int], source: str = "ROLLBACK") -> bool:
        if not asset_ids:
            return True
        import json
        with self._get_conn() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            placeholders = ",".join("?" for _ in asset_ids)
            cursor.execute(f"SELECT * FROM assets WHERE id IN ({placeholders}) AND user_id = ?", (*asset_ids, user_id))
            rows = cursor.fetchall()
            if not rows:
                return False
            before_snapshot = json.dumps([dict(r) for r in rows], ensure_ascii=False)

            cursor.execute(f"DELETE FROM assets WHERE id IN ({placeholders}) AND user_id = ?", (*asset_ids, user_id))
            
            cursor.execute("""
            INSERT INTO asset_audit_logs (user_id, asset_id, action, source, description, before_data, after_data)
            VALUES (?, NULL, 'DELETE', ?, ?, ?, NULL)
            """, (user_id, source, f"批量撤销/删除资产 (共 {len(rows)} 笔)", before_snapshot))

            conn.commit()
        return True

    def get_asset_audit_logs(self, user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("""
            SELECT * FROM asset_audit_logs 
            WHERE user_id = ? 
            ORDER BY id DESC 
            LIMIT ?
            """, (user_id, limit))
            rows = cursor.fetchall()
            return [dict(r) for r in rows]

    def rollback_asset_action(self, user_id: str, log_id: int) -> Dict[str, Any]:
        import json
        with self._get_conn() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM asset_audit_logs WHERE id = ? AND user_id = ?", (log_id, user_id))
            log = cursor.fetchone()
            if not log:
                return {"status": "error", "message": "审计日志不存在"}

            action = log["action"]
            before_data = json.loads(log["before_data"]) if log["before_data"] else None
            after_data = json.loads(log["after_data"]) if log["after_data"] else None

            if action in ("CREATE", "BATCH_IMPORT"):
                # 回滚创建/批量导入 -> 删除对应资产
                if isinstance(after_data, list):
                    ids = [item.get("id") for item in after_data if item.get("id")]
                elif isinstance(after_data, dict) and after_data.get("id"):
                    ids = [after_data["id"]]
                else:
                    ids = [log["asset_id"]] if log["asset_id"] else []

                if ids:
                    placeholders = ",".join("?" for _ in ids)
                    cursor.execute(f"DELETE FROM assets WHERE id IN ({placeholders}) AND user_id = ?", (*ids, user_id))
                
                cursor.execute("""
                INSERT INTO asset_audit_logs (user_id, asset_id, action, source, description, before_data, after_data)
                VALUES (?, ?, 'ROLLBACK', 'ROLLBACK', ?, ?, NULL)
                """, (user_id, log["asset_id"], f"回滚操作: 撤销【{log['description']}】", log["after_data"]))

            elif action == "DELETE":
                # 回滚删除 -> 恢复被删数据
                items_to_restore = before_data if isinstance(before_data, list) else ([before_data] if before_data else [])
                for data in items_to_restore:
                    cursor.execute("""
                    INSERT INTO assets (id, user_id, category, name, code, amount, shares, cost_price, annual_rate, deposit_type, start_date, maturity_date, payout_method, fund_type, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        data.get("id"),
                        user_id,
                        data.get("category"),
                        data.get("name"),
                        data.get("code"),
                        data.get("amount"),
                        data.get("shares"),
                        data.get("cost_price"),
                        data.get("annual_rate"),
                        data.get("deposit_type"),
                        data.get("start_date"),
                        data.get("maturity_date"),
                        data.get("payout_method"),
                        data.get("fund_type"),
                        data.get("notes"),
                    ))
                cursor.execute("""
                INSERT INTO asset_audit_logs (user_id, asset_id, action, source, description, before_data, after_data)
                VALUES (?, ?, 'ROLLBACK', 'ROLLBACK', ?, NULL, ?)
                """, (user_id, log["asset_id"], f"回滚操作: 恢复【{log['description']}】", log["before_data"]))

            elif action == "UPDATE":
                # 回滚修改 -> 恢复修改前的值
                if before_data and before_data.get("id"):
                    data = before_data
                    cursor.execute("""
                    UPDATE assets SET
                        category = ?, name = ?, code = ?, amount = ?, shares = ?, cost_price = ?,
                        annual_rate = ?, deposit_type = ?, start_date = ?, maturity_date = ?,
                        payout_method = ?, fund_type = ?, notes = ?, updated_at = datetime('now')
                    WHERE id = ? AND user_id = ?
                    """, (
                        data.get("category"), data.get("name"), data.get("code"),
                        data.get("amount"), data.get("shares"), data.get("cost_price"),
                        data.get("annual_rate"), data.get("deposit_type"), data.get("start_date"),
                        data.get("maturity_date"), data.get("payout_method"), data.get("fund_type"),
                        data.get("notes"), data.get("id"), user_id
                    ))
                    cursor.execute("""
                    INSERT INTO asset_audit_logs (user_id, asset_id, action, source, description, before_data, after_data)
                    VALUES (?, ?, 'ROLLBACK', 'ROLLBACK', ?, ?, ?)
                    """, (user_id, log["asset_id"], f"回滚操作: 恢复【{data.get('name')}】为修改前数据", log["after_data"], log["before_data"]))

            conn.commit()
            return {"status": "ok", "message": "回滚成功"}

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

    # ─── AI 对话会话持久化 ─────────────────────────────────────────

    def create_chat_session(self, user_id: str, title: str = "新对话") -> str:
        session_id = str(uuid.uuid4())
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at)
            VALUES (?, ?, ?, datetime('now'), datetime('now'))
            """, (session_id, user_id, title))
            conn.commit()
        return session_id

    def get_user_chat_sessions(self, user_id: str) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC",
                (user_id,)
            )
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    def get_chat_session(self, session_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        with self._get_conn() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?",
                (session_id, user_id)
            )
            row = cursor.fetchone()
            return dict(row) if row else None

    def update_chat_session(
        self, session_id: str, title: Optional[str] = None, summary: Optional[str] = None
    ):
        with self._get_conn() as conn:
            cursor = conn.cursor()
            if title and summary:
                cursor.execute(
                    "UPDATE chat_sessions SET title = ?, summary = ?, updated_at = datetime('now') WHERE id = ?",
                    (title, summary, session_id)
                )
            elif title:
                cursor.execute(
                    "UPDATE chat_sessions SET title = ?, updated_at = datetime('now') WHERE id = ?",
                    (title, session_id)
                )
            elif summary:
                cursor.execute(
                    "UPDATE chat_sessions SET summary = ?, updated_at = datetime('now') WHERE id = ?",
                    (summary, session_id)
                )
            else:
                cursor.execute(
                    "UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = ?",
                    (session_id,)
                )
            conn.commit()

    def delete_chat_session(self, session_id: str, user_id: str) -> bool:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM chat_messages WHERE session_id = ?", (session_id,))
            cursor.execute("DELETE FROM chat_sessions WHERE id = ? AND user_id = ?", (session_id, user_id))
            conn.commit()
            return cursor.rowcount > 0

    def get_session_messages(self, session_id: str) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM chat_messages WHERE session_id = ? ORDER BY timestamp ASC",
                (session_id,)
            )
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    def add_chat_message(self, session_id: str, role: str, content: str) -> str:
        msg_id = str(uuid.uuid4())
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO chat_messages (id, session_id, role, content, timestamp)
            VALUES (?, ?, ?, ?, datetime('now'))
            """, (msg_id, session_id, role, content))
            cursor.execute("UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = ?", (session_id,))
            conn.commit()
        return msg_id

storage_db = StorageDB()

