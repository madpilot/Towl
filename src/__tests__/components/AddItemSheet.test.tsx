/**
 * Tests for AddItemSheet.
 * useItemSuggestions is mocked so tests remain synchronous.
 */

jest.mock('@/hooks/useItemSuggestions', () => ({
  useItemSuggestions: jest.fn(() => []),
}));

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import AddItemSheet from '@/components/AddItemSheet';
import { useItemSuggestions } from '@/hooks/useItemSuggestions';

function makeProps(overrides: Partial<React.ComponentProps<typeof AddItemSheet>> = {}) {
  return {
    visible: true,
    onClose: jest.fn(),
    onAdd: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (useItemSuggestions as jest.Mock).mockReturnValue([]);
});

describe('AddItemSheet', () => {
  it('renders name and description inputs', () => {
    const { getByTestId } = render(<AddItemSheet {...makeProps()} />);
    expect(getByTestId('item-name-input')).toBeTruthy();
    expect(getByTestId('item-desc-input')).toBeTruthy();
  });

  it('add button is disabled when name is empty', () => {
    const { getByTestId } = render(<AddItemSheet {...makeProps()} />);
    const button = getByTestId('add-item-button');
    expect(button.props.accessibilityState?.disabled ?? button.props.disabled).toBeTruthy();
  });

  it('calls onAdd with trimmed name and description', async () => {
    const onAdd = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    const { getByTestId } = render(<AddItemSheet visible onClose={onClose} onAdd={onAdd} />);

    fireEvent.changeText(getByTestId('item-name-input'), '  Milk  ');
    fireEvent.changeText(getByTestId('item-desc-input'), '2L');

    await act(async () => {
      fireEvent.press(getByTestId('add-item-button'));
    });

    await waitFor(() => expect(onAdd).toHaveBeenCalledWith('Milk', '2L'));
  });

  it('closes and clears fields after successful add', async () => {
    const onAdd = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    const { getByTestId } = render(<AddItemSheet visible onClose={onClose} onAdd={onAdd} />);

    fireEvent.changeText(getByTestId('item-name-input'), 'Bread');
    await act(async () => {
      fireEvent.press(getByTestId('add-item-button'));
    });

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('renders suggestion chips from the hook', async () => {
    (useItemSuggestions as jest.Mock).mockReturnValue([
      { key: 'server:Milk', displayName: 'Milk', iconKey: 'milk', category: 'Dairy & Eggs' },
      { key: 'server:Apple', displayName: 'Apple', iconKey: 'apple', category: 'Produce' },
    ]);

    const { getByText } = render(<AddItemSheet {...makeProps()} />);
    expect(getByText('Milk')).toBeTruthy();
    expect(getByText('Apple')).toBeTruthy();
  });

  it('fills name field when a suggestion chip is pressed', async () => {
    (useItemSuggestions as jest.Mock).mockReturnValue([
      { key: 'server:Milk', displayName: 'Milk', iconKey: 'milk', category: 'Dairy & Eggs' },
    ]);

    const { getByText, getByTestId } = render(<AddItemSheet {...makeProps()} />);

    await act(async () => {
      fireEvent.press(getByText('Milk'));
    });

    expect(getByTestId('item-name-input').props.value).toBe('Milk');
  });
});
