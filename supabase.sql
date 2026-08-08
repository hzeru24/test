-- PUBLIC JOURNAL DATABASE
-- Run this in Supabase SQL Editor.
-- If you already created the table/policies, use the verification
-- section at the bottom instead of blindly recreating them.

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

-- Basic database-level length protection.
alter table public.journal_entries
  drop constraint if exists journal_title_length;

alter table public.journal_entries
  add constraint journal_title_length
  check (char_length(trim(title)) between 1 and 120);

alter table public.journal_entries
  drop constraint if exists journal_content_length;

alter table public.journal_entries
  add constraint journal_content_length
  check (char_length(content) between 1 and 30000);

-- RLS
alter table public.journal_entries enable row level security;

-- Data API privileges.
grant select, insert on table public.journal_entries to anon;

-- Remove public edit/delete privileges if they were ever granted.
revoke update, delete on table public.journal_entries from anon;

-- Recreate the public read policy.
drop policy if exists "Public can read journal entries"
on public.journal_entries;

create policy "Public can read journal entries"
on public.journal_entries
for select
to anon
using (true);

-- Recreate the public insert policy.
drop policy if exists "Public can create journal entries"
on public.journal_entries;

create policy "Public can create journal entries"
on public.journal_entries
for insert
to anon
with check (
  char_length(trim(title)) between 1 and 120
  and char_length(content) between 1 and 30000
);

-- IMPORTANT:
-- There is deliberately NO UPDATE policy and NO DELETE policy
-- for anonymous visitors.

-- OPTIONAL VERIFICATION:
-- select * from public.journal_entries order by created_at desc;
-- select grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and table_name = 'journal_entries';
