import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabaseConfigured = /^https?:\/\//.test(url) && key.trim().length > 0;

// Expo Router renders web routes in Node (web.output "server"), where AsyncStorage has no `window`.
const isServer = typeof window === 'undefined';

export const supabase = createClient(url || 'http://localhost', key || 'missing', {
  auth: {
    storage: isServer ? undefined : AsyncStorage,
    autoRefreshToken: !isServer,
    persistSession: !isServer,
    detectSessionInUrl: false,
  },
});
