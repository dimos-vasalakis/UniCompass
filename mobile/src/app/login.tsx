import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { Alert, Button, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { handleAuthLink, signInWithEmail, signInWithOAuth } from '@/lib/auth';
import { supabaseConfigured } from '@/lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');

  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      handleAuthLink(url).catch((e) => Alert.alert('Sign-in failed', String(e.message ?? e)));
    });
    return () => sub.remove();
  }, []);

  const run = (fn: () => Promise<void>, ok?: string) => () =>
    fn()
      .then(() => ok && Alert.alert(ok))
      .catch((e) => Alert.alert('Sign-in failed', String(e.message ?? e)));

  if (!supabaseConfigured) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in mobile/.env.local.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.inner}>
        <ThemedText type="subtitle">UniCompass</ThemedText>
        <Button title="Continue with Google" onPress={run(() => signInWithOAuth('google'))} />
        <Button title="Continue with GitHub" onPress={run(() => signInWithOAuth('github'))} />
        <TextInput
          style={styles.input}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Button
          title="Email me a magic link"
          onPress={run(() => signInWithEmail(email), 'Check your inbox')}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  inner: { gap: 16 },
  input: { borderWidth: 1, borderColor: '#888', borderRadius: 8, padding: 12, color: '#888' },
});
