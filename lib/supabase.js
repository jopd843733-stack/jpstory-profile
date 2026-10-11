import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./env.js";

let client;

// service_role 키는 RLS를 우회하므로 서버에서만 사용한다.
export function supabaseAdmin() {
  if (!client) {
    client = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
