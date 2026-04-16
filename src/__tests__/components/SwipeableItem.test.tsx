/**
 * Tests for SwipeableItem.
 *
 * react-native-gesture-handler is mocked to capture the Pan gesture's
 * onStart / onUpdate / onEnd callbacks so tests can drive them without
 * real native gestures.
 * react-native-reanimated is mocked via jest.setup.ts (runOnJS = identity,
 * withSpring = identity, useSharedValue = plain object).
 */

// Capture Pan gesture callbacks so tests can invoke them directly.
type GestureCbs = {
  onStart?: (e: object) => void;
  onUpdate?: (e: { translationX: number }) => void;
  onEnd?: (e: { translationX: number; velocityX: number }) => void;
};
const gestureCbs: GestureCbs = {};

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');

  // Fluent Pan gesture builder — captures onStart/onUpdate/onEnd callbacks.
  const pan = {
    activeOffsetX: function () {
      return pan;
    },
    failOffsetY: function () {
      return pan;
    },
    onStart: function (cb: GestureCbs['onStart']) {
      gestureCbs.onStart = cb;
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
  delete gestureCbs.onStart;
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
      const { getByTestId } = render(<SwipeableItem item={makeItem()} {...makeHandlers()} />);
      expect(getByTestId('check-button')).toBeTruthy();
    });

    it('shows strikethrough name and check icon when checked', () => {
      const { getByText, getByTestId } = render(
        <SwipeableItem item={makeItem({ isChecked: true })} {...makeHandlers()} />
      );
      expect(getByText('Apples')).toBeTruthy();
      expect(getByTestId('check-button')).toBeTruthy();
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
      const { getByTestId } = render(<SwipeableItem item={makeItem()} {...handlers} />);
      fireEvent.press(getByTestId('check-button'));
      expect(handlers.onToggleDone).toHaveBeenCalledWith('item-1');
    });
  });

  describe('swipe left — done', () => {
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

  describe('swipe right — lock and reveal buttons', () => {
    it('does not trigger any action when swipe is below OPEN_THRESHOLD', () => {
      const handlers = makeHandlers();
      render(<SwipeableItem item={makeItem()} {...handlers} />);

      act(() => {
        gestureCbs.onEnd?.({ translationX: 30, velocityX: 0 });
      });

      expect(handlers.onToggleImportant).not.toHaveBeenCalled();
      expect(handlers.onDelete).not.toHaveBeenCalled();
    });

    it('reveals star and delete buttons when swipe exceeds OPEN_THRESHOLD', () => {
      const handlers = makeHandlers();
      const { getByLabelText } = render(<SwipeableItem item={makeItem()} {...handlers} />);

      act(() => {
        gestureCbs.onEnd?.({ translationX: 60, velocityX: 0 });
      });

      expect(getByLabelText('Favourite')).toBeTruthy();
      expect(getByLabelText('Delete')).toBeTruthy();
      expect(handlers.onToggleImportant).not.toHaveBeenCalled();
      expect(handlers.onDelete).not.toHaveBeenCalled();
    });

    it('calls onToggleImportant when the star button is pressed', () => {
      const handlers = makeHandlers();
      const { getByLabelText } = render(<SwipeableItem item={makeItem()} {...handlers} />);

      act(() => {
        gestureCbs.onEnd?.({ translationX: 60, velocityX: 0 });
      });
      fireEvent.press(getByLabelText('Favourite'));

      expect(handlers.onToggleImportant).toHaveBeenCalledWith('item-1');
      expect(handlers.onDelete).not.toHaveBeenCalled();
    });

    it('shows undo button (not star) for checked items', () => {
      const handlers = makeHandlers();
      const { getByLabelText, queryByLabelText } = render(
        <SwipeableItem item={makeItem({ isChecked: true })} {...handlers} />
      );

      act(() => {
        gestureCbs.onEnd?.({ translationX: 60, velocityX: 0 });
      });

      expect(getByLabelText('Undo')).toBeTruthy();
      expect(queryByLabelText('Favourite')).toBeNull();
    });

    it('calls onToggleDone (undo) when undo button is pressed on a checked item', () => {
      const handlers = makeHandlers();
      const { getByLabelText } = render(
        <SwipeableItem item={makeItem({ isChecked: true })} {...handlers} />
      );

      act(() => {
        gestureCbs.onEnd?.({ translationX: 60, velocityX: 0 });
      });
      fireEvent.press(getByLabelText('Undo'));

      expect(handlers.onToggleDone).toHaveBeenCalledWith('item-1');
    });

    it('calls onDelete when the delete button is pressed', () => {
      const handlers = makeHandlers();
      const { getByLabelText } = render(<SwipeableItem item={makeItem()} {...handlers} />);

      act(() => {
        gestureCbs.onEnd?.({ translationX: 60, velocityX: 0 });
      });
      fireEvent.press(getByLabelText('Delete'));

      expect(handlers.onDelete).toHaveBeenCalledWith('item-1');
      expect(handlers.onToggleImportant).not.toHaveBeenCalled();
    });

    it('closes buttons when swiping back past CLOSE_THRESHOLD', () => {
      const handlers = makeHandlers();
      const { getByLabelText } = render(<SwipeableItem item={makeItem()} {...handlers} />);

      // Lock open.
      act(() => {
        gestureCbs.onStart?.({});
        gestureCbs.onEnd?.({ translationX: 60, velocityX: 0 });
      });
      expect(getByLabelText('Favourite')).toBeTruthy();

      // Swipe back far enough to close.
      act(() => {
        gestureCbs.onStart?.({});
        gestureCbs.onEnd?.({ translationX: -50, velocityX: 0 });
      });
      expect(getByLabelText('Favourite').props.accessibilityState?.disabled).toBe(true);
      expect(getByLabelText('Delete').props.accessibilityState?.disabled).toBe(true);
    });

    it('stays open when swipe back is short of CLOSE_THRESHOLD', () => {
      const handlers = makeHandlers();
      const { getByLabelText } = render(<SwipeableItem item={makeItem()} {...handlers} />);

      // Lock open.
      act(() => {
        gestureCbs.onStart?.({});
        gestureCbs.onEnd?.({ translationX: 60, velocityX: 0 });
      });

      // Swipe back a little — not enough to close.
      act(() => {
        gestureCbs.onStart?.({});
        gestureCbs.onEnd?.({ translationX: -20, velocityX: 0 });
      });

      expect(getByLabelText('Favourite')).toBeTruthy();
    });

    it('closes buttons on a card tap when locked', () => {
      const handlers = makeHandlers();
      const { getByTestId, getByLabelText } = render(
        <SwipeableItem item={makeItem()} {...handlers} />
      );

      act(() => {
        gestureCbs.onEnd?.({ translationX: 60, velocityX: 0 });
      });

      fireEvent.press(getByTestId('card-tap-target'));

      expect(getByLabelText('Favourite').props.accessibilityState?.disabled).toBe(true);
    });
  });

  describe('back zone visual state', () => {
    it('transitions through left-swipe zones without errors', () => {
      render(<SwipeableItem item={makeItem()} {...makeHandlers()} />);

      // Should not throw at any zone boundary.
      act(() => {
        gestureCbs.onUpdate?.({ translationX: 0 });
        gestureCbs.onUpdate?.({ translationX: -40 });
        gestureCbs.onUpdate?.({ translationX: -80 });
        gestureCbs.onUpdate?.({ translationX: 40 });
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
