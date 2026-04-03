import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { testConnection } from '@/api/auth';
import * as tokenStore from '@/auth/tokenStore';
import type { ServerSetupScreenProps } from '@/navigation/types';

export default function ServerSetupScreen({ navigation }: ServerSetupScreenProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  async function handleContinue() {
    const trimmed = url.trim();
    if (!trimmed) {
      setError('Please enter your KitchenOwl server URL.');
      return;
    }

    // Basic URL validation
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setError('URL must start with http:// or https://');
      return;
    }

    setError(null);
    setTesting(true);

    try {
      const reachable = await testConnection(trimmed);
      if (!reachable) {
        setError('Could not reach the server. Check the URL and try again.');
        return;
      }
      await tokenStore.saveServerUrl(trimmed);
      navigation.navigate('Login', { serverUrl: trimmed });
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setTesting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Towl</Text>
        <Text style={styles.subtitle}>Enter your KitchenOwl server address</Text>

        <TextInput
          style={[styles.input, error ? styles.inputError : undefined]}
          value={url}
          onChangeText={(v) => { setUrl(v); setError(null); }}
          placeholder="https://kitchenowl.example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          onSubmitEditing={handleContinue}
          editable={!testing}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, testing ? styles.buttonDisabled : undefined]}
          onPress={handleContinue}
          disabled={testing}
          activeOpacity={0.8}
        >
          {testing
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Connect</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1a1a1a',
    marginBottom: 8,
  },
  inputError: {
    borderColor: '#e53e3e',
  },
  errorText: {
    color: '#e53e3e',
    fontSize: 13,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
