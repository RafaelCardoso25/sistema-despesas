import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = 'https://mayfrtvoumnwgztjcaxp.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1heWZydHZvdW1ud2d6dGpjYXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNjcxNDAsImV4cCI6MjA5Nzc0MzE0MH0.a4gBsh5ygpCjPlzo3B6z5j06OYQ8kblKPVF0POwNSaI';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession: true,
    storageKey: 'orcamento_session',
    storage: window.localStorage,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
