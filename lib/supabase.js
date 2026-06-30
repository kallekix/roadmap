import { createClient } from "@supabase/supabase-js";

// These are read at build time and inlined into the client bundle.
// The anon key is safe to expose in the browser BECAUSE row-level security
// (RLS) policies on the table govern what it is allowed to do.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(url, anonKey);
