import React from 'react';
import { render } from '@testing-library/react-native';
import KitchenOwlIcon from '@/components/KitchenOwlIcon';

jest.mock('@/icons/kitchenowlIcons', () => ({
  getIconChar: jest.fn((key: string | null | undefined) => {
    if (key === 'apple') return '\u0103'; // fake codepoint char
    return null;
  }),
  FONT_FAMILY: 'Items',
}));

describe('KitchenOwlIcon', () => {
  it('renders the font character when iconKey has a codepoint', () => {
    const { getByText } = render(<KitchenOwlIcon iconKey="apple" />);
    expect(getByText('\u0103')).toBeTruthy();
  });

  it('renders nothing when iconKey is unknown', () => {
    const { toJSON } = render(<KitchenOwlIcon iconKey="nonexistent_icon" />);
    expect(toJSON()).toBeNull();
  });

  it('renders nothing when iconKey is null', () => {
    const { toJSON } = render(<KitchenOwlIcon iconKey={null} />);
    expect(toJSON()).toBeNull();
  });

  it('applies the Items font family when rendering icon char', () => {
    const { getByText } = render(<KitchenOwlIcon iconKey="apple" size={32} />);
    const textEl = getByText('\u0103');
    expect(textEl.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fontFamily: 'Items', fontSize: 32 }),
      ])
    );
  });
});
