import { createClient } from "@supabase/supabase-js";

// Falls back to NEXT_PUBLIC_SUPABASE_URL when SUPABASE_URL isn't set - the
// project URL isn't a secret (only the service-role key is), so reusing the
// public one is safe. Without this, every route that imports `supabase`
// (i.e. nearly the whole backend) throws "supabaseUrl is required" at
// import time in any environment that only defines the NEXT_PUBLIC_ var.
export const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);