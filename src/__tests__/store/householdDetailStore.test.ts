jest.mock('@/store/authStore');
jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
}));

import { useHouseholdDetailStore } from '@/store/householdDetailStore';
import { useAuthStore } from '@/store/authStore';

const mockGetShoppingLists = jest.fn();
const mockCreateShoppingList = jest.fn();
const mockRenameShoppingList = jest.fn();
const mockDeleteShoppingList = jest.fn();

const mockGetCategories = jest.fn();
const mockCreateCategory = jest.fn();
const mockUpdateCategory = jest.fn();
const mockDeleteCategory = jest.fn();

const mockGetHousehold = jest.fn();
const mockGetMembers = jest.fn();
const mockInviteMember = jest.fn();
const mockRemoveMember = jest.fn();
const mockRenameHousehold = jest.fn();
const mockLeaveHousehold = jest.fn();

const shoppingListsApi = {
  getShoppingLists: mockGetShoppingLists,
  createShoppingList: mockCreateShoppingList,
  renameShoppingList: mockRenameShoppingList,
  deleteShoppingList: mockDeleteShoppingList,
};

const householdsApi = {
  getHousehold: mockGetHousehold,
  getCategories: mockGetCategories,
  createCategory: mockCreateCategory,
  updateCategory: mockUpdateCategory,
  deleteCategory: mockDeleteCategory,
  getMembers: mockGetMembers,
  inviteMember: mockInviteMember,
  removeMember: mockRemoveMember,
  renameHousehold: mockRenameHousehold,
  leaveHousehold: mockLeaveHousehold,
};

beforeEach(() => {
  jest.clearAllMocks();
  (useAuthStore as unknown as jest.Mock).mockReturnValue({ householdsApi, shoppingListsApi });
  // Mimic getState()
  (useAuthStore as unknown as { getState: () => unknown }).getState = () => ({ householdsApi, shoppingListsApi });
  // Reset store to clean state before each test
  useHouseholdDetailStore.setState({
    householdId: null,
    householdName: '',
    lists: [],
    members: [],
    categories: [],
    loading: false,
  });
});

describe('initialize', () => {
  it('sets householdId and name; clears stale data when switching households', () => {
    useHouseholdDetailStore.setState({ householdId: 1, lists: [{ id: 10 }] as never });
    useHouseholdDetailStore.getState().initialize(2, 'Beach House');
    const state = useHouseholdDetailStore.getState();
    expect(state.householdId).toBe(2);
    expect(state.householdName).toBe('Beach House');
    expect(state.lists).toEqual([]);
  });

  it('preserves existing data when re-initializing the same household', () => {
    const lists = [{ id: 10 }] as never;
    useHouseholdDetailStore.setState({ householdId: 1, lists });
    useHouseholdDetailStore.getState().initialize(1, 'Home');
    expect(useHouseholdDetailStore.getState().lists).toEqual(lists);
  });
});

describe('loadAll', () => {
  it('populates lists, categories, and members from the API', async () => {
    const lists = [{ id: 1, name: 'Weekly', items: [] }];
    const categories = [{ id: 1, name: 'Produce', ordering: 0 }];
    const members = [{ id: 1, name: 'Alice', username: 'alice', photo: null }];
    mockGetShoppingLists.mockResolvedValue(lists);
    mockGetCategories.mockResolvedValue(categories);
    mockGetMembers.mockResolvedValue(members);

    useHouseholdDetailStore.setState({ householdId: 42 });
    await useHouseholdDetailStore.getState().loadAll();

    const state = useHouseholdDetailStore.getState();
    expect(state.lists).toEqual(lists);
    expect(state.categories).toEqual(categories);
    expect(state.members).toEqual(members);
    expect(state.loading).toBe(false);
  });
});

describe('createList', () => {
  it('appends the new list to the store', async () => {
    const newList = { id: 99, name: 'Party', items: [] };
    mockCreateShoppingList.mockResolvedValue(newList);
    useHouseholdDetailStore.setState({ householdId: 1, lists: [] });

    await useHouseholdDetailStore.getState().createList('Party');

    expect(useHouseholdDetailStore.getState().lists).toContainEqual(newList);
    expect(mockCreateShoppingList).toHaveBeenCalledWith('Party', 1);
  });
});

describe('renameList', () => {
  it('updates the matching list name in the store', async () => {
    mockRenameShoppingList.mockResolvedValue(undefined);
    useHouseholdDetailStore.setState({
      householdId: 1,
      lists: [{ id: 5, name: 'Old Name', items: [] }] as never,
    });

    await useHouseholdDetailStore.getState().renameList(5, 'New Name');

    expect(useHouseholdDetailStore.getState().lists[0]?.name).toBe('New Name');
  });
});

describe('deleteList', () => {
  it('removes the list from the store', async () => {
    mockDeleteShoppingList.mockResolvedValue(undefined);
    useHouseholdDetailStore.setState({
      householdId: 1,
      lists: [{ id: 5, name: 'Doomed', items: [] }] as never,
    });

    await useHouseholdDetailStore.getState().deleteList(5);

    expect(useHouseholdDetailStore.getState().lists).toHaveLength(0);
  });
});

describe('createCategory', () => {
  it('appends the new category to the store', async () => {
    const newCat = { id: 7, name: 'Frozen', ordering: 0 };
    mockCreateCategory.mockResolvedValue(newCat);
    useHouseholdDetailStore.setState({ householdId: 1, categories: [] });

    await useHouseholdDetailStore.getState().createCategory('Frozen');

    expect(useHouseholdDetailStore.getState().categories).toContainEqual(newCat);
  });
});


describe('reorderCategory', () => {
  it('calls updateCategory with the category name and new ordering, then updates the ordering in store', async () => {
    mockUpdateCategory.mockResolvedValue(undefined);
    useHouseholdDetailStore.setState({
      householdId: 1,
      categories: [
        { id: 3, name: 'Produce', ordering: 0 },
        { id: 7, name: 'Frozen', ordering: 1 },
      ],
    });

    await useHouseholdDetailStore.getState().reorderCategory(7, 0);

    expect(mockUpdateCategory).toHaveBeenCalledWith(7, 'Frozen', 0);
    const updated = useHouseholdDetailStore.getState().categories.find((c) => c.id === 7);
    expect(updated?.ordering).toBe(0);
  });

  it('does nothing when the category id is not found', async () => {
    useHouseholdDetailStore.setState({ householdId: 1, categories: [] });

    await useHouseholdDetailStore.getState().reorderCategory(99, 0);

    expect(mockUpdateCategory).not.toHaveBeenCalled();
  });
});

describe('removeMember', () => {
  it('removes the member from the store', async () => {
    mockRemoveMember.mockResolvedValue(undefined);
    useHouseholdDetailStore.setState({
      householdId: 1,
      members: [{ id: 3, name: 'Alice', username: 'alice', photo: null }],
    });

    await useHouseholdDetailStore.getState().removeMember(3);

    expect(useHouseholdDetailStore.getState().members).toHaveLength(0);
  });
});

describe('renameHousehold', () => {
  it('updates householdName in the store', async () => {
    mockRenameHousehold.mockResolvedValue(undefined);
    useHouseholdDetailStore.setState({ householdId: 1, householdName: 'Old' });

    await useHouseholdDetailStore.getState().renameHousehold('New Name');

    expect(useHouseholdDetailStore.getState().householdName).toBe('New Name');
  });
});
