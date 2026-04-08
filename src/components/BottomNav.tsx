import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import ListsIcon from '@/components/icons/ListsIcon';
import HouseIcon from '@/components/icons/HouseIcon';
import SettingsIcon from '@/components/icons/SettingsIcon';
import { Colors, Spacing, FontSize, Radii } from '@/theme';
import type { MainStackParamList } from '@/navigation/types';

type ActiveTab = 'lists' | 'settings';

type BottomNavProps = {
  active: ActiveTab;
};

type NavBtnProps = {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onPress: () => void;
};

function NavBtn({ icon, label, isActive, onPress }: NavBtnProps) {
  return (
    <TouchableOpacity style={styles.navBtn} onPress={onPress} activeOpacity={0.7}>
      {icon}
      <Text style={[styles.navLabel, !isActive && styles.navLabelFaded]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function BottomNav({ active }: BottomNavProps) {
  const navigation = useNavigation<NavigationProp<MainStackParamList>>();

  return (
    <View style={styles.bar}>
      <NavBtn
        icon={<HouseIcon color={Colors.mint} size={24} />}
        label="Households"
        isActive={false}
        onPress={() => navigation.reset({ index: 0, routes: [{ name: 'HouseholdPicker' }] })}
      />
      <NavBtn
        icon={<ListsIcon color={active === 'lists' ? Colors.mintLight : Colors.mint} size={24} />}
        label="Lists"
        isActive={active === 'lists'}
        onPress={() => navigation.reset({ index: 0, routes: [{ name: 'ListDetail' }] })}
      />
      <NavBtn
        icon={<SettingsIcon color={active === 'settings' ? Colors.mintLight : Colors.mint} size={24} />}
        label="Settings"
        isActive={active === 'settings'}
        onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Settings' }] })}
      />
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
    justifyContent: 'space-around',
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.xxl,
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
  navLabel: {
    fontSize: FontSize.tiny,
    fontWeight: '800',
    color: Colors.mintLight,
  },
  navLabelFaded: {
    color: Colors.mint,
  },
});
