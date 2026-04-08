import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import TommyOwl from '@/components/TommyOwl';
import ListsIcon from '@/components/icons/ListsIcon';
import HouseIcon from '@/components/icons/HouseIcon';
import SettingsIcon from '@/components/icons/SettingsIcon';
import { useHouseholdStore } from '@/store/householdStore';
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
  const households = useHouseholdStore((s) => s.households);
  const showHousehold = households.length > 1;

  return (
    <View style={styles.bar}>
      {/* Left side — Lists, and Household switcher when multiple exist */}
      <View style={styles.side}>
        <NavBtn
          icon={<ListsIcon color={active === 'lists' ? Colors.mintLight : Colors.mint} size={24} />}
          label="Lists"
          isActive={active === 'lists'}
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'ListDetail' }] })}
        />
        {showHousehold && (
          <NavBtn
            icon={<HouseIcon color={Colors.mint} size={24} />}
            label="Switch"
            isActive={false}
            onPress={() => navigation.navigate('HouseholdPicker')}
          />
        )}
      </View>

      {/* Spacer for the floating owl */}
      <View style={styles.owlGap} />

      {/* Right side */}
      <View style={styles.side}>
        <NavBtn
          icon={<SettingsIcon color={active === 'settings' ? Colors.mintLight : Colors.mint} size={24} />}
          label="Settings"
          isActive={active === 'settings'}
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Settings' }] })}
        />
      </View>

      {/* Owl floats above the centre */}
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
    paddingHorizontal: Spacing.xl,
    shadowColor: Colors.mint,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 8,
  },
  side: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  owlGap: {
    width: 64,
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
  owlWrap: {
    position: 'absolute',
    top: -44,
    left: '50%',
    transform: [{ translateX: -32 }],
  },
});
