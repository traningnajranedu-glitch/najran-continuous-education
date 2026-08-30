import { createClient } from "@supabase/supabase-js";

// The browser-side client may use a publishable/anon key only.
// Keep service-role credentials server-side and never expose them here.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbqtmssmnetbnuohnacz.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_6nHVWHU7JzUVkxBzavXdYQ_s-uR4kE7";

export const supabase = url && key
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
