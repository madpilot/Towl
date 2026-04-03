import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { SECURE_STORE_KEYS } from '@/utils/constants';
import type { Household } from '@/api/households';

interface HouseholdState {
  households: Household[];
  selectedHousehold: Household | null;
  setHouseholds: (households: Household[]) => void;
  selectHousehold: (household: Household) => void;
}

export const useHouseholdStore = create<HouseholdState>((set) => ({
  households: [],
  selectedHousehold: null,

  setHouseholds: (households) => set({ households }),

  selectHousehold: (household) => {
    SecureStore.setItemAsync(
      SECURE_STORE_KEYS.SELECTED_HOUSEHOLD,
      JSON.stringify(household)
    ).catch(() => {});
    set({ selectedHousehold: household });
  },
}));

export async function restoreSelectedHousehold(): Promise<void> {
  try {
    const raw = await SecureStore.getItemAsync(SECURE_STORE_KEYS.SELECTED_HOUSEHOLD);
    if (raw) {
      const household: Household = JSON.parse(raw);
      useHouseholdStore.getState().selectHousehold(household);
    }
  } catch {
    // ignore
  }
}
