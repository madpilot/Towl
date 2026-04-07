import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as authApi from '@/api/auth';
import { onLoginSuccess } from '@/auth/authManager';
import {
  BubbleText,
  EyeIcon,
  FadeIn,
  FieldCard,
  OnboardingLayout,
  OnboardingTommy,
  PrimaryButton,
  inputTextStyle,
  screenStyles,
} from '@/components/OnboardingKit';
import { Colors, Spacing } from '@/theme';
import type { LoginScreenProps } from '@/navigation/types';

export default function LoginScreen({ route }: LoginScreenProps) {
  const { serverUrl } = route.params;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [v, setV] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    const t = setTimeout(() => setV(true), 200);
    return () => clearTimeout(t);
  }, []);

  async function handleLogin() {
    if (!username.trim()) {
      setError('Please enter your username or email.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(serverUrl, username.trim(), password);
      await onLoginSuccess(serverUrl, res.access_token, res.refresh_token, res.user, username.trim(), password);
    } catch (err: unknown) {
      if (authApi.isAxiosAuthError(err) && err.response?.status === 401) {
        setError('Invalid username or password.');
      } else {
        setError('Could not connect to server. Check your network and try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  const bubbleMsg = error || 'Sign in to your KitchenOwl account.';

  return (
    <OnboardingLayout step={2}>
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
            <OnboardingTommy size={80} animate={!loading} />
          </FadeIn>

          {/* Server URL pill */}
          <FadeIn visible={v} delay={100} style={{ marginTop: 14 }}>
            <View style={pillStyles.pill}>
              <View style={pillStyles.dot} />
              <Text style={pillStyles.url} numberOfLines={1}>{serverUrl}</Text>
            </View>
          </FadeIn>

          <FadeIn visible={v} delay={150} style={{ marginTop: 12, gap: 10 }}>
            <FieldCard label="Username">
              <TextInput
                value={username}
                onChangeText={(v) => { setUsername(v); setError(''); }}
                onSubmitEditing={() => passwordRef.current?.focus()}
                placeholder="tommy"
                placeholderTextColor={Colors.textFaded}
                style={inputTextStyle}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                editable={!loading}
              />
            </FieldCard>

            <View style={{ marginTop: Spacing.sm }}>
              <FieldCard label="Password">
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput
                    ref={passwordRef}
                    value={password}
                    onChangeText={(v) => { setPassword(v); setError(''); }}
                    onSubmitEditing={handleLogin}
                    placeholder="••••••••"
                    placeholderTextColor={Colors.textFaded}
                    style={[inputTextStyle, { flex: 1 }]}
                    secureTextEntry={!showPw}
                    returnKeyType="go"
                    editable={!loading}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPw((s) => !s)}
                    hitSlop={8}
                    style={{ paddingLeft: Spacing.sm }}
                  >
                    <EyeIcon visible={showPw} />
                  </TouchableOpacity>
                </View>
              </FieldCard>
            </View>
          </FadeIn>

          <View style={screenStyles.spacer} />

          <FadeIn visible={v} delay={250}>
            <PrimaryButton
              onPress={handleLogin}
              loading={loading}
              testID="login-button"
            >
              {loading ? 'Signing in…' : 'Sign in →'}
            </PrimaryButton>
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </OnboardingLayout>
  );
}

const pillStyles = {
  pill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.mintPale,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.mintLight,
    flexShrink: 0,
  },
  url: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600' as const,
    color: '#888',
  },
};
