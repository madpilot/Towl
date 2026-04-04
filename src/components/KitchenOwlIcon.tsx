import React from 'react';
import { Text, TextStyle } from 'react-native';
import { getIconChar, FONT_FAMILY } from '@/icons/kitchenowlIcons';

interface KitchenOwlIconProps {
  iconKey: string | null | undefined;
  fallbackEmoji: string;
  size?: number;
  style?: TextStyle;
}

/**
 * Renders a KitchenOwl icon using the Items.ttf custom font.
 * Falls back to the provided emoji string if the icon key has no codepoint.
 */
export default function KitchenOwlIcon({
  iconKey,
  fallbackEmoji,
  size = 24,
  style,
}: KitchenOwlIconProps) {
  const char = getIconChar(iconKey);

  if (char) {
    return (
      <Text
        style={[{ fontFamily: FONT_FAMILY, fontSize: size }, style]}
        accessibilityLabel={iconKey ?? undefined}
      >
        {char}
      </Text>
    );
  }

  return (
    <Text style={[{ fontSize: size }, style]} accessibilityLabel={iconKey ?? undefined}>
      {fallbackEmoji}
    </Text>
  );
}
