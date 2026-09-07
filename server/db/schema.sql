-- Production DB schema draft (PostgreSQL / Supabase)

create table if not exists player_profiles (
  user_id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists player_stats (
  user_id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists study_answers (
  id bigserial primary key,
  user_id text not null,
  question_id text not null,
  subtheme_id text not null,
  is_correct boolean not null,
  answered_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_study_answers_user_time
  on study_answers(user_id, answered_at desc);

create table if not exists telemetry_events (
  id bigserial primary key,
  user_id text not null,
  event_name text not null,
  created_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_telemetry_user_time
  on telemetry_events(user_id, created_at desc);

-- Question bank (import from data/question-db + embedded via npm run questions:import-supabase)
create table if not exists questions (
  id text primary key,
  theme_id text not null,
  difficulty text not null,
  topic_node_id text,
  source text not null default 'embedded',
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_questions_theme_difficulty
  on questions(theme_id, difficulty);

create index if not exists idx_questions_topic_node
  on questions(topic_node_id)
  where topic_node_id is not null;

create table if not exists question_exclusions (
  question_id text primary key
);

create table if not exists question_overrides (
  question_id text primary key,
  patch jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Audit log (Phase 1 §6.4) — append-only; no update/delete paths in code.
create table if not exists audit_log (
  id bigserial primary key,
  actor_user_id text,
  actor_auth_source text,
  action text not null,
  target text,
  result text not null,
  request_id text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_audit_log_action_time
  on audit_log(action, created_at desc);

create index if not exists idx_audit_log_actor_time
  on audit_log(actor_user_id, created_at desc);

-- Wallet ledger (Phase 1 §8) — append-only; balance = sum(amount).
create table if not exists wallet_ledger (
  id text primary key,
  user_id text not null,
  type text not null,
  amount bigint not null,
  balance_after bigint not null,
  source_type text not null,
  source_id text not null,
  reversal_of text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (source_type, source_id)
);

create index if not exists idx_wallet_ledger_user_time
  on wallet_ledger(user_id, created_at desc);

-- Command-level idempotency (Phase 1 §7.3).
create table if not exists idempotency_keys (
  key text primary key,
  user_id text,
  result jsonb not null,
  created_at timestamptz not null default now()
);

-- One-time legacy profile migration record (Phase 1 §9).
create table if not exists migration_records (
  user_id text primary key,
  source_version int not null default 0,
  migration_version int not null,
  submitted_hash text,
  accepted jsonb not null default '{}'::jsonb,
  rejected jsonb not null default '{}'::jsonb,
  wallet_opening_entry_id text,
  status text not null,
  created_at timestamptz not null default now()
);

