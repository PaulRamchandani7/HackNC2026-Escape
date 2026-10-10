import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

const dbPath = process.env.DATABASE_PATH ?? './data/glitchlab.db'
fs.mkdirSync(path.dirname(dbPath), { recursive: true })

export const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
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
`)
