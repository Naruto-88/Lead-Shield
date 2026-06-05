import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string) => {
  if (typeof process !== 'undefined' && process.env[key]) {
    return process.env[key];
  }
  // Vite injects import.meta.env
  if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) {
    return (import.meta as any).env[key];
  }
  return '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL') || 'https://missing-env-var.supabase.co';
const supabaseKey = getEnv('VITE_SUPABASE_ANON_KEY') || 'missing-key';

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Supabase credentials not found. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
