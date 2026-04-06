import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { testConnection } from '@/api/auth';
import * as tokenStore from '@/auth/tokenStore';
import {
  BubbleText,
  FadeIn,
  FieldCard,
  OnboardingLayout,
  OnboardingTommy,
  PrimaryButton,
  inputTextStyle,
  screenStyles,
} from '@/components/OnboardingKit';
import { Colors } from '@/theme';
import type { ServerSetupScreenProps } from '@/navigation/types';

function isValidUrl(s: string): boolean {
  try { new URL(s); return true; } catch { return false; }
}

export default function ServerSetupScreen({ navigation }: ServerSetupScreenProps) {
  const [url, setUrl] = useState('');
  const [focused, setFocused] = useState(false);
  const [v, setV] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setV(true);
      setTimeout(() => inputRef.current?.focus(), 500);
    }, 200);
    return () => clearTimeout(t);
  }, []);

  async function handleConnect() {
    const trimmed = url.trim();
    if (!trimmed) {
      setError('Pop a server URL in there 👆');
      return;
    }
    if (!isValidUrl(trimmed)) {
      setError("Hmm, that doesn't look like a valid URL…");
      return;
    }
    setError('');
    setLoading(true);
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
      setLoading(false);
    }
  }

  const bubbleMsg = error
    || (url.length > 0 ? "Looking good! Hit connect when you're ready." : "What's the address of your KitchenOwl server?");

  const urlValid = isValidUrl(url.trim());

  return (
    <OnboardingLayout step={1}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[screenStyles.content, { flexGrow: 1 }]}
          keyboardShouldPersistTaps="handled"
        >
          <BubbleText visible={v} error={error}>
            {bubbleMsg}
          </BubbleText>

          <FadeIn visible={v} delay={50} style={{ alignItems: 'center' }}>
            <OnboardingTommy size={90} animate={!loading} />
          </FadeIn>

          <FadeIn visible={v} delay={150} style={{ marginTop: 24 }}>
            <FieldCard label="Server URL" focused={focused}>
              <TextInput
                ref={inputRef}
                value={url}
                onChangeText={(v) => { setUrl(v); setError(''); }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onSubmitEditing={handleConnect}
                placeholder="https://kitchenowl.example.com"
                placeholderTextColor={Colors.textFaded}
                style={inputTextStyle}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="go"
                editable={!loading}
              />
              {url.length > 0 && (
                <View style={validatorStyles.row}>
                  <View style={[validatorStyles.dot, { backgroundColor: urlValid ? Colors.mintLight : Colors.deleteRed }]} />
                  <Text style={[validatorStyles.label, { color: urlValid ? Colors.mint : Colors.deleteRedStrong }]}>
                    {urlValid ? 'Valid URL' : 'Invalid URL'}
                  </Text>
                </View>
              )}
            </FieldCard>
          </FadeIn>

          <FadeIn visible={v} delay={200} style={{ marginTop: 10 }}>
            <Text style={screenStyles.hintText}>
              Towl connects to your KitchenOwl server to sync lists across your household.
            </Text>
          </FadeIn>

          <View style={screenStyles.spacer} />

          <FadeIn visible={v} delay={250}>
            <PrimaryButton
              onPress={handleConnect}
              loading={loading}
              testID="connect-btn"
            >
              {loading ? 'Connecting…' : 'Connect →'}
            </PrimaryButton>
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </OnboardingLayout>
  );
}

const validatorStyles = {
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
};
