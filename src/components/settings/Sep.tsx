import React from 'react';
import { View } from 'react-native';
import { Colors, Spacing } from '@/theme';

export function Sep() {
  return <View style={{ height: 1, backgroundColor: Colors.mintBg, marginLeft: Spacing.xl }} />;
}
