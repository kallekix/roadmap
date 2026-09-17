# Roadmap Planner — deploy to Vercel + Supabase

A Next.js port of the roadmap artifact. Data is stored as a single shared JSON
document in Supabase, so everyone with the link sees and edits the same roadmap.

---

## Step 0 — Install Node.js (one time)

This machine doesn't have Node yet. Install the LTS version:

- Download the macOS installer from <https://nodejs.org> (the "LTS" button), **or**
- If you use Homebrew: `brew install node`

Then open a **new** terminal and confirm:

```bash
node -v   # should print v20.x or v22.x
npm -v
```

## Step 1 — Install dependencies

```bash
cd ~/Documents/Claude/roadmap
npm install
```

## Step 2 — Create the Supabase project + table

1. Go to <https://supabase.com/dashboard> → **New project**. Pick a name, a strong
   database password (save it), and the closest region. Wait ~2 minutes.
2. Open **SQL Editor → New query**, paste the following, and click **Run**:

   ```sql
   -- One shared roadmap document, keyed by a fixed id 'main'.
   create table if not exists roadmap (
     id         text primary key,
     items      jsonb not null default '[]'::jsonb,
     updated_at timestamptz default now()
   );

   alter table roadmap enable row level security;

   -- SHARED-BOARD policies: anyone with the anon key can read & write the doc.
   -- Fine for an internal/trusted team board. See "Locking it down" below.
   create policy "public read"   on roadmap for select using (true);
   create policy "public insert" on roadmap for insert with check (true);
   create policy "public update" on roadmap for update using (true) with check (true);
   ```

   (No row is seeded — the app creates the `main` row automatically on first save,
   starting from the built-in default items.)

3. Go to **Project Settings → API** and copy two values:
   - **Project URL**
   - **anon / public** key

## Step 3 — Add your Supabase keys locally

Edit `.env.local` (already created) and replace the placeholders with the two
values from Step 2:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

## Step 4 — Run locally

```bash
npm run dev
```

Open <http://localhost:3000>. Add/edit/drag items, then refresh — they should
persist. Check **Table Editor → roadmap** in Supabase to see the `main` row.

## Step 5 — Push to GitHub

```bash
git init
git add -A
git commit -m "Roadmap planner: Next.js + Supabase"
# then create a repo on github.com and:
git remote add origin https://github.com/<you>/roadmap.git
git branch -M main
git push -u origin main
```

`.env.local` is gitignored — your keys will NOT be committed. Good.

## Step 6 — Deploy to Vercel

1. Go to <https://vercel.com/new>, **Import** the `roadmap` repo. Vercel
   auto-detects Next.js; no build settings needed.
2. Expand **Environment Variables** and add the same two as in Step 3:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Click **Deploy**. You'll get a live `*.vercel.app` URL in ~1 minute.

Every future `git push` to `main` auto-deploys.

---

## Notes & follow-ups

- **Concurrency is last-write-wins.** Saves are debounced (~600ms). If two people
  edit at the exact same moment, the later save wins. Fine for a small team. To
  make edits sync live between open browsers, add Supabase **Realtime** (ask and
  I'll wire it up — it's a small addition to `app/page.js`).
- **Locking it down.** The policies above let anyone with the URL edit. To restrict
  writing to signed-in users, add [Supabase Auth](https://supabase.com/docs/guides/auth)
  and change the write policies from `with check (true)` to
  `with check (auth.role() = 'authenticated')`.
- **Data shape.** Each item: `{ id, title, area, version, ease, impact, confidence, link, group }`.
  Stored together as one JSON array in `roadmap.items`, preserving drag-and-drop order.

---

## Private app + shareable read-only Versions link

The app now runs in three modes:

- **`/` (owner only).** Reads are locked to the owner by RLS, so non-owners get a
  sign-in screen — never the board or the default items. Sign in to view/edit.
- **`/v/<SHARE_TOKEN>` (public, read-only).** A server component reads the doc with
  the secret key, exposes **only items that have a version**, and renders them
  read-only. Main-only items never reach the browser. Any wrong token → 404.

### Required RLS (run once in SQL Editor)

```sql
-- Reads are owner-only now (the public Versions route uses the secret key instead).
drop policy if exists "public read" on roadmap;
create policy "owner read" on roadmap for select
  using ((auth.jwt() ->> 'email') = 'kalle@paulsson.net');
```

### Extra environment variables

| Variable | Where | Notes |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` **and** Vercel | The `sb_secret_…` key. Server-only — no `NEXT_PUBLIC_` prefix, never committed. |
| `SHARE_TOKEN` | `.env.local` **and** Vercel | Long random string. The public view lives at `/v/<this>`. Change it to revoke the old link. |

Share link: `https://<your-app>.vercel.app/v/<SHARE_TOKEN>`

---

## Normalized storage (one row per initiative) — supersedes the blob

Storage moved from the single `roadmap.items` blob to a normalized `initiatives`
table (one row per item), so two open tabs editing **different** items no longer
overwrite each other's whole document. Order is a float `position` (fractional
rank: a drag is a single-row write). `evidence` (the 9 confidence checkboxes)
lives as jsonb on the row. Reads stay owner-only; `/v/<token>` reads all rows via
the secret key.

Run once in the SQL Editor:

```sql
-- 1. Normalized table.
create table if not exists initiatives (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default '',
  description text not null default '',
  area        text not null default '',
  version     text not null default '',
  ease        int  not null default 0,
  impact      int  not null default 0,
  evidence    jsonb not null default '{}'::jsonb,
  "group"     text not null default 'Next',
  link        text not null default '',
  position    double precision not null default 0,
  updated_at  timestamptz not null default now()
);

alter table initiatives enable row level security;
create policy "owner read"   on initiatives for select using ((auth.jwt() ->> 'email') = 'kalle@paulsson.net');
create policy "owner insert" on initiatives for insert with check ((auth.jwt() ->> 'email') = 'kalle@paulsson.net');
create policy "owner update" on initiatives for update using ((auth.jwt() ->> 'email') = 'kalle@paulsson.net') with check ((auth.jwt() ->> 'email') = 'kalle@paulsson.net');
create policy "owner delete" on initiatives for delete using ((auth.jwt() ->> 'email') = 'kalle@paulsson.net');

-- 2. Migrate the existing blob (roadmap.items) into rows, preserving order.
insert into initiatives (title, description, area, version, ease, impact, evidence, link, "group", position)
select
  coalesce(e->>'title', ''),
  coalesce(e->>'description', ''),
  coalesce(e->>'area', ''),
  coalesce(e->>'version', ''),
  coalesce((e->>'ease')::numeric, 0)::int,
  coalesce((e->>'impact')::numeric, 0)::int,
  coalesce(e->'evidence', '{}'::jsonb),
  coalesce(e->>'link', ''),
  coalesce(nullif(e->>'group', ''), 'Next'),
  ord
from roadmap, jsonb_array_elements(items) with ordinality as t(e, ord)
where roadmap.id = 'main';

-- 3. AFTER verifying the app works against the new table, optionally:
-- drop table roadmap;
```

---

## Archiving versions

Once a version ships, archive it from its **Edit version** dialog (the
"Archive version" button, left of Cancel/Save; it reads "Unarchive version"
for an already-archived one). Archived versions sink to the bottom of the
Versions view with a **green** arrow and label, and on the **Main** view the
initiatives belonging to them are collected at the bottom in a "Released"
group.

Run once in the SQL Editor to add the flag:

```sql
alter table versions add column if not exists archived boolean not null default false;
```

---

## Central versions table — supersedes free-text `initiatives.version`

Versions are now a first-class entity (a version number + a description),
managed from the Versions tab. Initiatives reference a version by id
(`version_id`), not by matching text, so renaming a version's number in its
edit dialog updates everywhere it's used instead of orphaning old rows.

Run once in the SQL Editor:

```sql
-- 1. Central versions table.
create table if not exists versions (
  id          uuid primary key default gen_random_uuid(),
  version     text not null default '',
  description text not null default '',
  created_at  timestamptz not null default now()
);

alter table versions enable row level security;
create policy "owner read"   on versions for select using ((auth.jwt() ->> 'email') = 'kalle@paulsson.net');
create policy "owner insert" on versions for insert with check ((auth.jwt() ->> 'email') = 'kalle@paulsson.net');
create policy "owner update" on versions for update using ((auth.jwt() ->> 'email') = 'kalle@paulsson.net') with check ((auth.jwt() ->> 'email') = 'kalle@paulsson.net');
create policy "owner delete" on versions for delete using ((auth.jwt() ->> 'email') = 'kalle@paulsson.net');

-- 2. Migrate existing free-text initiatives.version values into rows.
insert into versions (version)
select distinct trim(version) from initiatives where trim(version) <> '';

-- 3. Point initiatives at the new table.
alter table initiatives add column if not exists version_id uuid references versions(id) on delete set null;

update initiatives i
set version_id = v.id
from versions v
where trim(i.version) = v.version and trim(i.version) <> '';

-- 4. AFTER verifying the app works against version_id, drop the old text column:
-- alter table initiatives drop column version;
```
