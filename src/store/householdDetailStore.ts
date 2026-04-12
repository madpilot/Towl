import { Alert } from 'react-native';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from './authStore';
import type { ApiShoppingList } from '@/api/shoppinglists';
import type { HouseholdCategory, HouseholdMember } from '@/api/households';

interface HouseholdDetailState {
  householdId: number | null;
  householdName: string;
  lists: ApiShoppingList[];
  members: HouseholdMember[];
  categories: HouseholdCategory[];
  loading: boolean;

  // Lifecycle
  initialize: (householdId: number, householdName: string) => void;
  loadAll: () => Promise<void>;

  // Household
  renameHousehold: (name: string) => Promise<void>;
  leaveHousehold: () => Promise<void>;

  // Lists
  createList: (name: string) => Promise<void>;
  renameList: (id: number, name: string) => Promise<void>;
  deleteList: (id: number) => Promise<void>;

  // Categories
  createCategory: (name: string) => Promise<void>;
  updateCategory: (id: number, name: string) => Promise<void>;
  deleteCategory: (id: number) => Promise<void>;

  // Members
  inviteMember: (username: string) => Promise<void>;
  removeMember: (memberId: number) => Promise<void>;
}

export const useHouseholdDetailStore = create<HouseholdDetailState>((set, get) => ({
  householdId: null,
  householdName: '',
  lists: [],
  members: [],
  categories: [],
  loading: false,

  initialize: (householdId, householdName) => {
    // Clear stale data when switching to a different household
    if (get().householdId !== householdId) {
      set({ householdId, householdName, lists: [], members: [], categories: [] });
    } else {
      set({ householdId, householdName });
    }
  },

  loadAll: async () => {
    const { householdId } = get();
    if (householdId === null) return;
    const { householdsApi, shoppingListsApi } = useAuthStore.getState();
    if (!householdsApi || !shoppingListsApi) return;

    set({ loading: true });
    try {
      const [listsResult, categoriesResult] = await Promise.allSettled([
        shoppingListsApi.getShoppingLists(householdId),
        householdsApi.getCategories(householdId),
      ]);
      if (listsResult.status === 'fulfilled') set({ lists: listsResult.value });
      if (categoriesResult.status === 'fulfilled') set({ categories: categoriesResult.value });

      try {
        const members = await householdsApi.getMembers(householdId);
        set({ members });
      } catch {
        // Stub: not yet implemented
      }
    } catch {
      Alert.alert('Error', 'Could not load household data.');
    } finally {
      set({ loading: false });
    }
  },

  // ── Household ──────────────────────────────────────────────────────────────

  renameHousehold: async (name) => {
    const { householdId } = get();
    if (householdId === null) return;
    const { householdsApi } = useAuthStore.getState();
    if (!householdsApi) return;
    await householdsApi.renameHousehold(householdId, name);
    set({ householdName: name });
  },

  leaveHousehold: async () => {
    const { householdId } = get();
    if (householdId === null) return;
    const { householdsApi } = useAuthStore.getState();
    if (!householdsApi) return;
    await householdsApi.leaveHousehold(householdId);
  },

  // ── Lists ──────────────────────────────────────────────────────────────────

  createList: async (name) => {
    const { householdId } = get();
    if (householdId === null) return;
    const { shoppingListsApi } = useAuthStore.getState();
    if (!shoppingListsApi) return;
    const created = await shoppingListsApi.createShoppingList(name, householdId);
    set((s) => ({ lists: [...s.lists, created] }));
  },

  renameList: async (id, name) => {
    const { shoppingListsApi } = useAuthStore.getState();
    if (!shoppingListsApi) return;
    await shoppingListsApi.renameShoppingList(id, name);
    set((s) => ({ lists: s.lists.map((l) => l.id === id ? { ...l, name } : l) }));
  },

  deleteList: async (id) => {
    const { shoppingListsApi } = useAuthStore.getState();
    if (!shoppingListsApi) return;
    await shoppingListsApi.deleteShoppingList(id);
    set((s) => ({ lists: s.lists.filter((l) => l.id !== id) }));
  },

  // ── Categories ────────────────────────────────────────────────────────────

  createCategory: async (name) => {
    const { householdId, categories } = get();
    if (householdId === null) return;
    const { householdsApi } = useAuthStore.getState();
    if (!householdsApi) return;
    const ordering = categories.length;
    const created = await householdsApi.createCategory(householdId, name, ordering);
    set((s) => ({ categories: [...s.categories, created] }));
  },

  updateCategory: async (id, name) => {
    const { householdsApi } = useAuthStore.getState();
    if (!householdsApi) return;
    const existing = get().categories.find((c) => c.id === id);
    const ordering = existing?.ordering ?? 0;
    await householdsApi.updateCategory(id, name, ordering);
    set((s) => ({ categories: s.categories.map((c) => c.id === id ? { ...c, name } : c) }));
  },

  deleteCategory: async (id) => {
    const { householdsApi } = useAuthStore.getState();
    if (!householdsApi) return;
    await householdsApi.deleteCategory(id);
    set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }));
  },

  // ── Members ───────────────────────────────────────────────────────────────

  inviteMember: async (username) => {
    const { householdId } = get();
    if (householdId === null) return;
    const { householdsApi } = useAuthStore.getState();
    if (!householdsApi) return;
    await householdsApi.inviteMember(householdId, username);
    // Reload members to pick up the newly invited user
    try {
      const members = await householdsApi.getMembers(householdId);
      set({ members });
    } catch {
      // Stub: not yet implemented
    }
  },

  removeMember: async (memberId) => {
    const { householdId } = get();
    if (householdId === null) return;
    const { householdsApi } = useAuthStore.getState();
    if (!householdsApi) return;
    await householdsApi.removeMember(householdId, memberId);
    set((s) => ({ members: s.members.filter((m) => m.id !== memberId) }));
  },
}));

// ── Section hooks ─────────────────────────────────────────────────────────────
// Each hook returns exactly the slice a section component needs, using
// useShallow so the component only re-renders when its own data changes.

export function useHouseholdDetail() {
  return useHouseholdDetailStore(
    useShallow((s) => ({
      loading: s.loading,
      householdName: s.householdName,
      initialize: s.initialize,
      loadAll: s.loadAll,
      renameHousehold: s.renameHousehold,
      leaveHousehold: s.leaveHousehold,
    }))
  );
}

export function useListsSection() {
  return useHouseholdDetailStore(
    useShallow((s) => ({
      lists: s.lists,
      createList: s.createList,
      renameList: s.renameList,
      deleteList: s.deleteList,
    }))
  );
}

export function useCategoriesSection() {
  return useHouseholdDetailStore(
    useShallow((s) => ({
      categories: s.categories,
      createCategory: s.createCategory,
      updateCategory: s.updateCategory,
      deleteCategory: s.deleteCategory,
    }))
  );
}

export function useMembersSection() {
  return useHouseholdDetailStore(
    useShallow((s) => ({
      members: s.members,
      inviteMember: s.inviteMember,
      removeMember: s.removeMember,
    }))
  );
}
