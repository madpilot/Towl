/**
 * Tests for AddItemBar.
 * useItemSuggestions is mocked so tests remain synchronous.
 */

jest.mock('@/hooks/useItemSuggestions', () => ({
  useItemSuggestions: jest.fn(() => []),
}));

jest.mock('@/components/KitchenOwlIcon', () => {
  const React = require('react');
  const { View } = require('react-native');
  function KitchenOwlIcon() {
    return React.createElement(View, null);
  }
  return KitchenOwlIcon;
});

jest.mock('@/components/icons/CameraIcon', () => {
  const React = require('react');
  const { View } = require('react-native');
  function CameraIcon() {
    return React.createElement(View, null);
  }
  return CameraIcon;
});

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import AddItemBar from '@/components/AddItemBar';
import { useItemSuggestions } from '@/hooks/useItemSuggestions';

const milkSuggestion = {
  key: 'server:milk',
  displayName: 'milk',
  iconKey: 'milk',
  category: 'Dairy',
};

beforeEach(() => {
  jest.clearAllMocks();
  (useItemSuggestions as jest.Mock).mockReturnValue([]);
});

describe('AddItemBar', () => {
  describe('add-as-typed row', () => {
    it('shows the typed row when there are no suggestions', () => {
      const onAdd = jest.fn();
      const { queryByText } = render(<AddItemBar onAdd={onAdd} />);
      // No input yet — suggestions panel is hidden entirely
      expect(queryByText('+')).toBeNull();
    });

    it('shows the typed row when no suggestion exactly matches the input', () => {
      (useItemSuggestions as jest.Mock).mockReturnValue([
        { key: 'server:milkshake', displayName: 'milkshake', iconKey: null, category: 'Dairy' },
      ]);
      const { getByTestId, queryByText } = render(<AddItemBar onAdd={jest.fn()} />);
      fireEvent.changeText(getByTestId('add-item-input'), 'milk');
      // typed row arrow is rendered
      expect(queryByText('→')).toBeTruthy();
    });

    it('hides the typed row when a suggestion is an exact (case-insensitive) match', () => {
      (useItemSuggestions as jest.Mock).mockReturnValue([milkSuggestion]);
      const { getByTestId, queryByText } = render(<AddItemBar onAdd={jest.fn()} />);
      fireEvent.changeText(getByTestId('add-item-input'), 'milk');
      expect(queryByText('→')).toBeNull();
    });

    it('hides the typed row for a case-insensitive match', () => {
      (useItemSuggestions as jest.Mock).mockReturnValue([milkSuggestion]);
      const { getByTestId, queryByText } = render(<AddItemBar onAdd={jest.fn()} />);
      fireEvent.changeText(getByTestId('add-item-input'), 'Milk');
      expect(queryByText('→')).toBeNull();
    });
  });

  describe('handleAdd', () => {
    it('submits raw typed value with no iconKey when no exact match', () => {
      (useItemSuggestions as jest.Mock).mockReturnValue([
        { key: 'server:milkshake', displayName: 'milkshake', iconKey: null, category: 'Dairy' },
      ]);
      const onAdd = jest.fn();
      const { getByTestId } = render(<AddItemBar onAdd={onAdd} />);
      fireEvent.changeText(getByTestId('add-item-input'), 'milk');
      fireEvent.press(getByTestId('add-item-submit'));
      expect(onAdd).toHaveBeenCalledWith('milk', '', null, 'Other');
    });

    it('submits exact-matched suggestion data when input matches a suggestion', () => {
      (useItemSuggestions as jest.Mock).mockReturnValue([milkSuggestion]);
      const onAdd = jest.fn();
      const { getByTestId } = render(<AddItemBar onAdd={onAdd} />);
      fireEvent.changeText(getByTestId('add-item-input'), 'milk');
      fireEvent.press(getByTestId('add-item-submit'));
      expect(onAdd).toHaveBeenCalledWith('milk', '', 'milk', 'Dairy');
    });

    it('keyboard submit also uses exact-matched suggestion data', () => {
      (useItemSuggestions as jest.Mock).mockReturnValue([milkSuggestion]);
      const onAdd = jest.fn();
      const { getByTestId } = render(<AddItemBar onAdd={onAdd} />);
      fireEvent.changeText(getByTestId('add-item-input'), 'milk');
      fireEvent(getByTestId('add-item-input'), 'submitEditing');
      expect(onAdd).toHaveBeenCalledWith('milk', '', 'milk', 'Dairy');
    });

    it('keyboard submit uses raw value when no exact match', () => {
      (useItemSuggestions as jest.Mock).mockReturnValue([]);
      const onAdd = jest.fn();
      const { getByTestId } = render(<AddItemBar onAdd={onAdd} />);
      fireEvent.changeText(getByTestId('add-item-input'), 'oat milk');
      fireEvent(getByTestId('add-item-input'), 'submitEditing');
      expect(onAdd).toHaveBeenCalledWith('oat milk', '', null, 'Other');
    });
  });
});
