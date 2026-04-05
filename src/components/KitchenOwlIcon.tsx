import React from 'react';
import { Text, TextStyle } from 'react-native';
import { getIconChar, FONT_FAMILY } from '@/icons/kitchenowlIcons';

type KitchenOwlIconProps = {
  iconKey: string | null | undefined;
  size?: number;
  style?: TextStyle;
};

/**
 * Renders a KitchenOwl icon using the Items.ttf custom font.
 * Returns null when the icon key has no codepoint in the font.
 */
export default function KitchenOwlIcon({
  iconKey,
  size = 24,
  style,
}: KitchenOwlIconProps) {
  const char = getIconChar(iconKey);
  if (!char) return null;

  return (
    <Text
      style={[{ fontFamily: FONT_FAMILY, fontSize: size }, style]}
      accessibilityLabel={iconKey ?? undefined}
    >
      {char}
    </Text>
  );
}
