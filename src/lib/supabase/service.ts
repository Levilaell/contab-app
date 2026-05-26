import { createClient as createSbClient, type SupabaseClient } from '@supabase/supabase-js';

// Untyped client — bypasses strict row typing.
// API routes / server actions validate payloads via zod before insert.
let cached: SupabaseClient | null = null;

export function createServiceClient(): SupabaseClient {
  if (cached) return cached;
  cached = createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
  return cached;
}
