/**
 * Tests for SwipeableItem.
 *
 * react-native-gesture-handler is mocked to capture the Pan gesture's onUpdate
 * and onEnd callbacks so tests can drive them without real native gestures.
 * react-native-reanimated is mocked via jest.setup.ts (runOnJS = identity,
 * withSpring = identity, useSharedValue = plain object).
 */

// Capture Pan gesture callbacks so tests can invoke them directly.
type GestureCbs = {
  onUpdate?: (e: { translationX: number }) => void;
  onEnd?: (e: { translationX: number; velocityX: number }) => void;
};
const gestureCbs: GestureCbs = {};

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');

  // Fluent Pan gesture builder — captures onUpdate/onEnd callbacks.
  const pan = {
    activeOffsetX: function () {
      return pan;
    },
    failOffsetY: function () {
      return pan;
    },
    onUpdate: function (cb: GestureCbs['onUpdate']) {
      gestureCbs.onUpdate = cb;
      return pan;
    },
    onEnd: function (cb: GestureCbs['onEnd']) {
      gestureCbs.onEnd = cb;
      return pan;
    },
  };

  const Gesture = { Pan: () => pan };

  function GestureDetector({ children }: { children: React.ReactNode }) {
    return React.createElement(View, null, children);
  }

  return { Gesture, GestureDetector };
});

jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  function Svg({ children }: { children?: React.ReactNode }) {
    return React.createElement(View, { testID: 'svg' }, children);
  }
  function Path() {
    return null;
  }
  return { __esModule: true, default: Svg, Svg, Path };
});

jest.mock('@/components/KitchenOwlIcon', () => {
  const React = require('react');
  const { Text } = require('react-native');
  function KitchenOwlIcon({ iconKey }: { iconKey: string | null | undefined }) {
    return React.createElement(Text, { testID: `icon-${iconKey ?? 'none'}` }, iconKey ?? '?');
  }
  return KitchenOwlIcon;
});

jest.mock('@/components/IconPicker', () => {
  const React = require('react');
  const { View } = require('react-native');
  function IconPicker() {
    return React.createElement(View, null);
  }
  return IconPicker;
});

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import SwipeableItem from '@/components/SwipeableItem';
import type { LocalItem } from '@/db/items';
import type { SwipeableItemHandlers } from '@/components/SwipeableItem';

function makeItem(overrides: Partial<LocalItem> = {}): LocalItem {
  return {
    localId: 'item-1',
    serverId: 10,
    listLocalId: 'list-1',
    name: 'Apples',
    description: '',
    iconKey: 'apple',
    category: 'Produce',
    serverCategoryId: null,
    serverCategoryName: null,
    serverCategoryOrdering: null,
    isChecked: false,
    isImportant: false,
    isDirty: false,
    isDeleted: false,
    checkedAt: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

function makeHandlers(overrides: Partial<SwipeableItemHandlers> = {}): SwipeableItemHandlers {
  return {
    onToggleDone: jest.fn(),
    onToggleImportant: jest.fn(),
    onDelete: jest.fn(),
    onSave: jest.fn(),
    editingId: null,
    setEditingId: jest.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  delete gestureCbs.onUpdate;
  delete gestureCbs.onEnd;
});

describe('SwipeableItem', () => {
  describe('rendering', () => {
    it('renders the item name', () => {
      const { getByText } = render(<SwipeableItem item={makeItem()} {...makeHandlers()} />);
      expect(getByText('Apples')).toBeTruthy();
    });

    it('renders the check button', () => {
      const { getByRole } = render(<SwipeableItem item={makeItem()} {...makeHandlers()} />);
      expect(getByRole('button')).toBeTruthy();
    });

    it('shows strikethrough name and check icon when checked', () => {
      const { getByText, getByRole } = render(
        <SwipeableItem item={makeItem({ isChecked: true })} {...makeHandlers()} />
      );
      expect(getByText('Apples')).toBeTruthy();
      expect(getByRole('button')).toBeTruthy();
    });

    it('shows star badge when item is important', () => {
      const { getByTestId } = render(
        <SwipeableItem item={makeItem({ isImportant: true })} {...makeHandlers()} />
      );
      expect(getByTestId('star-badge')).toBeTruthy();
    });

    it('shows edit row when editingId matches', () => {
      const item = makeItem();
      const { getByDisplayValue } = render(
        <SwipeableItem item={item} {...makeHandlers({ editingId: item.localId })} />
      );
      expect(getByDisplayValue('Apples')).toBeTruthy();
    });
  });

  describe('check button tap', () => {
    it('calls onToggleDone when check button is pressed', () => {
      const handlers = makeHandlers();
      const { getByRole } = render(<SwipeableItem item={makeItem()} {...handlers} />);
      fireEvent.press(getByRole('button'));
      expect(handlers.onToggleDone).toHaveBeenCalledWith('item-1');
    });
  });

  describe('swipe left — short (done)', () => {
    it('calls onToggleDone when released past DONE threshold', () => {
      const handlers = makeHandlers();
      render(<SwipeableItem item={makeItem()} {...handlers} />);

      act(() => {
        gestureCbs.onEnd?.({ translationX: -80, velocityX: 0 });
      });

      expect(handlers.onToggleDone).toHaveBeenCalledWith('item-1');
    });

    it('does not call onToggleDone when swipe is short of threshold', () => {
      const handlers = makeHandlers();
      render(<SwipeableItem item={makeItem()} {...handlers} />);

      act(() => {
        gestureCbs.onEnd?.({ translationX: -30, velocityX: 0 });
      });

      expect(handlers.onToggleDone).not.toHaveBeenCalled();
    });
  });

  describe('swipe left — long (delete removed)', () => {
    it('does not call onDelete when swiped far left', () => {
      const handlers = makeHandlers();
      render(<SwipeableItem item={makeItem()} {...handlers} />);

      act(() => {
        gestureCbs.onEnd?.({ translationX: -185, velocityX: 0 });
      });

      expect(handlers.onDelete).not.toHaveBeenCalled();
    });
  });

  describe('swipe right — important (short)', () => {
    it('calls onToggleImportant when released past STAR threshold', () => {
      const handlers = makeHandlers();
      render(<SwipeableItem item={makeItem()} {...handlers} />);

      act(() => {
        gestureCbs.onEnd?.({ translationX: 40, velocityX: 0 });
      });

      expect(handlers.onToggleImportant).toHaveBeenCalledWith('item-1');
    });

    it('does not trigger when short of star threshold', () => {
      const handlers = makeHandlers();
      render(<SwipeableItem item={makeItem()} {...handlers} />);

      act(() => {
        gestureCbs.onEnd?.({ translationX: 20, velocityX: 0 });
      });

      expect(handlers.onToggleImportant).not.toHaveBeenCalled();
    });
  });

  describe('swipe right — long (delete)', () => {
    it('calls onDelete when released past DELETE threshold', () => {
      const handlers = makeHandlers();
      render(<SwipeableItem item={makeItem()} {...handlers} />);

      act(() => {
        gestureCbs.onEnd?.({ translationX: 115, velocityX: 0 });
      });

      expect(handlers.onDelete).toHaveBeenCalledWith('item-1');
      expect(handlers.onToggleImportant).not.toHaveBeenCalled();
    });

    it('does not call onDelete when released between star and delete thresholds', () => {
      const handlers = makeHandlers();
      render(<SwipeableItem item={makeItem()} {...handlers} />);

      act(() => {
        gestureCbs.onEnd?.({ translationX: 60, velocityX: 0 });
      });

      expect(handlers.onDelete).not.toHaveBeenCalled();
      expect(handlers.onToggleImportant).toHaveBeenCalledWith('item-1');
    });
  });

  describe('back zone visual state', () => {
    it('transitions through zones as swipe value changes', () => {
      render(<SwipeableItem item={makeItem()} {...makeHandlers()} />);

      // Should not throw at any zone boundary.
      act(() => {
        gestureCbs.onUpdate?.({ translationX: 0 });
        gestureCbs.onUpdate?.({ translationX: -40 });
        gestureCbs.onUpdate?.({ translationX: -80 });
        gestureCbs.onUpdate?.({ translationX: 40 });
        gestureCbs.onUpdate?.({ translationX: 115 });
      });
    });
  });

  describe('double-tap to edit', () => {
    it('calls setEditingId on double-tap', () => {
      jest.useFakeTimers();
      const handlers = makeHandlers();
      const { getByTestId } = render(<SwipeableItem item={makeItem()} {...handlers} />);

      const target = getByTestId('card-tap-target');
      fireEvent.press(target);
      jest.advanceTimersByTime(100);
      fireEvent.press(target);

      expect(handlers.setEditingId).toHaveBeenCalledWith('item-1');
      jest.useRealTimers();
    });

    it('does not call setEditingId on single tap', () => {
      jest.useFakeTimers();
      const handlers = makeHandlers();
      const { getByTestId } = render(<SwipeableItem item={makeItem()} {...handlers} />);

      fireEvent.press(getByTestId('card-tap-target'));
      jest.advanceTimersByTime(400);

      expect(handlers.setEditingId).not.toHaveBeenCalled();
      jest.useRealTimers();
    });
  });

  describe('edit row', () => {
    it('calls onSave with trimmed name on submit', () => {
      const item = makeItem();
      const handlers = makeHandlers({ editingId: item.localId });
      const { getByDisplayValue } = render(<SwipeableItem item={item} {...handlers} />);

      fireEvent.changeText(getByDisplayValue('Apples'), ' Bananas ');
      fireEvent(getByDisplayValue(' Bananas '), 'submitEditing');

      expect(handlers.onSave).toHaveBeenCalledWith('item-1', 'Bananas', '', 'apple');
      expect(handlers.setEditingId).toHaveBeenCalledWith(null);
    });

    it('calls setEditingId(null) on cancel when name is empty', () => {
      const item = makeItem();
      const handlers = makeHandlers({ editingId: item.localId });
      const { getByDisplayValue } = render(<SwipeableItem item={item} {...handlers} />);

      fireEvent.changeText(getByDisplayValue('Apples'), '');
      fireEvent(getByDisplayValue(''), 'submitEditing');

      expect(handlers.onSave).not.toHaveBeenCalled();
      expect(handlers.setEditingId).toHaveBeenCalledWith(null);
    });
  });
});
