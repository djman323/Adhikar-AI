import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.getenv("ADHIKAR_DATA_DIR", str(ROOT_DIR / "data")))
DB_PATH = Path(os.getenv("ADHIKAR_DB_PATH", str(DATA_DIR / "adhikar.sqlite3")))


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class ChatStore:
    def __init__(self, db_path: Path | str = DB_PATH) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize_schema()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(str(self.db_path))
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA journal_mode = WAL")
        connection.execute("PRAGMA synchronous = NORMAL")
        return connection

    def _initialize_schema(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id TEXT PRIMARY KEY,
                    response_style TEXT NOT NULL DEFAULT 'friendly_concise',
                    clarification_active INTEGER NOT NULL DEFAULT 0,
                    clarification_turn INTEGER NOT NULL DEFAULT 0,
                    clarification_candidate_query TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS turns (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    user_query TEXT NOT NULL,
                    assistant_response TEXT NOT NULL,
                    needs_clarification INTEGER NOT NULL DEFAULT 0,
                    sources_json TEXT NOT NULL DEFAULT '[]',
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_turns_session_created
                ON turns(session_id, created_at, id);
                """
            )

    def upsert_session(self, session_id: str, response_style: Optional[str] = None) -> None:
        if not session_id:
            return

        now = _utc_now()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT OR IGNORE INTO sessions (
                    session_id,
                    response_style,
                    clarification_active,
                    clarification_turn,
                    clarification_candidate_query,
                    created_at,
                    updated_at
                )
                VALUES (?, COALESCE(?, 'friendly_concise'), 0, 0, '', ?, ?)
                """,
                (session_id, response_style, now, now),
            )

            if response_style is not None:
                connection.execute(
                    "UPDATE sessions SET response_style = ?, updated_at = ? WHERE session_id = ?",
                    (response_style, now, session_id),
                )
            else:
                connection.execute(
                    "UPDATE sessions SET updated_at = ? WHERE session_id = ?",
                    (now, session_id),
                )

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM sessions WHERE session_id = ?",
                (session_id,),
            ).fetchone()
        return dict(row) if row else None

    def set_response_style(self, session_id: str, response_style: str) -> None:
        self.upsert_session(session_id, response_style=response_style)
        now = _utc_now()
        with self._connect() as connection:
            connection.execute(
                "UPDATE sessions SET response_style = ?, updated_at = ? WHERE session_id = ?",
                (response_style, now, session_id),
            )

    def set_clarification_state(self, session_id: str, active: bool, turn: int, candidate_query: str) -> None:
        self.upsert_session(session_id)
        now = _utc_now()
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE sessions
                SET clarification_active = ?,
                    clarification_turn = ?,
                    clarification_candidate_query = ?,
                    updated_at = ?
                WHERE session_id = ?
                """,
                (1 if active else 0, turn, candidate_query, now, session_id),
            )

    def clear_clarification_state(self, session_id: str) -> None:
        self.set_clarification_state(session_id, False, 0, "")

    def save_turn(
        self,
        session_id: str,
        user_query: str,
        assistant_response: str,
        needs_clarification: bool,
        sources: List[Dict[str, Any]],
    ) -> None:
        self.upsert_session(session_id)
        now = _utc_now()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO turns (
                    session_id,
                    user_query,
                    assistant_response,
                    needs_clarification,
                    sources_json,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    session_id,
                    user_query,
                    assistant_response,
                    1 if needs_clarification else 0,
                    json.dumps(sources, ensure_ascii=True),
                    now,
                ),
            )
            connection.execute(
                "UPDATE sessions SET updated_at = ? WHERE session_id = ?",
                (now, session_id),
            )

    def list_turns(self, session_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT user_query, assistant_response, needs_clarification, sources_json, created_at
                FROM turns
                WHERE session_id = ?
                ORDER BY id ASC
                LIMIT ?
                """,
                (session_id, limit),
            ).fetchall()

        turns: List[Dict[str, Any]] = []
        for row in rows:
            turns.append(
                {
                    "user_query": row["user_query"],
                    "assistant_response": row["assistant_response"],
                    "needs_clarification": bool(row["needs_clarification"]),
                    "sources": json.loads(row["sources_json"] or "[]"),
                    "created_at": row["created_at"],
                }
            )
        return turns

    def get_history_lines(self, session_id: str, limit: int = 8) -> List[str]:
        turns = self.list_turns(session_id, limit=limit)
        lines: List[str] = []
        for turn in turns:
            lines.append(f"User said: {turn['user_query']}")
            lines.append(f"Assistant said: {turn['assistant_response']}")
        return lines[-limit:]
