import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { getServerEnv } from '@/lib/env';

export type AdminClient = SupabaseClient<Database>;

let client: AdminClient | undefined;

export function getSupabaseAdmin(): AdminClient {
  if (!client) {
    const env = getServerEnv();
    client = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
