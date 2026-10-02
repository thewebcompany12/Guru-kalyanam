import { createBrowserClient } from '@supabase/ssr';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xdnynelbxpgqrvrersbg.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_hZCmboekm9zJUMxVVj2mRA_bSk9BCr0';

export function createClient() {
  // Keep the Supabase session in the browser's persistent auth cookies so the
  // user stays signed in when they close and reopen the app on this device.
  // Supabase refreshes expired access tokens while the refresh session remains valid.
  return createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
