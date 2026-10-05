-- Additive migration: files stay separate from existing team submissions.
create table if not exists submission_files (
  id serial primary key,
  team_id integer not null references teams(id) on delete cascade,
  kind text not null check (kind in ('pdf', 'pptx', 'md', 'txt')),
  name text not null,
  mime_type text not null,
  size integer not null check (size > 0 and size <= 3145728),
  content bytea not null,
  uploaded_at timestamptz not null default now(),
  unique (team_id, kind)
);
