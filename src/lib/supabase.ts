import { createClient } from '@supabase/supabase-js';

const FALLBACK_SUPABASE_URL = 'https://xuwxzthfyuojcpbedfgb.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'sb_publishable_6Zhqs3gctUAdEoTuO4gBBg_LQ_ANBJU';

const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

const normalizedEnvUrl = envUrl
  .replace(/\/rest\/v1\/?$/i, '')
  .replace(/\/+$/, '');

const supabaseUrl =
  normalizedEnvUrl && /^https?:\/\//i.test(normalizedEnvUrl)
    ? normalizedEnvUrl
    : FALLBACK_SUPABASE_URL;

// Ignore envKey if it is empty or accidentally holds a URL instead of a key
const supabaseAnonKey =
  envKey && !/^https?:\/\//i.test(envKey)
    ? envKey
    : FALLBACK_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
