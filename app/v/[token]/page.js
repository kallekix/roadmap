import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabaseAdmin";
import App from "@/app/page";

// Always render fresh so the shared view reflects the latest edits.
export const dynamic = "force-dynamic";

// Keep the obscure share link out of search engines.
export const metadata = { robots: { index: false, follow: false } };

export default async function PublicVersions({ params }) {
  const { token } = await params;
  const expected = process.env.SHARE_TOKEN;

  // Obscure-URL gate: only the exact secret token resolves; everything else 404s.
  if (!expected || token !== expected) notFound();

  // Read server-side with the secret key (bypasses RLS). The public view shows
  // every initiative — version groups plus an "Unassigned initiatives" section —
  // so we pass the full list. NOTE: all items are exposed on this obscure URL.
  const admin = createAdminClient();
  const { data } = await admin
    .from("initiatives")
    .select("*")
    .order("position", { ascending: true });

  const all = data || [];

  return <App publicItems={all} />;
}
