import { createClient } from "@supabase/supabase-js";

// Browser client is intentionally tied to the dedicated knowledge_base project.
// Only the publishable/anon key is allowed here; service-role stays server-side.
const url = "https://cbqtmssmnetbnuohnacz.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_6nHVWHU7JzUVkxBzavXdYQ_s-uR4kE7";

export const supabase = key
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
