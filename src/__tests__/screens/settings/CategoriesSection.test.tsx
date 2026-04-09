import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';

jest.mock('@/store/householdDetailStore');
jest.mock('@/components/Sheet', () => {
  const { View } = require('react-native');
  function Sheet({ visible, children }: { visible: boolean; children: React.ReactNode }) {
    return visible ? <View>{children}</View> : null;
  }
  return Sheet;
});

import { CategoriesSection } from '@/screens/settings/CategoriesSection';
import { useCategoriesSection } from '@/store/householdDetailStore';
import type { HouseholdCategory } from '@/api/households';

const mockCreateCategory = jest.fn();
const mockUpdateCategory = jest.fn();
const mockDeleteCategory = jest.fn();

const sampleCategories: HouseholdCategory[] = [
  { id: 1, name: 'Produce', ordering: 0 },
  { id: 2, name: 'Dairy', ordering: 1 },
];

function mockHook(overrides: Record<string, unknown> = {}) {
  (useCategoriesSection as jest.Mock).mockReturnValue({
    categories: [],
    createCategory: mockCreateCategory,
    updateCategory: mockUpdateCategory,
    deleteCategory: mockDeleteCategory,
    ...overrides,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHook();
});

describe('CategoriesSection', () => {
  it('shows empty state when there are no categories', () => {
    render(<CategoriesSection />);
    expect(screen.getByText('No categories yet.')).toBeTruthy();
  });

  it('renders category names', () => {
    mockHook({ categories: sampleCategories });
    render(<CategoriesSection />);
    expect(screen.getByText('Produce')).toBeTruthy();
    expect(screen.getByText('Dairy')).toBeTruthy();
  });

  it('opens new-category sheet when the add row is pressed', () => {
    render(<CategoriesSection />);
    fireEvent.press(screen.getByText('+ Add category'));
    expect(screen.getByText('Add category')).toBeTruthy();
  });

  it('calls createCategory when new category is submitted', async () => {
    mockCreateCategory.mockResolvedValue(undefined);
    render(<CategoriesSection />);
    fireEvent.press(screen.getByText('+ Add category'));
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Frozen'), 'Bakery');
    await act(async () => { fireEvent.press(screen.getByText('Add category')); });
    expect(mockCreateCategory).toHaveBeenCalledWith('Bakery');
  });

  it('opens edit sheet when a category row is pressed', () => {
    mockHook({ categories: sampleCategories });
    render(<CategoriesSection />);
    fireEvent.press(screen.getByText('Produce'));
    expect(screen.getByText('Save changes')).toBeTruthy();
    expect(screen.getByText('Delete category')).toBeTruthy();
  });

  it('calls updateCategory when save changes is pressed', async () => {
    mockUpdateCategory.mockResolvedValue(undefined);
    mockHook({ categories: sampleCategories });
    render(<CategoriesSection />);
    fireEvent.press(screen.getByText('Produce'));
    fireEvent.changeText(screen.getByDisplayValue('Produce'), 'Fresh Produce');
    await act(async () => { fireEvent.press(screen.getByText('Save changes')); });
    expect(mockUpdateCategory).toHaveBeenCalledWith(1, 'Fresh Produce');
  });

  it('calls deleteCategory when delete is pressed', async () => {
    mockDeleteCategory.mockResolvedValue(undefined);
    mockHook({ categories: sampleCategories });
    render(<CategoriesSection />);
    fireEvent.press(screen.getByText('Produce'));
    await act(async () => { fireEvent.press(screen.getByText('Delete category')); });
    expect(mockDeleteCategory).toHaveBeenCalledWith(1);
  });
});
