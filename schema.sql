-- Roadmap Planner — full database schema (fresh install).
--
-- Run this ONCE in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
--
-- ⚠️  BEFORE RUNNING: replace every  you@example.com  below with YOUR OWN email
--     (the address you'll sign in with). In the SQL Editor use Find & Replace
--     (Cmd/Ctrl+F) and "Replace all". This same email must also be set as
--     NEXT_PUBLIC_OWNER_EMAIL in .env.local and in Vercel.
--
-- This is the complete, final schema — no migrations to run after it.

-- ── versions ────────────────────────────────────────────────────────────────
-- One row per roadmap version (e.g. "2.0"). Initiatives reference a version by
-- id, so renaming a version's number never orphans its initiatives.
create table if not exists versions (
  id          uuid primary key default gen_random_uuid(),
  version     text not null default '',
  description text not null default '',
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ── initiatives ─────────────────────────────────────────────────────────────
-- One row per initiative. Ordering is the float `position` (fractional rank, so
-- a drag is a single-row write). `evidence` holds the confidence checkboxes.
create table if not exists initiatives (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default '',
  description text not null default '',
  area        text not null default '',
  version_id  uuid references versions(id) on delete set null,
  ease        int  not null default 0,
  impact      int  not null default 0,
  evidence    jsonb not null default '{}'::jsonb,
  "group"     text not null default 'Next',   -- "group" is a reserved word; keep it quoted
  link        text not null default '',
  position    double precision not null default 0,
  updated_at  timestamptz not null default now()
);

-- ── Row-Level Security ───────────────────────────────────────────────────────
-- Reads AND writes are locked to the single owner. The browser's publishable
-- key can therefore read nothing until the owner is signed in; the public
-- read-only view at /v/<SHARE_TOKEN> is served by the server using the secret
-- key, which bypasses RLS.
alter table versions    enable row level security;
alter table initiatives enable row level security;

create policy "owner read versions"   on versions for select using ((auth.jwt() ->> 'email') = 'you@example.com');
create policy "owner insert versions" on versions for insert with check ((auth.jwt() ->> 'email') = 'you@example.com');
create policy "owner update versions" on versions for update using ((auth.jwt() ->> 'email') = 'you@example.com') with check ((auth.jwt() ->> 'email') = 'you@example.com');
create policy "owner delete versions" on versions for delete using ((auth.jwt() ->> 'email') = 'you@example.com');

create policy "owner read initiatives"   on initiatives for select using ((auth.jwt() ->> 'email') = 'you@example.com');
create policy "owner insert initiatives" on initiatives for insert with check ((auth.jwt() ->> 'email') = 'you@example.com');
create policy "owner update initiatives" on initiatives for update using ((auth.jwt() ->> 'email') = 'you@example.com') with check ((auth.jwt() ->> 'email') = 'you@example.com');
create policy "owner delete initiatives" on initiatives for delete using ((auth.jwt() ->> 'email') = 'you@example.com');
