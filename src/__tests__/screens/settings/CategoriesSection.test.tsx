import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { CategoriesSection } from '@/screens/settings/CategoriesSection';
import type { HouseholdCategory } from '@/api/households';

const categories: HouseholdCategory[] = [
  { id: 1, name: 'Produce', ordering: 0 },
  { id: 2, name: 'Dairy', ordering: 1 },
];

describe('CategoriesSection', () => {
  it('shows empty state when there are no categories', () => {
    render(<CategoriesSection categories={[]} onEdit={jest.fn()} onNew={jest.fn()} />);
    expect(screen.getByText('No categories yet.')).toBeTruthy();
  });

  it('renders category names', () => {
    render(<CategoriesSection categories={categories} onEdit={jest.fn()} onNew={jest.fn()} />);
    expect(screen.getByText('Produce')).toBeTruthy();
    expect(screen.getByText('Dairy')).toBeTruthy();
  });

  it('calls onEdit with the correct category when a row is pressed', () => {
    const onEdit = jest.fn();
    render(<CategoriesSection categories={categories} onEdit={onEdit} onNew={jest.fn()} />);
    fireEvent.press(screen.getByText('Produce'));
    expect(onEdit).toHaveBeenCalledWith(categories[0]);
  });

  it('calls onNew when the add row is pressed', () => {
    const onNew = jest.fn();
    render(<CategoriesSection categories={[]} onEdit={jest.fn()} onNew={onNew} />);
    fireEvent.press(screen.getByText('+ Add category'));
    expect(onNew).toHaveBeenCalledTimes(1);
  });
});
