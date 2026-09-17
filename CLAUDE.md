# Roadmap Planner — project guide

A single-file-heavy Next.js app for planning a product roadmap: a table of
initiatives scored by Ease × Impact × Confidence, grouped (Next/Later/Future),
with a private owner editor and a public read-only share link.

## Stack & structure

- **Next.js (JavaScript, App Router)** — not TypeScript. The original was a Claude
  artifact with zero type annotations; keep it JS to avoid strict-TS build breakage.
- **Supabase** (Postgres + Auth) for storage; **Vercel** for hosting. Both free tier.
- **Styling is inline `style={{…}}` objects, NOT Tailwind.** A `C = PALETTES[mode]`
  object holds the dark/light theme; reference `C.textPrimary`, `C.accent`, etc.
  Don't introduce Tailwind or CSS modules.
- Key files:
  - `app/page.js` — the whole app (one big client component `App`). ~800 lines.
  - `lib/supabase.js` — browser client (publishable key).
  - `lib/supabaseAdmin.js` — **server-only** client (secret key); never import from a `"use client"` file.
  - `app/v/[token]/page.js` — server component for the public read-only view.

## Environment / running

- **Node is NOT installed on the dev machine** (no node/npm/brew/nvm). You can edit
  files freely, but you cannot run `npm install`, `npm run dev`, or a build here —
  the user tests locally and on Vercel. Don't assume you can execute the app.
- Env vars (`.env.local`, mirrored in Vercel): `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (a `sb_publishable_…` key),
  `SUPABASE_SERVICE_ROLE_KEY` (a `sb_secret_…` key, server-only, never `NEXT_PUBLIC_`),
  `SHARE_TOKEN` (obscure token for the public URL).

## Data model — `initiatives` and `versions` tables

Storage was migrated from a single JSON blob to normalized tables so that two
tabs editing different items don't clobber each other.

`initiatives` (one row per initiative): `id uuid`, `title`, `description`, `area`,
`version_id uuid` (FK → `versions.id`, nullable, `on delete set null`), `ease int`,
`impact int`, `evidence jsonb`, `"group"` (reserved word — always quote in SQL),
`link`, `position double precision`, `updated_at`.

`versions` (one row per version, managed from the Versions tab): `id uuid`,
`version text` (short label, e.g. "2.0"), `description text`, `created_at`,
`archived boolean` (default false). Archived versions sort to the bottom of the
Versions view with a **green** header (`C.green`); on the Main view their
initiatives leave their normal group and collect in a bottom "Released" card.
Toggled from the version's edit dialog (Archive / Unarchive button).
Versions are central — initiatives reference a version **by id**, not by
matching text, so renaming a version's number (via its edit dialog) updates
everywhere it's used instead of orphaning old rows. Managed with the same
direct-write pattern as auth (no debounce): the edit/add dialog writes on Save.

- **Ordering** is the `position` float (fractional rank). A drag sets the moved
  row's position to the **midpoint between its new neighbours** → one-row write.
  Keep the in-memory `items` array sorted by `position`.
- **Confidence is derived, never stored.** `confidenceOf(item)` sums the weights of
  checked `evidence` factors (the `EVIDENCE` array), capped at 10. Editing happens
  in a modal opened from the Confidence "link" cell.
- IDs are client-generated with `crypto.randomUUID()` for new items and versions.

## Persistence layer (in `App`)

- Load: `select * from initiatives order by position` and `select * from versions`,
  in parallel.
- Initiative writes are **per-row and debounced (~600ms)**: `markDirty(id)` collects
  ids, a timer flushes them as `upsert`s (`toDbRow` maps item→columns). `remove`
  deletes a row; CSV import does a full `replaceAll` (delete all → insert). `itemsRef`
  mirrors latest state for the flush. CSV's free-text "Version" column is resolved
  (or created) against the `versions` table on import, and rendered back out as text
  on export via `versionText(id)`.
- Only the owner writes; RLS rejects anyone else, and the read-only UI never triggers writes.

## Security model

- The owner email is `kalle@paulsson.net`, hardcoded as `OWNER_EMAIL` in `app/page.js`
  **and** in the RLS policies. Changing editors means updating both (or moving to an
  `editors` table).
- RLS on `initiatives` is **owner-only for select/insert/update/delete** (email match
  via `auth.jwt() ->> 'email'`). The publishable key alone can read nothing.
- Three UI modes in `App`: owner (full editor), signed-out (sign-in gate, no data),
  and **public** (`publicItems`/`publicVersions` props passed by the server route →
  read-only, no auth, no Supabase from the browser).
- Public view lives at `/v/<SHARE_TOKEN>`: the server component reads all
  `initiatives` and `versions` rows with the **secret key** and passes them in.
  Wrong token → 404. It uses the same tab control as the editor, with three tabs:
  **Planned versions** (non-archived versions, default), **Roadmap** (unassigned
  initiatives in Next/Later/Future), and **Released versions** (archived versions,
  green headers). All initiatives are exposed on this URL. Public `view` state uses
  `"planned"`/`"roadmap"`/`"released"`; private uses `"main"`/`"versions"`.

## Conventions & gotchas

- **Sticky table headers** require no `overflow` ancestor between `<th>` and the
  scroll root, so the card's `overflow:hidden` and the horizontal-scroll wrapper were
  removed. Consequence: no horizontal scroll on narrow screens (desktop-first, by choice).
- CSV round-trips evidence via **one column per factor** (`1` = checked); the
  "Confidence" column is a computed reference and is ignored on import.
- The drag column / grip handles only render where reordering is allowed (`allowDrag`).
- `Date.now()`/`Math.random()` are fine in app code (the workflow-script restriction
  doesn't apply here).

## Deploy / test loop

1. Edit files. 2. User runs `npm run dev` locally to verify (you can't).
3. Commit + push to `main`; Vercel auto-deploys.
4. **Always confirm the Vercel deployment built the new commit** before checking the
   live site — a silent non-build once caused "my change didn't show up".
5. Schema changes are run by the user in the Supabase SQL Editor (see `README.md`).

## Realtime — not yet

Per-row storage fixed cross-tab clobbering but tabs still need a refresh to see each
other's changes. Live sync (Supabase Realtime subscription + merge) is the planned
next step, not yet built.
