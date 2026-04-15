import { create } from 'zustand';
import { setItemAsync, getItemAsync } from 'expo-secure-store';
import { SECURE_STORE_KEYS } from '@/utils/constants';
import { HouseholdSchema } from '@/api/households';
import type { Household } from '@/api/households';

type HouseholdState = {
  households: Household[];
  selectedHousehold: Household | null;
  setHouseholds: (households: Household[]) => void;
  selectHousehold: (household: Household) => void;
}

export const useHouseholdStore = create<HouseholdState>((set) => ({
  households: [],
  selectedHousehold: null,

  setHouseholds: (households) => set({ households }),

  // State-only setter — does not persist. Use persistAndSelectHousehold from
  // event handlers that need the SecureStore write to be awaited and surfaced.
  selectHousehold: (household) => set({ selectedHousehold: household }),
}));

/**
 * Persists the selected household to SecureStore, then updates the store.
 * Call this from UI event handlers (e.g. HouseholdPickerScreen) so the write
 * is awaited and any storage failure is visible to the caller.
 */
export async function persistAndSelectHousehold(household: Household): Promise<void> {
  await setItemAsync(
    SECURE_STORE_KEYS.SELECTED_HOUSEHOLD,
    JSON.stringify(household)
  );
  useHouseholdStore.getState().selectHousehold(household);
}

export async function restoreSelectedHousehold(): Promise<void> {
  try {
    const raw = await getItemAsync(SECURE_STORE_KEYS.SELECTED_HOUSEHOLD);
    if (raw) {
      const household = HouseholdSchema.parse(JSON.parse(raw));
      useHouseholdStore.getState().selectHousehold(household);
    }
  } catch {
    // ignore
  }
}
