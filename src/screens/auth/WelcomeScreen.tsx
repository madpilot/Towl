import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import {
  BubbleText,
  FadeIn,
  OnboardingLayout,
  OnboardingTommy,
  PrimaryButton,
  screenStyles,
} from '@/components/OnboardingKit';
import { Colors, FontSize } from '@/theme';
import type { WelcomeScreenProps } from '@/navigation/types';

export default function WelcomeScreen({ navigation }: WelcomeScreenProps) {
  const [v, setV] = useState(false);
  const [v2, setV2] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setV(true), 300);
    const t2 = setTimeout(() => setV2(true), 900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <OnboardingLayout step={0}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[screenStyles.content, { flexGrow: 1 }]}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={false}
        >
          <BubbleText visible={v}>
            {'Hoot! I\'m Tommy. 👋 '}
            <Text style={{ fontWeight: '600', color: '#555' }}>
              {'Welcome to '}
              <Text style={{ color: Colors.mint, fontWeight: '800' }}>Towl</Text>
              {' — the shopping list that actually makes shopping fun.'}
            </Text>
          </BubbleText>

          <FadeIn visible={v} delay={50} style={{ alignItems: 'center' }}>
            <OnboardingTommy size={110} animate={v} />
          </FadeIn>

          <FadeIn visible={v2} delay={50} style={{ alignItems: 'center', marginTop: 28 }}>
            <Text style={taglineStyles.headline}>Never forget the milk.</Text>
            <Text style={taglineStyles.subline}>
              Fast lists. Smart grouping. Happy shopping.
            </Text>
          </FadeIn>

          <View style={screenStyles.spacer} />

          <FadeIn visible={v2} delay={100}>
            <PrimaryButton onPress={() => navigation.navigate('ServerSetup')} testID="welcome-next-btn">
              Let&apos;s get started →
            </PrimaryButton>
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </OnboardingLayout>
  );
}

const taglineStyles = {
  headline: {
    fontSize: FontSize.title - 4,
    fontWeight: '800' as const,
    color: Colors.mint,
    marginBottom: 6,
    letterSpacing: -0.3,
    textAlign: 'center' as const,
  },
  subline: {
    fontSize: FontSize.small,
    fontWeight: '600' as const,
    color: Colors.textFaded,
    textAlign: 'center' as const,
  },
};
