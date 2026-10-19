import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const redirectTo = Linking.createURL('auth/callback');

/** Exchanges the PKCE `code` in a callback URL for a session. */
async function sessionFromUrl(url: string) {
  const code = new URL(url).searchParams.get('code');
  if (!code) throw new Error('No code in callback URL');
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
}

export async function signInWithOAuth(provider: 'google' | 'github') {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw error ?? new Error('No auth URL');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'success') await sessionFromUrl(result.url);
}

export async function signInWithEmail(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
  });
  if (error) throw error;
}

/** Handles the magic-link deep link (unicompass://auth/callback?code=…). */
export async function handleAuthLink(url: string) {
  if (url.includes('auth/callback')) await sessionFromUrl(url);
}
