/**
 * Shared components for the onboarding flow.
 *
 * Exports: OnboardingLayout, OnboardingTommy, BubbleText, FieldCard,
 *          PrimaryButton, FadeIn, Spinner, ProgressDots
 */

import React, { useEffect, useMemo } from 'react';
import {
  Animated,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Circle, Ellipse, Line, Path } from 'react-native-svg';
import { Colors, FontSize, Spacing } from '@/theme';

// ─── Design tokens ────────────────────────────────────────────────────────────

const TOTAL_STEPS = 4;

// ─── Progress dots ────────────────────────────────────────────────────────────

type ProgressDotsProps = { step: number };

export function ProgressDots({ step }: ProgressDotsProps) {
  return (
    <View style={dotStyles.row}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View
          key={i}
          style={[
            dotStyles.dot,
            { width: i === step ? 20 : 8 },
            { backgroundColor: i <= step ? Colors.mint : Colors.mintPale },
            i < step && dotStyles.pastDot,
          ]}
        />
      ))}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  pastDot: {
    opacity: 0.35,
  },
});

// ─── Onboarding layout wrapper ────────────────────────────────────────────────

type OnboardingLayoutProps = {
  step: number;
  children: React.ReactNode;
};

export function OnboardingLayout({ step, children }: OnboardingLayoutProps) {
  return (
    <SafeAreaView style={layoutStyles.root}>
      <View style={layoutStyles.wordmarkRow}>
        <Text style={layoutStyles.wordmark}>towl</Text>
      </View>
      <ProgressDots step={step} />
      {children}
    </SafeAreaView>
  );
}

const layoutStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.mintBg,
  },
  wordmarkRow: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? Spacing.xs : Spacing.md,
  },
  wordmark: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.mint,
    letterSpacing: -0.5,
  },
});

// ─── Tommy Owl (onboarding variant) ──────────────────────────────────────────
// React.memo prevents re-renders when parent state (e.g. url text) changes —
// the bob animation's Animated.Value should never be recreated mid-animation.

type OnboardingTommyProps = {
  size?: number;
  animate?: boolean;
};

export const OnboardingTommy = React.memo(function OnboardingTommy({
  size = 80,
  animate = false,
}: OnboardingTommyProps) {
  const bobAnim = useMemo(() => new Animated.Value(0), []);
  // useMemo keeps the interpolation node stable across any re-renders that
  // do occur, preventing React Native from touching the native animation node.
  const translateY = useMemo(
    () => bobAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }),
    [bobAnim]
  );

  useEffect(() => {
    if (!animate) {
      bobAnim.setValue(0);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(bobAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(bobAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [animate, bobAnim]);

  return (
    <Animated.View style={{ transform: [{ translateY }] }}>
      <Svg width={size} height={size} viewBox="0 0 176 176" fill="none">
        {/* Ear tufts */}
        <Path
          d="M70 68 Q64 50 72 44 Q76 58 78 66Z"
          fill={Colors.mintBg}
          stroke={Colors.mint}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <Path
          d="M106 68 Q112 50 104 44 Q100 58 98 66Z"
          fill={Colors.mintBg}
          stroke={Colors.mint}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Body */}
        <Circle cx="88" cy="100" r="62" fill={Colors.mintBg} stroke={Colors.mint} strokeWidth="3" />
        {/* Chest feathers */}
        <Ellipse
          cx="88" cy="103" rx="44" ry="40"
          fill="none" stroke={Colors.mint} strokeWidth="1.8" opacity="0.35"
        />
        {/* Eyebrows */}
        <Path d="M 60 79 Q 70 74 80 77" stroke={Colors.mint} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.45" />
        <Path d="M 96 77 Q 106 74 116 79" stroke={Colors.mint} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.45" />
        {/* Left eye */}
        <Ellipse cx="70" cy="97" rx="16" ry="16" fill="white" stroke={Colors.mint} strokeWidth="2.6" />
        <Circle cx="70" cy="97" r="9" fill={Colors.mint} />
        <Circle cx="73" cy="93" r="3" fill="white" />
        {/* Right eye */}
        <Ellipse cx="106" cy="97" rx="16" ry="16" fill="white" stroke={Colors.mint} strokeWidth="2.6" />
        <Circle cx="106" cy="97" r="9" fill={Colors.mint} />
        <Circle cx="109" cy="93" r="3" fill="white" />
        {/* Beak */}
        <Path
          d="M82 113 Q88 124 94 113 Q88 109 82 113Z"
          fill={Colors.yellow}
          stroke={Colors.mint}
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
});

// ─── Speech bubble ────────────────────────────────────────────────────────────

type SpeechBubbleProps = {
  children: React.ReactNode;
  visible: boolean;
  error?: boolean;
};

function SpeechBubble({ children, visible, error = false }: SpeechBubbleProps) {
  const opacity = useMemo(() => new Animated.Value(0), []);
  const translateY = useMemo(() => new Animated.Value(8), []);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(opacity, { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 120, friction: 8 }),
      ]).start();
    } else {
      opacity.setValue(0);
      translateY.setValue(8);
    }
  }, [visible, opacity, translateY]);

  const borderColor = error ? Colors.deleteRed : Colors.mintPale;

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <View style={[bubbleStyles.bubble, { borderColor }]}>
        {children}
        {/* Outer caret */}
        <View style={[bubbleStyles.caretOuter, { borderTopColor: borderColor }]} />
        {/* Inner caret (white fill) */}
        <View style={bubbleStyles.caretInner} />
      </View>
    </Animated.View>
  );
}

const bubbleStyles = StyleSheet.create({
  bubble: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 18,
    maxWidth: 264,
    shadowColor: Colors.mint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 3,
  },
  caretOuter: {
    position: 'absolute',
    bottom: -12,
    left: 32,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  caretInner: {
    position: 'absolute',
    bottom: -9,
    left: 33,
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: Colors.white,
  },
});

// ─── BubbleText ───────────────────────────────────────────────────────────────

type BubbleTextProps = {
  visible: boolean;
  error?: boolean | string;
  children: React.ReactNode;
};

export function BubbleText({ visible, error, children }: BubbleTextProps) {
  const isError = !!error;
  return (
    <View style={bubbleTextStyles.wrap}>
      <SpeechBubble visible={visible} error={isError}>
        <Text style={[bubbleTextStyles.text, isError && bubbleTextStyles.errorText]}>
          {children}
        </Text>
      </SpeechBubble>
    </View>
  );
}

const bubbleTextStyles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    marginLeft: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  text: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.mint,
    lineHeight: 20,
  },
  errorText: {
    color: Colors.deleteRedStrong,
  },
});

// ─── FadeIn ───────────────────────────────────────────────────────────────────

type FadeInProps = {
  visible: boolean;
  delay?: number; // ms
  style?: ViewStyle;
  children: React.ReactNode;
};

export function FadeIn({ visible, delay = 0, style, children }: FadeInProps) {
  const opacity = useMemo(() => new Animated.Value(0), []);
  const translateY = useMemo(() => new Animated.Value(10), []);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]).start();
      }, delay);
      return () => clearTimeout(timer);
    } else {
      opacity.setValue(0);
      translateY.setValue(10);
    }
  }, [visible, delay, opacity, translateY]);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

// ─── FieldCard ────────────────────────────────────────────────────────────────

type FieldCardProps = {
  label: string;
  children: React.ReactNode;
  style?: ViewStyle;
};

export function FieldCard({ label, children, style }: FieldCardProps) {
  return (
    <View style={[fieldStyles.card, style]}>
      <Text style={fieldStyles.label}>{label}</Text>
      {children}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.mintPale,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 10.5,
    fontWeight: '800',
    color: Colors.mint,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
});

// ─── Spinner ──────────────────────────────────────────────────────────────────

export function Spinner() {
  const spinAnim = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 800, useNativeDriver: true })
    );
    anim.start();
    return () => anim.stop();
  }, [spinAnim]);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View style={{ transform: [{ rotate: spin }] }}>
      <Svg width={18} height={18} viewBox="0 0 18 18">
        <Circle
          cx="9" cy="9" r="7"
          stroke={Colors.mint} strokeWidth="2.5"
          fill="none" strokeDasharray="35" strokeDashoffset="10"
        />
      </Svg>
    </Animated.View>
  );
}

// ─── PrimaryButton ────────────────────────────────────────────────────────────

type PrimaryButtonProps = {
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  children: React.ReactNode;
};

export function PrimaryButton({
  onPress,
  disabled = false,
  loading = false,
  testID,
  children,
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      style={[
        btnStyles.btn,
        loading && btnStyles.btnLoading,
        isDisabled && !loading && btnStyles.btnDisabled,
      ]}
    >
      {loading ? (
        <View style={btnStyles.loadingRow}>
          <Spinner />
          <Text style={btnStyles.textLoading}>{children}</Text>
        </View>
      ) : (
        <Text style={btnStyles.text}>{children}</Text>
      )}
    </TouchableOpacity>
  );
}

const btnStyles = StyleSheet.create({
  btn: {
    width: '100%',
    paddingVertical: 16,
    backgroundColor: Colors.mint,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  btnLoading: {
    backgroundColor: Colors.mintLight,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    color: Colors.white,
    fontSize: FontSize.body,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  textLoading: {
    color: Colors.mint,
    fontSize: FontSize.body,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});

// ─── EyeIcon ──────────────────────────────────────────────────────────────────
// Exposed for the password show/hide toggle in LoginScreen.

type EyeIconProps = { visible: boolean };

export function EyeIcon({ visible }: EyeIconProps) {
  if (visible) {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={Colors.mintLight} strokeWidth="1.8" strokeLinecap="round">
        <Path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
        <Line x1="1" y1="1" x2="23" y2="23" />
      </Svg>
    );
  }
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={Colors.mintLight} strokeWidth="1.8" strokeLinecap="round">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <Circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

// ─── Shared input text style (used by all screens) ────────────────────────────

export const inputTextStyle: TextStyle = {
  fontSize: FontSize.body,
  fontWeight: '600',
  color: Colors.textDark,
};

// ─── Shared screen content style ─────────────────────────────────────────────

export const screenStyles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 4,
    paddingBottom: Spacing.xl,
  },
  spacer: {
    flex: 1,
  },
  hintText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.textFaded,
    textAlign: 'center',
    lineHeight: 18,
  },
});
