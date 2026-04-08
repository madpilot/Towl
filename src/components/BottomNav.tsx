import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import TommyOwl from '@/components/TommyOwl';
import ListsIcon from '@/components/icons/ListsIcon';
import SettingsIcon from '@/components/icons/SettingsIcon';
import { Colors, Spacing, FontSize, Radii } from '@/theme';
import type { MainStackParamList } from '@/navigation/types';

type ActiveTab = 'lists' | 'settings';

type BottomNavProps = {
  active: ActiveTab;
};

export default function BottomNav({ active }: BottomNavProps) {
  const navigation = useNavigation<NavigationProp<MainStackParamList>>();

  return (
    <View style={styles.bar}>
      <TouchableOpacity
        style={styles.navBtn}
        onPress={() => navigation.reset({ index: 0, routes: [{ name: 'ListDetail' }] })}
        activeOpacity={0.7}
      >
        <ListsIcon color={active === 'lists' ? Colors.mintLight : Colors.mint} size={24} />
        <Text style={[styles.navLabel, active !== 'lists' && styles.navLabelFaded]}>Lists</Text>
      </TouchableOpacity>

      <View style={styles.owlGap} />

      <TouchableOpacity
        style={styles.navBtn}
        onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Settings' }] })}
        activeOpacity={0.7}
      >
        <SettingsIcon color={active === 'settings' ? Colors.mintLight : Colors.mint} size={24} />
        <Text style={[styles.navLabel, active !== 'settings' && styles.navLabelFaded]}>Settings</Text>
      </TouchableOpacity>

      <View style={styles.owlWrap}>
        <TommyOwl size={64} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radii.xl + 4,
    borderTopRightRadius: Radii.xl + 4,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.xxl * 2,
    shadowColor: Colors.mint,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 8,
  },
  navBtn: {
    alignItems: 'center',
    gap: Spacing.xs,
    minWidth: 48,
  },
  owlGap: {
    flex: 1,
  },
  navLabel: {
    fontSize: FontSize.tiny,
    fontWeight: '800',
    color: Colors.mintLight,
  },
  navLabelFaded: {
    color: Colors.mint,
  },
  owlWrap: {
    position: 'absolute',
    top: -44,
    left: '50%',
    transform: [{ translateX: -32 }],
  },
});
