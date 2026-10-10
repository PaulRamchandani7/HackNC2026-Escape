-- Optional Postgres schema if you move off local SQLite.
-- Apply in the Supabase SQL editor. Keep ACHIEVEMENT_SECRET and
-- ACHIEVEMENT_AUTHORITY_SECRET_KEY on the API server only.

create table if not exists players (
  id uuid primary key,
  nickname text not null,
  wallet text,
  created_at bigint not null
);

create table if not exists missions (
  id uuid primary key,
  player_id uuid not null references players(id),
  mission_key text not null,
  started_at bigint not null,
  completed_at bigint,
  expired_at bigint,
  escape_ms bigint,
  hints_used integer not null default 0,
  status text not null
);

create table if not exists submissions (
  id uuid primary key,
  mission_id uuid not null references missions(id),
  challenge_id text not null,
  passed integer not null,
  kind text not null,
  stdout text,
  stderr text,
  created_at bigint not null
);

create table if not exists unlocks (
  mission_id uuid not null references missions(id),
  challenge_id text not null,
  accepted_at bigint not null,
  primary key (mission_id, challenge_id)
);

create table if not exists receipts (
  id uuid primary key,
  mission_id uuid not null,
  player_id uuid not null,
  wallet text not null,
  nonce text not null,
  mac text not null,
  used integer not null default 0,
  created_at bigint not null,
  unique (mission_id, wallet)
);

create table if not exists achievements (
  id uuid primary key,
  receipt_id uuid not null unique references receipts(id),
  player_id uuid not null,
  wallet text not null,
  mission_key text not null,
  signature text,
  status text not null,
  error text,
  confirmed_at bigint,
  created_at bigint not null
);

alter table players enable row level security;
alter table missions enable row level security;
alter table submissions enable row level security;
alter table unlocks enable row level security;
alter table receipts enable row level security;
alter table achievements enable row level security;

-- Public read of confirmed achievements only. Writes go through the API
-- using the service role key, never the anon key in the browser.
create policy "public confirmed achievements"
  on achievements for select
  using (status = 'confirmed');

create table if not exists mission_rooms (
  mission_id uuid not null references missions(id),
  room integer not null,
  slug text not null,
  question_id text not null,
  title text not null,
  difficulty text not null,
  category text not null,
  leetcode_url text not null,
  tags_json text not null,
  metadata_source text not null,
  repeated integer not null default 0,
  primary key (mission_id, room)
);

create table if not exists completed_problems (
  player_id uuid not null references players(id),
  slug text not null,
  completed_at bigint not null,
  primary key (player_id, slug)
);

create table if not exists hint_reveals (
  mission_id uuid not null references missions(id),
  slug text not null,
  hint_index integer not null,
  primary key (mission_id, slug, hint_index)
);

create table if not exists problem_cache (
  cache_key text primary key,
  payload text not null,
  fetched_at bigint not null,
  fresh_until bigint not null
);
