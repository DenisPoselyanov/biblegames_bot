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

