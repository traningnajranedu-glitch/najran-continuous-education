import { createClient } from "@supabase/supabase-js";

// Browser client is pinned to the dedicated knowledge_base project.
// Never expose the service-role key here.
const url = "https://cbqtmssmnetbnuohnacz.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

export const supabase = key
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
