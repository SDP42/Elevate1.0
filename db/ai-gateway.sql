-- Private encrypted project/team credentials; no prompt or output logging.
create table if not exists ai_projects (
 id integer primary key check(id between 1 and 6), key_cipher text not null
);
create table if not exists ai_team_access (
 team_id integer primary key references teams(id), project_id integer not null references ai_projects(id),
 key_hash text unique not null, key_cipher text not null, enabled boolean not null default true,
 daily_limit integer not null default 800000 check(daily_limit > 0)
);
create table if not exists ai_requests (
 id uuid primary key, team_id integer not null references teams(id), project_id integer not null references ai_projects(id),
 model text not null, created_at timestamptz not null default clock_timestamp(),
 quota_day date not null default ((clock_timestamp() at time zone 'UTC')::date),
 reserved_tokens integer not null, charged_tokens integer not null, actual_tokens integer,
 status text not null default 'reserved', http_status integer, latency_ms integer
);
create index if not exists ai_requests_team_day on ai_requests(team_id,quota_day);
create index if not exists ai_requests_project_day on ai_requests(project_id,quota_day);
create index if not exists ai_requests_created on ai_requests(created_at);
