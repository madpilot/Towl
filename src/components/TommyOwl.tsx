import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { Colors, FontSize, Radii, Spacing } from '@/theme';
import { useNetworkStore } from '@/sync/connectivityMonitor';
import { useSyncStore } from '@/store/syncStore';

// ─── Animated SVG primitives ──────────────────────────────────────────────────

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedPath = Animated.createAnimatedComponent(Path);

// ─── Constants ────────────────────────────────────────────────────────────────

const MINT = Colors.mint;
const MINT_BG = Colors.mintBg;
const YELLOW = Colors.yellow;

type OwlMode = 'idle' | 'sleeping' | 'active' | 'error';

type TommyOwlProps = {
  size?: number;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function TommyOwl({ size = 90 }: TommyOwlProps) {
  const isOnline = useNetworkStore((s) => s.isOnline);
  const syncStatus = useSyncStore((s) => s.status);
  const requestCount = useSyncStore((s) => s.requestCount);
  const errorMessage = useSyncStore((s) => s.errorMessage);

  const mode: OwlMode = !isOnline
    ? 'sleeping'
    : (syncStatus === 'syncing' || requestCount > 0)
    ? 'active'
    : syncStatus === 'error'
    ? 'error'
    : 'idle';

  const [bubbleVisible, setBubbleVisible] = useState(false);

  // ─── Animated values (SVG — no native driver) ──────────────────────────────
  const eyeRy = useRef(new Animated.Value(16)).current;
  const leftCx = useRef(new Animated.Value(70)).current;
  const rightCx = useRef(new Animated.Value(106)).current;
  const worryBrow = useRef(new Animated.Value(0)).current;

  // Highlight circles sit 3 units right of their pupil
  const leftHighlightCx = useRef(Animated.add(leftCx, new Animated.Value(3))).current;
  const rightHighlightCx = useRef(Animated.add(rightCx, new Animated.Value(3))).current;

  // ─── Animated values (overlay — native driver OK) ─────────────────────────
  const bubbleAnim = useRef(new Animated.Value(0)).current;

  // ─── Refs for controlling loops ───────────────────────────────────────────
  const shouldLoop = useRef(false);

  // ─── Derived interpolations ───────────────────────────────────────────────

  // Pupils/highlights fade out as eyes close
  const pupilOpacity = eyeRy.interpolate({
    inputRange: [0, 4, 16],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  });

  // Closed-eye curve lines fade in as eyes close
  const sleepEyeOpacity = eyeRy.interpolate({
    inputRange: [0, 4, 16],
    outputRange: [1, 0, 0],
    extrapolate: 'clamp',
  });

  // Normal brows fade out as worried brows fade in
  const normalBrowOpacity = worryBrow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 0],
  });

  // ─── Active look-around loop ──────────────────────────────────────────────

  function startActiveLoop() {
    shouldLoop.current = true;

    function runCycle() {
      if (!shouldLoop.current) {
        Animated.parallel([
          Animated.timing(leftCx, { toValue: 70, duration: 200, useNativeDriver: false }),
          Animated.timing(rightCx, { toValue: 106, duration: 200, useNativeDriver: false }),
        ]).start();
        return;
      }

      Animated.sequence([
        Animated.delay(500),
        // Look left
        Animated.parallel([
          Animated.timing(leftCx, { toValue: 66, duration: 350, useNativeDriver: false }),
          Animated.timing(rightCx, { toValue: 102, duration: 350, useNativeDriver: false }),
        ]),
        Animated.delay(400),
        // Return centre
        Animated.parallel([
          Animated.timing(leftCx, { toValue: 70, duration: 250, useNativeDriver: false }),
          Animated.timing(rightCx, { toValue: 106, duration: 250, useNativeDriver: false }),
        ]),
        Animated.delay(300),
        // Look right
        Animated.parallel([
          Animated.timing(leftCx, { toValue: 74, duration: 350, useNativeDriver: false }),
          Animated.timing(rightCx, { toValue: 110, duration: 350, useNativeDriver: false }),
        ]),
        Animated.delay(400),
        // Return centre
        Animated.parallel([
          Animated.timing(leftCx, { toValue: 70, duration: 250, useNativeDriver: false }),
          Animated.timing(rightCx, { toValue: 106, duration: 250, useNativeDriver: false }),
        ]),
        Animated.delay(200),
        // Blink
        Animated.timing(eyeRy, { toValue: 2, duration: 80, useNativeDriver: false }),
        Animated.timing(eyeRy, { toValue: 16, duration: 80, useNativeDriver: false }),
        Animated.delay(900),
      ]).start(({ finished }) => {
        if (finished) runCycle();
      });
    }

    runCycle();
  }

  // ─── Mode effect ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (mode === 'sleeping') {
      shouldLoop.current = false;
      Animated.parallel([
        Animated.timing(eyeRy, { toValue: 0, duration: 600, useNativeDriver: false }),
        Animated.timing(worryBrow, { toValue: 0, duration: 200, useNativeDriver: false }),
      ]).start();
      Animated.timing(bubbleAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() =>
        setBubbleVisible(false)
      );
    } else if (mode === 'active') {
      Animated.parallel([
        Animated.timing(eyeRy, { toValue: 16, duration: 300, useNativeDriver: false }),
        Animated.timing(worryBrow, { toValue: 0, duration: 200, useNativeDriver: false }),
      ]).start();
      Animated.timing(bubbleAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() =>
        setBubbleVisible(false)
      );
      startActiveLoop();
    } else if (mode === 'error') {
      shouldLoop.current = false;
      Animated.parallel([
        Animated.timing(eyeRy, { toValue: 16, duration: 300, useNativeDriver: false }),
        Animated.timing(worryBrow, { toValue: 1, duration: 400, useNativeDriver: false }),
      ]).start();
      setBubbleVisible(true);
      Animated.timing(bubbleAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } else {
      // idle
      shouldLoop.current = false;
      Animated.parallel([
        Animated.timing(eyeRy, { toValue: 16, duration: 300, useNativeDriver: false }),
        Animated.timing(leftCx, { toValue: 70, duration: 200, useNativeDriver: false }),
        Animated.timing(rightCx, { toValue: 106, duration: 200, useNativeDriver: false }),
        Animated.timing(worryBrow, { toValue: 0, duration: 300, useNativeDriver: false }),
      ]).start();
      Animated.timing(bubbleAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() =>
        setBubbleVisible(false)
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ─── Dismiss error ────────────────────────────────────────────────────────

  function handleDismissError() {
    useSyncStore.getState().setStatus('idle');
    useSyncStore.getState().setErrorMessage(null);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={{ width: size, height: size }}>
      {/* ── Speech bubble ─────────────────────────────────────────────────── */}
      {bubbleVisible && (
        <Animated.View
          style={[
            styles.bubble,
            {
              bottom: size + 10,
              opacity: bubbleAnim,
              transform: [
                {
                  scale: bubbleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.85, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.bubbleText} numberOfLines={3}>
            {errorMessage ?? 'Unable to sync changes'}
          </Text>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleDismissError}
            hitSlop={8}
            activeOpacity={0.6}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          {/* Tail pointing down */}
          <View style={styles.bubbleTail} />
        </Animated.View>
      )}

      {/* ── Owl SVG ───────────────────────────────────────────────────────── */}
      <Svg width={size} height={size} viewBox="0 0 176 176" fill="none">
        {/* Ear tufts */}
        <Path
          d="M70 68 Q64 50 72 44 Q76 58 78 66Z"
          fill={MINT_BG}
          stroke={MINT}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <Path
          d="M106 68 Q112 50 104 44 Q100 58 98 66Z"
          fill={MINT_BG}
          stroke={MINT}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Body */}
        <Circle cx="88" cy="100" r="62" fill={MINT_BG} stroke={MINT} strokeWidth="3" />

        {/* Chest feathers */}
        <Ellipse
          cx="88"
          cy="103"
          rx="44"
          ry="40"
          fill="none"
          stroke={MINT}
          strokeWidth="1.8"
          opacity="0.35"
        />

        {/* ── Normal eyebrows (fade out when worried) ────────────────────── */}
        <AnimatedPath
          d="M 60 79 Q 70 74 80 77"
          stroke={MINT}
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
          opacity={normalBrowOpacity}
        />
        <AnimatedPath
          d="M 96 77 Q 106 74 116 79"
          stroke={MINT}
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
          opacity={normalBrowOpacity}
        />

        {/* ── Worried eyebrows (fade in on error) ───────────────────────── */}
        <AnimatedPath
          d="M 60 80 Q 70 70 82 76"
          stroke={MINT}
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          opacity={worryBrow}
        />
        <AnimatedPath
          d="M 94 76 Q 106 70 116 80"
          stroke={MINT}
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          opacity={worryBrow}
        />

        {/* ── Left eye ──────────────────────────────────────────────────── */}
        <AnimatedEllipse
          cx="70"
          cy="97"
          rx="16"
          ry={eyeRy}
          fill="white"
          stroke={MINT}
          strokeWidth="2.6"
        />
        <AnimatedCircle cx={leftCx} cy="97" r="9" fill={MINT} opacity={pupilOpacity} />
        <AnimatedCircle cx={leftHighlightCx} cy="93" r="3" fill="white" opacity={pupilOpacity} />

        {/* ── Right eye ─────────────────────────────────────────────────── */}
        <AnimatedEllipse
          cx="106"
          cy="97"
          rx="16"
          ry={eyeRy}
          fill="white"
          stroke={MINT}
          strokeWidth="2.6"
        />
        <AnimatedCircle cx={rightCx} cy="97" r="9" fill={MINT} opacity={pupilOpacity} />
        <AnimatedCircle cx={rightHighlightCx} cy="93" r="3" fill="white" opacity={pupilOpacity} />

        {/* ── Sleeping eye curves (visible when eyes are closed) ─────────── */}
        <AnimatedPath
          d="M 58 97 Q 70 103 82 97"
          stroke={MINT}
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
          opacity={sleepEyeOpacity}
        />
        <AnimatedPath
          d="M 94 97 Q 106 103 118 97"
          stroke={MINT}
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
          opacity={sleepEyeOpacity}
        />

        {/* Beak */}
        <Path
          d="M82 113 Q88 124 94 113 Q88 109 82 113Z"
          fill={YELLOW}
          stroke={MINT}
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    left: -56,
    right: -56,
    backgroundColor: Colors.white,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    paddingRight: Spacing.xl + 4,
    shadowColor: Colors.mint,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  bubbleText: {
    fontSize: FontSize.small,
    color: Colors.textDark,
    fontWeight: '600',
    lineHeight: 18,
  },
  closeBtn: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
  },
  closeBtnText: {
    fontSize: FontSize.small,
    color: Colors.textFaded,
    fontWeight: '700',
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -8,
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: Colors.white,
  },
});
