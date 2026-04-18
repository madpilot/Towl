import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';

jest.mock('@/store/authStore');
jest.mock('@/store/listDetailStore', () => ({ useListDetailStore: { getState: jest.fn(() => ({ syncLists: jest.fn() })) } }));
jest.mock('@/components/Sheet', () => {
  const { View } = require('react-native');
  function Sheet({ visible, children }: { visible: boolean; children: React.ReactNode }) {
    return visible ? <View>{children}</View> : null;
  }
  return Sheet;
});

import { ListsSection } from '@/screens/settings/ListsSection';
import { useHouseholdDetailStore } from '@/store/householdDetailStore';
import type { ApiShoppingList } from '@/api/shoppinglists';

const mockCreateList = jest.fn();
const mockRenameList = jest.fn();
const mockDeleteList = jest.fn();

const sampleLists: ApiShoppingList[] = [
  { id: 1, name: 'Weekly Shop', household_id: 1, items: [{ id: 10 } as never, { id: 11 } as never], recentItems: [] },
  { id: 2, name: 'Party', household_id: 1, items: [], recentItems: [] },
];

const groceriesList: ApiShoppingList = { id: 3, name: 'Groceries', household_id: 1, items: [], recentItems: [] };

beforeEach(() => {
  jest.clearAllMocks();
  useHouseholdDetailStore.setState({
    lists: [],
    defaultListId: null,
    createList: mockCreateList,
    renameList: mockRenameList,
    deleteList: mockDeleteList,
  });
});

describe('ListsSection', () => {
  it('shows empty state when there are no lists', () => {
    render(<ListsSection />);
    expect(screen.getByText('No lists yet.')).toBeTruthy();
  });

  it('renders list names and item counts', () => {
    useHouseholdDetailStore.setState({ lists: sampleLists });
    render(<ListsSection />);
    expect(screen.getByText('Weekly Shop')).toBeTruthy();
    expect(screen.getByText('2 items')).toBeTruthy();
    expect(screen.getByText('Party')).toBeTruthy();
    expect(screen.getByText('0 items')).toBeTruthy();
  });

  it('uses singular "item" for a single-item list', () => {
    useHouseholdDetailStore.setState({ lists: [{ id: 3, name: 'Solo', household_id: 1, items: [{ id: 20 } as never], recentItems: [] }] });
    render(<ListsSection />);
    expect(screen.getByText('1 item')).toBeTruthy();
  });

  it('opens new-list sheet when the add row is pressed', () => {
    render(<ListsSection />);
    fireEvent.press(screen.getByText('+ New list'));
    expect(screen.getByText('Create list')).toBeTruthy();
  });

  it('calls createList when new list is submitted', async () => {
    mockCreateList.mockResolvedValue(undefined);
    render(<ListsSection />);
    fireEvent.press(screen.getByText('+ New list'));
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Weekend Shop'), 'Farmers Market');
    await act(async () => {
      fireEvent.press(screen.getByText('Create list'));
    });
    expect(mockCreateList).toHaveBeenCalledWith('Farmers Market');
  });

  it('opens edit sheet when a list row is pressed', () => {
    useHouseholdDetailStore.setState({ lists: sampleLists });
    render(<ListsSection />);
    fireEvent.press(screen.getByText('Weekly Shop'));
    expect(screen.getByText('Save changes')).toBeTruthy();
    expect(screen.getByText('Delete list')).toBeTruthy();
  });

  it('shows a default pill on the default list row', () => {
    useHouseholdDetailStore.setState({ lists: [groceriesList], defaultListId: groceriesList.id });
    render(<ListsSection />);
    expect(screen.getByText('default')).toBeTruthy();
  });

  it('does not show the delete button for the default list', () => {
    useHouseholdDetailStore.setState({ lists: [groceriesList], defaultListId: groceriesList.id });
    render(<ListsSection />);
    fireEvent.press(screen.getByText('Groceries'));
    expect(screen.getByText('Save changes')).toBeTruthy();
    expect(screen.queryByText('Delete list')).toBeNull();
  });

  it('calls renameList when save changes is pressed', async () => {
    mockRenameList.mockResolvedValue(undefined);
    useHouseholdDetailStore.setState({ lists: sampleLists });
    render(<ListsSection />);
    fireEvent.press(screen.getByText('Weekly Shop'));
    fireEvent.changeText(screen.getByDisplayValue('Weekly Shop'), 'Big Shop');
    await act(async () => {
      fireEvent.press(screen.getByText('Save changes'));
    });
    expect(mockRenameList).toHaveBeenCalledWith(1, 'Big Shop');
  });

  it('calls deleteList when delete is pressed', async () => {
    mockDeleteList.mockResolvedValue(undefined);
    useHouseholdDetailStore.setState({ lists: sampleLists });
    render(<ListsSection />);
    fireEvent.press(screen.getByText('Weekly Shop'));
    await act(async () => {
      fireEvent.press(screen.getByText('Delete list'));
    });
    expect(mockDeleteList).toHaveBeenCalledWith(1);
  });
});
