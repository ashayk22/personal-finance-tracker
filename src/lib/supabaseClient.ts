import { PostgrestClient } from '@supabase/postgrest-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const supabase = url && anonKey
  ? new PostgrestClient(`${url.replace(/\/$/, '')}/rest/v1`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    })
  : null;
