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

  // Read server-side with the secret key (bypasses RLS), then expose ONLY
  // version-bearing items. Main-only items never leave the server.
  const admin = createAdminClient();
  const { data } = await admin
    .from("roadmap")
    .select("items")
    .eq("id", "main")
    .maybeSingle();

  const all = data && Array.isArray(data.items) ? data.items : [];
  const versionItems = all.filter((i) => String(i.version || "").trim() !== "");

  return <App publicItems={versionItems} />;
}
