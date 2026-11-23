# Roadmap Planner

A small single-owner product-roadmap app: a table of initiatives scored by
**Ease × Impact × Confidence**, grouped into Next / Later / Future and organised
into versions. You get a **private editor** (only you can sign in and edit) plus
an optional **public read-only link** you can share with anyone.

Built with **Next.js** + **Supabase** (database + auth) + **Vercel** (hosting) —
all on free tiers. Styling is plain inline styles; no Tailwind, no build magic.

> Deploying your own copy? Follow the steps below. You can also hand this whole
> repo to Claude Code (`CLAUDE.md` orients it) and have it walk you through — but
> you'll still need to do the account/click steps yourself.

---

## What you'll need

- **Node.js 20+** — <https://nodejs.org> (LTS) or `brew install node`. Check with `node -v`.
- A free **Supabase** account — <https://supabase.com>
- A free **Vercel** account — <https://vercel.com>
- This repo (you're reading it — if you used "Use this template", you already have your own copy).

---

## Step 1 — Get the code and install dependencies

Clone your repo (the one "Use this template" created in your account) and install:

```bash
git clone https://github.com/YOUR-USERNAME/YOUR-REPO.git
cd YOUR-REPO
npm install
```

## Step 2 — Create the Supabase project + tables

1. <https://supabase.com/dashboard> → **New project**. Pick a name, a strong
   database password (save it), the closest region. Wait ~2 minutes.
2. Open **`schema.sql`** from this repo. Replace every `you@example.com` with the
   email you'll sign in with (Find & Replace → Replace all).
3. In Supabase, open **SQL Editor → New query**, paste the edited `schema.sql`,
   and click **Run**. This creates the `versions` and `initiatives` tables and
   locks all access to your email.

## Step 3 — Create your owner login

The app has no sign-up screen — you create the single owner user by hand:

1. Supabase → **Authentication → Users → Add user → Create new user**.
2. Use the **same email** as in Step 2, set a password, and tick **Auto Confirm
   User** (so you can sign in immediately).

## Step 4 — Configure environment variables

1. In Supabase, go to **Project Settings → API** and copy the **Project URL**,
   the **publishable** key, and the **secret** key.
2. In this repo:

   ```bash
   cp .env.local.example .env.local
   ```

   Then fill in `.env.local`:

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_OWNER_EMAIL` | the email from Steps 2 & 3 |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL (just the `https://…supabase.co` origin) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the **publishable** key |
   | `SUPABASE_SERVICE_ROLE_KEY` | the **secret** key (server-only, never exposed) |
   | `SHARE_TOKEN` | a long random string — `openssl rand -hex 20` |

   `.env.local` is gitignored, so your keys are never committed.

## Step 5 — Run it locally

```bash
npm run dev
```

Open <http://localhost:3000>, sign in with your owner email + password, and add
some initiatives. The public read-only view is at
<http://localhost:3000/v/YOUR_SHARE_TOKEN>.

## Step 6 — Deploy to Vercel

1. Push your repo to GitHub (if you used the template, it's already there).
2. <https://vercel.com/new> → **Import** your repo. Next.js is auto-detected.
3. Expand **Environment Variables** and add the **same five** values from your
   `.env.local` (including `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_OWNER_EMAIL`).
4. **Deploy**. You'll get a live `*.vercel.app` URL in ~1 minute. Every future
   `git push` to `main` auto-deploys.

Share link: `https://<your-app>.vercel.app/v/<SHARE_TOKEN>`

---

## How it works

- **`/` (owner only).** RLS locks all reads to your email, so anyone who isn't
  signed in as you gets a sign-in screen — never your data.
- **`/v/<SHARE_TOKEN>` (public, read-only).** A server component reads the data
  with the secret key and renders it read-only, in three tabs: Planned versions,
  Roadmap (unassigned initiatives), and Released versions. Any wrong token → 404.
  Everything on the board is visible on this URL, so only share it with people
  who should see the whole roadmap.
- **Confidence** is derived from weighted evidence checkboxes (not stored).
- **Archiving a version** (from its edit dialog) moves its initiatives into a
  "Released" group and sends the version to the bottom.

## Tips & gotchas

- **To revoke a public link**, change `SHARE_TOKEN` (locally and in Vercel). The
  old URL immediately 404s.
- **To change the owner later**, update `NEXT_PUBLIC_OWNER_EMAIL` (local + Vercel)
  *and* re-run the RLS policies in `schema.sql` with the new email.
- **After a deploy, confirm Vercel actually built your latest commit** (Deployments
  tab) before deciding a change "didn't show up".
- CSV **Import/Export** round-trips the whole board, including the evidence
  checkboxes (one column per factor).
