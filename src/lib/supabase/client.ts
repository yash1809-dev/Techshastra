import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const getEnvVar = (name: string): string | undefined => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) {
      return import.meta.env[name];
    }
  } catch (_e) {}
  try {
    if (typeof process !== 'undefined' && process.env && process.env[name]) {
      return process.env[name];
    }
  } catch (_e) {}
  return undefined;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== 'https://your-project.supabase.co' &&
    supabaseAnonKey !== 'your-anon-key-here' &&
    !supabaseUrl.includes('placeholder')
  );
};

if (!isSupabaseConfigured()) {
  console.warn(
    '[TECHSHASTRA] Supabase credentials not detected or using placeholders. ' +
    'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file to enable live server sync.'
  );
}

// Compute Supabase URL for local dev vs cloud/production
const computeSupabaseUrl = (): string => {
  const isProd = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PROD;
  
  if (
    typeof window !== 'undefined' &&
    supabaseUrl &&
    (supabaseUrl.includes('127.0.0.1') || supabaseUrl.includes('localhost'))
  ) {
    if (isProd) {
      console.error(
        '[TECHSHASTRA] Production build is pointing to a local Supabase URL (127.0.0.1/localhost). ' +
        'Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY with your live Supabase Cloud project credentials.'
      );
      return supabaseUrl;
    }
    return `${window.location.origin}/supabase-proxy`;
  }
  return supabaseUrl || 'https://placeholder.supabase.co';
};

const safeUrl = computeSupabaseUrl();
const safeKey = supabaseAnonKey || 'placeholder-anon-key';

export const supabase: any = createClient<any>(safeUrl, safeKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: (url, options: any = {}) => {
      const headers = new Headers(options?.headers || {});
      if (typeof window !== 'undefined') {
        const token = sessionStorage.getItem('ts_admin_token');
        if (token && !headers.has('x-admin-token')) {
          headers.set('x-admin-token', token);
        }
      }
      return fetch(url, { ...options, headers });
    },
  },
});
