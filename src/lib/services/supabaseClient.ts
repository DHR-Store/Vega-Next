// supabaseClient.ts
import 'react-native-url-polyfill/auto';
import {createClient} from '@supabase/supabase-js';

const SUPABASE_URL = 'YOUR SUPABASE URL';
const SUPABASE_ANON_KEY =
  'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,   // Supabase will store the session
    detectSessionInUrl: false,
  },
});