import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';

jest.mock('@/store/householdDetailStore');
jest.mock('@/store/listDetailStore', () => ({ useListDetailStore: { getState: jest.fn(() => ({ syncLists: jest.fn() })) } }));
jest.mock('@/components/Sheet', () => {
  const { View } = require('react-native');
  function Sheet({ visible, children }: { visible: boolean; children: React.ReactNode }) {
    return visible ? <View>{children}</View> : null;
  }
  return Sheet;
});

import { ListsSection } from '@/screens/settings/ListsSection';
import { useListsSection } from '@/store/householdDetailStore';
import type { ApiShoppingList } from '@/api/shoppinglists';

const mockCreateList = jest.fn();
const mockRenameList = jest.fn();
const mockDeleteList = jest.fn();

const sampleLists = [
  { id: 1, name: 'Weekly Shop', items: [{ id: 10 }, { id: 11 }] },
  { id: 2, name: 'Party', items: [] },
] as unknown as ApiShoppingList[];

const defaultList = { id: 3, name: 'Groceries', household_id: 1, items: [], recentItems: [] };

function mockHook(overrides: Record<string, unknown> = {}) {
  (useListsSection as jest.Mock).mockReturnValue({
    lists: [],
    createList: mockCreateList,
    renameList: mockRenameList,
    deleteList: mockDeleteList,
    ...overrides,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHook();
});

describe('ListsSection', () => {
  it('shows empty state when there are no lists', () => {
    render(<ListsSection />);
    expect(screen.getByText('No lists yet.')).toBeTruthy();
  });

  it('renders list names and item counts', () => {
    mockHook({ lists: sampleLists });
    render(<ListsSection />);
    expect(screen.getByText('Weekly Shop')).toBeTruthy();
    expect(screen.getByText('2 items')).toBeTruthy();
    expect(screen.getByText('Party')).toBeTruthy();
    expect(screen.getByText('0 items')).toBeTruthy();
  });

  it('uses singular "item" for a single-item list', () => {
    mockHook({ lists: [{ id: 3, name: 'Solo', items: [{ id: 20 }] }] });
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
    mockHook({ lists: sampleLists });
    render(<ListsSection />);
    fireEvent.press(screen.getByText('Weekly Shop'));
    expect(screen.getByText('Save changes')).toBeTruthy();
    expect(screen.getByText('Delete list')).toBeTruthy();
  });

  it('shows a default pill on the default list row', () => {
    mockHook({ lists: [{ ...defaultList, isDefault: true }] });
    render(<ListsSection />);
    expect(screen.getByText('default')).toBeTruthy();
  });

  it('does not show the delete button for the default list', () => {
    mockHook({ lists: [{ ...defaultList, isDefault: true }] });
    render(<ListsSection />);
    fireEvent.press(screen.getByText('Groceries'));
    expect(screen.getByText('Save changes')).toBeTruthy();
    expect(screen.queryByText('Delete list')).toBeNull();
  });

  it('calls renameList when save changes is pressed', async () => {
    mockRenameList.mockResolvedValue(undefined);
    mockHook({ lists: sampleLists });
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
    mockHook({ lists: sampleLists });
    render(<ListsSection />);
    fireEvent.press(screen.getByText('Weekly Shop'));
    await act(async () => {
      fireEvent.press(screen.getByText('Delete list'));
    });
    expect(mockDeleteList).toHaveBeenCalledWith(1);
  });
});
