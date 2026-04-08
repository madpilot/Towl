import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ListsSection } from '@/screens/settings/ListsSection';
import type { ApiShoppingList } from '@/api/shoppinglists';

const lists: ApiShoppingList[] = [
  { id: 1, name: 'Weekly Shop', items: [{ id: 10 }, { id: 11 }] } as ApiShoppingList,
  { id: 2, name: 'Party', items: [] } as ApiShoppingList,
];

describe('ListsSection', () => {
  it('shows empty state when there are no lists', () => {
    render(<ListsSection lists={[]} onEdit={jest.fn()} onNew={jest.fn()} />);
    expect(screen.getByText('No lists yet.')).toBeTruthy();
  });

  it('renders list names and item counts', () => {
    render(<ListsSection lists={lists} onEdit={jest.fn()} onNew={jest.fn()} />);
    expect(screen.getByText('Weekly Shop')).toBeTruthy();
    expect(screen.getByText('2 items')).toBeTruthy();
    expect(screen.getByText('Party')).toBeTruthy();
    expect(screen.getByText('0 items')).toBeTruthy();
  });

  it('uses singular "item" for a single item', () => {
    const single = [{ id: 3, name: 'Solo', items: [{ id: 20 }] } as ApiShoppingList];
    render(<ListsSection lists={single} onEdit={jest.fn()} onNew={jest.fn()} />);
    expect(screen.getByText('1 item')).toBeTruthy();
  });

  it('calls onEdit with the correct list when a row is pressed', () => {
    const onEdit = jest.fn();
    render(<ListsSection lists={lists} onEdit={onEdit} onNew={jest.fn()} />);
    fireEvent.press(screen.getByText('Weekly Shop'));
    expect(onEdit).toHaveBeenCalledWith(lists[0]);
  });

  it('calls onNew when the add row is pressed', () => {
    const onNew = jest.fn();
    render(<ListsSection lists={[]} onEdit={jest.fn()} onNew={onNew} />);
    fireEvent.press(screen.getByText('+ New list'));
    expect(onNew).toHaveBeenCalledTimes(1);
  });
});
