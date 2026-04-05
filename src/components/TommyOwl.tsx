import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/theme';

type TommyOwlProps = {
  size?: number;
}

/**
 * Tommy — the Towl owl mascot.
 *
 * Rendered as a styled emoji for now. Replace the inner Text with a react-native-svg
 * implementation to match the full vector design from the web mockup.
 */
export default function TommyOwl({ size = 64 }: TommyOwlProps) {
  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.emoji, { fontSize: size * 0.55 }]}>🦉</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.mintBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: Colors.mintPale,
  },
  emoji: {
    lineHeight: undefined,
  },
});
