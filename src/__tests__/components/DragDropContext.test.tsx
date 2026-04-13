/**
 * Tests for DragDropContext.
 *
 * react-native-reanimated is mocked via jest.setup.ts.
 * We verify that drag state transitions correctly and that the onDrop
 * callback fires with the right arguments.
 */

jest.mock('react-native-reanimated', () => {
  const mock = require('react-native-reanimated/mock');
  return mock;
});

import React from 'react';
import { render, act } from '@testing-library/react-native';
import { View, Text } from 'react-native';
import { DragDropProvider, useDragDrop } from '@/components/DragDropContext';
import type { LocalItem } from '@/db/items';

function makeItem(overrides: Partial<LocalItem> = {}): LocalItem {
  return {
    localId: 'item-1',
    serverId: 10,
    listLocalId: 'list-1',
    name: 'Apples',
    description: '',
    iconKey: 'apple',
    category: 'Produce',
    serverCategoryId: 3,
    serverCategoryName: 'Produce',
    serverCategoryOrdering: 1,
    isChecked: false,
    isImportant: false,
    isDirty: false,
    isDeleted: false,
    checkedAt: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

// ── Helper: Consumer component ────────────────────────────────────────────────

type ConsumerRef = {
  dragging: boolean;
  draggingItem: LocalItem | null;
  hoveredCategoryId: number | null | undefined;
  startDrag: (item: LocalItem, x: number, y: number) => void;
  updateDragPosition: (x: number, y: number) => void;
  commitDrop: () => void;
  cancelDrag: () => void;
  registerZone: (id: number | null, fn: () => Promise<null>) => void;
};

function Consumer({ refHolder }: { refHolder: React.MutableRefObject<ConsumerRef | null> }) {
  const ctx = useDragDrop();

  // Expose context through the ref so tests can drive it.
  if (ctx && refHolder.current === null) {
    refHolder.current = {
      get dragging() { return ctx.dragging; },
      get draggingItem() { return ctx.draggingItem; },
      get hoveredCategoryId() { return ctx.hoveredCategoryId; },
      startDrag: ctx.startDrag,
      updateDragPosition: ctx.updateDragPosition,
      commitDrop: ctx.commitDrop,
      cancelDrag: ctx.cancelDrag,
      registerZone: ctx.registerZone as ConsumerRef['registerZone'],
    };
  }

  return (
    <View>
      <Text testID="dragging">{ctx?.dragging ? 'yes' : 'no'}</Text>
      <Text testID="item-name">{ctx?.draggingItem?.name ?? ''}</Text>
      <Text testID="hovered">{String(ctx?.hoveredCategoryId)}</Text>
    </View>
  );
}

function setup(onDrop = jest.fn()) {
  const ctxRef = React.createRef<ConsumerRef | null>() as React.MutableRefObject<ConsumerRef | null>;
  ctxRef.current = null;

  const { getByTestId, rerender } = render(
    <DragDropProvider onDrop={onDrop}>
      <Consumer refHolder={ctxRef} />
    </DragDropProvider>
  );

  return { ctxRef, getByTestId, onDrop, rerender };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DragDropProvider', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts with dragging=false', () => {
    const { getByTestId } = setup();
    expect(getByTestId('dragging').props.children).toBe('no');
  });

  it('useDragDrop returns null outside a provider', () => {
    function Probe() {
      const v = useDragDrop();
      return <Text testID="outside-value">{v === null ? 'null' : 'not-null'}</Text>;
    }
    const { getByTestId } = render(<Probe />);
    expect(getByTestId('outside-value').props.children).toBe('null');
  });

  describe('startDrag', () => {
    it('sets dragging=true and draggingItem', () => {
      const { ctxRef, getByTestId } = setup();

      act(() => {
        ctxRef.current!.startDrag(makeItem(), 100, 200);
      });

      expect(getByTestId('dragging').props.children).toBe('yes');
      expect(getByTestId('item-name').props.children).toBe('Apples');
    });

    it('schedules zone measurement after 150 ms', () => {
      const { ctxRef } = setup();
      const measureFn = jest.fn().mockResolvedValue({ x: 0, y: 0, width: 100, height: 50 });

      act(() => {
        ctxRef.current!.registerZone(1, measureFn);
        ctxRef.current!.startDrag(makeItem(), 50, 100);
      });

      expect(measureFn).not.toHaveBeenCalled();

      act(() => { jest.advanceTimersByTime(150); });

      // measureFn will be called asynchronously — advance microtasks.
      return Promise.resolve().then(() => {
        expect(measureFn).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('cancelDrag', () => {
    it('resets dragging state', () => {
      const { ctxRef, getByTestId } = setup();

      act(() => { ctxRef.current!.startDrag(makeItem(), 100, 200); });
      expect(getByTestId('dragging').props.children).toBe('yes');

      act(() => { ctxRef.current!.cancelDrag(); });
      expect(getByTestId('dragging').props.children).toBe('no');
    });

    it('clears the dragging item', () => {
      const { ctxRef, getByTestId } = setup();

      act(() => { ctxRef.current!.startDrag(makeItem(), 100, 200); });
      act(() => { ctxRef.current!.cancelDrag(); });

      expect(getByTestId('item-name').props.children).toBe('');
    });
  });

  describe('commitDrop', () => {
    it('fires onDrop with item and categoryId when over a zone', () => {
      const onDrop = jest.fn();
      const { ctxRef } = setup(onDrop);
      const item = makeItem();

      const measureFn = jest.fn().mockResolvedValue({ x: 0, y: 0, width: 300, height: 100 });

      act(() => {
        ctxRef.current!.registerZone(5, measureFn);
        ctxRef.current!.startDrag(item, 150, 50);
      });

      // Advance timers and let measurement resolve.
      act(() => { jest.advanceTimersByTime(150); });

      return Promise.resolve().then(() => {
        // Simulate finger over the zone.
        act(() => { ctxRef.current!.updateDragPosition(150, 50); });
        act(() => { ctxRef.current!.commitDrop(); });

        expect(onDrop).toHaveBeenCalledWith(item, 5);
      });
    });

    it('does not fire onDrop when no zone is hovered', () => {
      const onDrop = jest.fn();
      const { ctxRef } = setup(onDrop);

      act(() => {
        ctxRef.current!.startDrag(makeItem(), 100, 200);
      });

      // No zones registered; hoveredCategoryId stays undefined.
      act(() => { ctxRef.current!.commitDrop(); });

      expect(onDrop).not.toHaveBeenCalled();
    });
  });

  describe('registerZone / unregisterZone', () => {
    it('removes zone from registry on unregister', async () => {
      const onDrop = jest.fn();
      const { ctxRef } = setup(onDrop);
      const measureFn = jest.fn().mockResolvedValue({ x: 0, y: 0, width: 100, height: 50 });

      act(() => {
        ctxRef.current!.registerZone(3, measureFn);
        ctxRef.current!.startDrag(makeItem(), 50, 25);
      });

      act(() => { jest.advanceTimersByTime(150); });

      await Promise.resolve();

      // Now unregister the zone.
      act(() => {
        const ctx = ctxRef.current!;
        // Access unregisterZone directly via the context value.
        (ctx as unknown as { unregisterZone?: (id: number) => void }).unregisterZone?.(3);
      });

      act(() => { ctxRef.current!.commitDrop(); });

      // Zone was removed, so onDrop should not fire.
      expect(onDrop).not.toHaveBeenCalled();
    });
  });

  describe('updateDragPosition', () => {
    it('updates hoveredCategoryId when finger enters a zone', async () => {
      const { ctxRef, getByTestId } = setup();
      const measureFn = jest.fn().mockResolvedValue({ x: 0, y: 100, width: 300, height: 80 });

      act(() => {
        ctxRef.current!.registerZone(7, measureFn);
        ctxRef.current!.startDrag(makeItem(), 150, 50);
      });

      act(() => { jest.advanceTimersByTime(150); });
      await Promise.resolve();

      act(() => { ctxRef.current!.updateDragPosition(150, 140); });

      expect(getByTestId('hovered').props.children).toBe('7');
    });

    it('hoveredCategoryId is undefined when outside all zones', async () => {
      const { ctxRef, getByTestId } = setup();
      const measureFn = jest.fn().mockResolvedValue({ x: 0, y: 100, width: 300, height: 80 });

      act(() => {
        ctxRef.current!.registerZone(7, measureFn);
        ctxRef.current!.startDrag(makeItem(), 150, 50);
      });

      act(() => { jest.advanceTimersByTime(150); });
      await Promise.resolve();

      // Finger outside the zone bounds.
      act(() => { ctxRef.current!.updateDragPosition(150, 50); });

      expect(getByTestId('hovered').props.children).toBe('undefined');
    });
  });
});
