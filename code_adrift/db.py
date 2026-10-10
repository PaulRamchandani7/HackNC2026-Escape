from __future__ import annotations

import os
import sqlite3
from pathlib import Path

_SCHEMA = """
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  wallet TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  mission_key TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  expired_at INTEGER,
  escape_ms INTEGER,
  hints_used INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  challenge_id TEXT NOT NULL,
  passed INTEGER NOT NULL,
  kind TEXT NOT NULL,
  stdout TEXT,
  stderr TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (mission_id) REFERENCES missions(id)
);

CREATE TABLE IF NOT EXISTS unlocks (
  mission_id TEXT NOT NULL,
  challenge_id TEXT NOT NULL,
  accepted_at INTEGER NOT NULL,
  PRIMARY KEY (mission_id, challenge_id),
  FOREIGN KEY (mission_id) REFERENCES missions(id)
);

CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  wallet TEXT NOT NULL,
  nonce TEXT NOT NULL,
  mac TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE (mission_id, wallet)
);

CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  receipt_id TEXT NOT NULL UNIQUE,
  player_id TEXT NOT NULL,
  wallet TEXT NOT NULL,
  mission_key TEXT NOT NULL,
  signature TEXT,
  status TEXT NOT NULL,
  error TEXT,
  confirmed_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (receipt_id) REFERENCES receipts(id)
);

CREATE INDEX IF NOT EXISTS idx_missions_player ON missions(player_id);
CREATE INDEX IF NOT EXISTS idx_achievements_wallet ON achievements(wallet);
CREATE INDEX IF NOT EXISTS idx_achievements_sig ON achievements(signature);

CREATE TABLE IF NOT EXISTS mission_rooms (
  mission_id TEXT NOT NULL,
  room INTEGER NOT NULL,
  slug TEXT NOT NULL,
  question_id TEXT NOT NULL,
  title TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  category TEXT NOT NULL,
  leetcode_url TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  metadata_source TEXT NOT NULL,
  repeated INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (mission_id, room),
  FOREIGN KEY (mission_id) REFERENCES missions(id)
);

CREATE TABLE IF NOT EXISTS completed_problems (
  player_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  completed_at INTEGER NOT NULL,
  PRIMARY KEY (player_id, slug),
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE TABLE IF NOT EXISTS hint_reveals (
  mission_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  hint_index INTEGER NOT NULL,
  PRIMARY KEY (mission_id, slug, hint_index),
  FOREIGN KEY (mission_id) REFERENCES missions(id)
);

CREATE TABLE IF NOT EXISTS problem_cache (
  cache_key TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  fresh_until INTEGER NOT NULL
);
"""

_connection: sqlite3.Connection | None = None


def get_db() -> sqlite3.Connection:
    global _connection
    if _connection is None:
        db_path = Path(os.environ.get("DATABASE_PATH", "./data/glitchlab.db"))
        db_path.parent.mkdir(parents=True, exist_ok=True)
        _connection = sqlite3.connect(db_path, check_same_thread=False)
        _connection.row_factory = sqlite3.Row
        _connection.execute("PRAGMA journal_mode = WAL")
        _connection.execute("PRAGMA foreign_keys = ON")
        _connection.executescript(_SCHEMA)
        _connection.commit()
    return _connection


def reset_db_for_tests(path: str | Path) -> sqlite3.Connection:
    """Point the module at a fresh database (used by self-check / tests)."""
    global _connection
    if _connection is not None:
        _connection.close()
        _connection = None
    os.environ["DATABASE_PATH"] = str(path)
    return get_db()
