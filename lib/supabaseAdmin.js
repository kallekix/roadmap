import { createClient } from "@supabase/supabase-js";

// SERVER ONLY. Uses the Supabase *secret* key, which bypasses Row-Level Security.
// SUPABASE_SERVICE_ROLE_KEY is NOT prefixed with NEXT_PUBLIC_, so Next.js never
// inlines it into the browser bundle. Only import this from server components or
// route handlers — never from a "use client" file.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, secret, { auth: { persistSession: false } });
}
