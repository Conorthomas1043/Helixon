// Service-role Supabase client from the environment, for the calibration
// scripts. The loading itself is lib/cv-analysis/calibration/load.js.

import { createClient } from "@supabase/supabase-js";

export { loadScores } from "../../lib/cv-analysis/calibration/load.js";

export function supabaseFromEnv() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
