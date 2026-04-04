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
    const { getByText } = render(
      <KitchenOwlIcon iconKey="apple" fallbackEmoji="🍎" />
    );
    expect(getByText('\u0103')).toBeTruthy();
  });

  it('renders the fallback emoji when iconKey is unknown', () => {
    const { getByText } = render(
      <KitchenOwlIcon iconKey="nonexistent_icon" fallbackEmoji="🤷" />
    );
    expect(getByText('🤷')).toBeTruthy();
  });

  it('renders the fallback emoji when iconKey is null', () => {
    const { getByText } = render(
      <KitchenOwlIcon iconKey={null} fallbackEmoji="❓" />
    );
    expect(getByText('❓')).toBeTruthy();
  });

  it('applies the Items font family when rendering icon char', () => {
    const { getByText } = render(
      <KitchenOwlIcon iconKey="apple" fallbackEmoji="🍎" size={32} />
    );
    const textEl = getByText('\u0103');
    expect(textEl.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fontFamily: 'Items', fontSize: 32 }),
      ])
    );
  });
});
