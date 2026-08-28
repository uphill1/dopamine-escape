-- dopamine-escape: initial schema
-- 데모 프로토타입용. RLS는 의도적으로 켜지 않는다 (단일 더미 유저, 인증 없이 anon key로 동작).

create extension if not exists pgcrypto;

-- ============================================================
-- goals
-- ============================================================
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  target_date date not null,
  category text not null check (category in ('exam', 'cert', 'language')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- plan_days
-- ============================================================
create table if not exists plan_days (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals (id) on delete cascade,
  date date not null,
  planned_minutes int not null,
  status text not null default 'pending' check (status in ('pending', 'done', 'missed')),
  replanned_count int not null default 0
);

create index if not exists plan_days_goal_id_idx on plan_days (goal_id);

-- ============================================================
-- tasks
-- ============================================================
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  plan_day_id uuid not null references plan_days (id) on delete cascade,
  title text not null,
  est_minutes int not null,
  status text not null default 'pending' check (status in ('pending', 'done', 'missed')),
  completed_at timestamptz
);

create index if not exists tasks_plan_day_id_idx on tasks (plan_day_id);

-- ============================================================
-- nudges
-- ============================================================
create table if not exists nudges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  task_id uuid not null references tasks (id) on delete cascade,
  sent_at timestamptz not null,
  channel text not null default 'push',
  message text not null,
  responded_at timestamptz,
  response text check (response in ('start', 'snooze', 'ignore'))
);

create index if not exists nudges_task_id_idx on nudges (task_id);
create index if not exists nudges_user_id_idx on nudges (user_id);

-- ============================================================
-- sessions
-- ============================================================
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  task_id uuid not null references tasks (id) on delete cascade,
  ritual_started_at timestamptz,
  ritual_completed boolean not null default false,
  study_started_at timestamptz,
  study_ended_at timestamptz,
  focus_minutes int
);

create index if not exists sessions_task_id_idx on sessions (task_id);

-- ============================================================
-- model_calls
-- ============================================================
create table if not exists model_calls (
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in ('plan', 'decompose', 'nudge', 'program_match')),
  model_name text not null,
  input_tokens int not null,
  output_tokens int not null,
  credits numeric not null,
  latency_ms int not null,
  created_at timestamptz not null default now()
);

create index if not exists model_calls_purpose_idx on model_calls (purpose);

-- ============================================================
-- programs
-- ============================================================
create table if not exists programs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  deadline date,
  url text,
  summary text
);

-- ============================================================
-- grants (RLS off by default; explicit grant as a safety net so the
-- anon/authenticated keys can freely read/write without auth setup)
-- ============================================================
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
