-- Additive migration: existing project links, files and comments are preserved.
alter table teams add column if not exists submission_links jsonb not null default '[]'::jsonb;
