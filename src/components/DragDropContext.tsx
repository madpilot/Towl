/**
 * DragDropContext — cross-component state for category drag-and-drop.
 *
 * Usage:
 *   1. Wrap the screen with <DragDropProvider onDrop={...}>
 *   2. Call useDragDrop() inside children to access drag state and actions.
 *
 * Zone registration:
 *   - CategorySection calls registerZone(categoryId, measureFn) on mount
 *   - measureFn returns the zone's screen-absolute bounds (via measureInWindow)
 *   - Zones are measured lazily 150 ms after drag starts to allow empty
 *     categories to mount and render before their bounds are captured.
 *
 * Ghost position:
 *   - ghostX / ghostY are Reanimated shared values updated on every gesture frame
 *   - The ghost View rendered by the screen follows these values natively
 *
 * Drop flow:
 *   - onEnd  → commitDrop()   — fires the onDrop callback if a zone is hovered
 *   - onFinalize → cancelDrag() — always cleans up state (fires after onEnd too)
 */

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import type { LocalItem } from '@/db/items';

// ─── Types ────────────────────────────────────────────────────────────────────

type Bounds = { x: number; y: number; width: number; height: number };
type MeasureFn = () => Promise<Bounds | null>;

export type DragDropContextValue = {
  /** Whether a drag is currently in progress. */
  dragging: boolean;
  /** The item being dragged (null when not dragging). */
  draggingItem: LocalItem | null;
  /**
   * Which category zone the finger is currently over.
   * undefined = finger is not over any registered zone.
   * null = finger is over the "Uncategorized" zone.
   * number = server category id.
   */
  hoveredCategoryId: number | null | undefined;
  /** Reanimated shared value — ghost X position (screen-absolute). */
  ghostX: SharedValue<number>;
  /** Reanimated shared value — ghost Y position (screen-absolute). */
  ghostY: SharedValue<number>;
  /** Reanimated shared value — ghost opacity (0 hidden, 1 visible). */
  ghostOpacity: SharedValue<number>;
  /** CategorySection calls this on mount with its measure callback. */
  registerZone: (categoryId: number | null, measure: MeasureFn) => void;
  /** CategorySection calls this on unmount. */
  unregisterZone: (categoryId: number | null) => void;
  /** Called from the SwipeableItem gesture onStart. */
  startDrag: (item: LocalItem, x: number, y: number) => void;
  /** Called from the SwipeableItem gesture onUpdate (every frame). */
  updateDragPosition: (x: number, y: number) => void;
  /** Called from gesture onEnd — fires the drop callback if over a zone. */
  commitDrop: () => void;
  /** Called from gesture onFinalize — always cleans up drag state. */
  cancelDrag: () => void;
  /**
   * Clears cached zone bounds and re-measures all registered zones.
   * Call this after the ScrollView scrolls during a drag so that zone
   * hit-testing reflects the updated screen positions.
   */
  remeasureZones: () => void;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const DragDropContext = createContext<DragDropContextValue | null>(null);

/** Returns null when called outside a DragDropProvider (safe in tests). */
export function useDragDrop(): DragDropContextValue | null {
  return useContext(DragDropContext);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

type DragDropProviderProps = {
  children: React.ReactNode;
  /**
   * Fired when the user releases an item over a valid drop zone.
   * categoryId = null means "Uncategorized".
   */
  onDrop: (item: LocalItem, categoryId: number | null) => void;
};

export function DragDropProvider({ children, onDrop }: DragDropProviderProps) {
  const [dragging, setDragging] = useState(false);
  const [draggingItem, setDraggingItem] = useState<LocalItem | null>(null);
  const [hoveredCategoryId, setHoveredCategoryId] = useState<number | null | undefined>(undefined);

  const ghostX = useSharedValue(0);
  const ghostY = useSharedValue(0);
  const ghostOpacity = useSharedValue(0);

  // Stable refs — not re-created on each render.
  const zonesRef = useRef<Map<number | null, MeasureFn>>(new Map());
  // Wrap shared values in a ref so callbacks can write to .value without
  // listing them as useCallback deps (they have stable identity anyway).
  const ghostRef = useRef({ x: ghostX, y: ghostY, opacity: ghostOpacity });
  const boundsRef = useRef<Map<number | null, Bounds>>(new Map());
  const measuringRef = useRef(false);
  const draggingItemRef = useRef<LocalItem | null>(null);
  const hoveredRef = useRef<number | null | undefined>(undefined);
  // Keep onDrop in a ref so commitDrop closure never stales.
  const onDropRef = useRef(onDrop);
  // Update ref in an effect — never during render (react-hooks/refs).
  // commitDrop is only called from gesture handlers (after render), so it's
  // always up to date when needed.
  React.useEffect(() => {
    onDropRef.current = onDrop;
  });

  // ── Zone registration ──────────────────────────────────────────────────────

  const registerZone = useCallback((categoryId: number | null, measure: MeasureFn) => {
    zonesRef.current.set(categoryId, measure);
    // Invalidate cached bounds for this zone so it gets re-measured.
    boundsRef.current.delete(categoryId);
  }, []);

  const unregisterZone = useCallback((categoryId: number | null) => {
    zonesRef.current.delete(categoryId);
    boundsRef.current.delete(categoryId);
  }, []);

  // ── Zone measurement ───────────────────────────────────────────────────────

  const measureAllZones = useCallback(async () => {
    if (measuringRef.current) return;
    measuringRef.current = true;
    const promises = Array.from(zonesRef.current.entries()).map(async ([id, fn]) => {
      if (boundsRef.current.has(id)) return; // already cached
      const bounds = await fn();
      if (bounds) boundsRef.current.set(id, bounds);
    });
    await Promise.all(promises);
    measuringRef.current = false;
  }, []);

  // ── Drag actions ───────────────────────────────────────────────────────────

  const startDrag = useCallback((item: LocalItem, x: number, y: number) => {
    draggingItemRef.current = item;
    hoveredRef.current = undefined;
    boundsRef.current.clear();
    measuringRef.current = false;

    // Access shared values through the stable ref to avoid react-hooks/immutability.
    ghostRef.current.x.value = x;
    ghostRef.current.y.value = y - 30; // float slightly above finger
    ghostRef.current.opacity.value = 1;

    setDraggingItem(item);
    setDragging(true);
    setHoveredCategoryId(undefined);

    // Measure zones after a short delay to allow empty categories to mount.
    setTimeout(() => { void measureAllZones(); }, 150);
  }, [measureAllZones]);

  const updateDragPosition = useCallback((x: number, y: number) => {
    ghostRef.current.x.value = x;
    ghostRef.current.y.value = y - 30;

    if (boundsRef.current.size === 0) {
      // Bounds not yet measured — trigger a measurement and bail out this frame.
      void measureAllZones();
      return;
    }

    // Hit-test all registered zones.
    let hovered: number | null | undefined = undefined;
    for (const [categoryId, bounds] of boundsRef.current) {
      if (
        x >= bounds.x && x <= bounds.x + bounds.width &&
        y >= bounds.y && y <= bounds.y + bounds.height
      ) {
        hovered = categoryId;
        break;
      }
    }

    if (hovered !== hoveredRef.current) {
      hoveredRef.current = hovered;
      setHoveredCategoryId(hovered);
    }
  }, [measureAllZones]);

  /** Fire the drop callback if a zone is hovered (called from gesture onEnd). */
  const commitDrop = useCallback(() => {
    const item = draggingItemRef.current;
    const categoryId = hoveredRef.current;
    if (item !== null && categoryId !== undefined) {
      onDropRef.current(item, categoryId);
    }
  }, []);

  /** Reset all drag state (called from gesture onFinalize, which always fires). */
  const cancelDrag = useCallback(() => {
    ghostRef.current.opacity.value = 0;
    draggingItemRef.current = null;
    hoveredRef.current = undefined;
    boundsRef.current.clear();
    setDragging(false);
    setDraggingItem(null);
    setHoveredCategoryId(undefined);
  }, []);

  /**
   * Clears cached zone bounds so the next updateDragPosition call re-measures.
   * Called by the auto-scroll loop after programmatic scrolling moves the zones.
   */
  const remeasureZones = useCallback(() => {
    boundsRef.current.clear();
    measuringRef.current = false;
    void measureAllZones();
  }, [measureAllZones]);

  // ── Context value ──────────────────────────────────────────────────────────

  const value: DragDropContextValue = {
    dragging,
    draggingItem,
    hoveredCategoryId,
    ghostX,
    ghostY,
    ghostOpacity,
    registerZone,
    unregisterZone,
    startDrag,
    updateDragPosition,
    commitDrop,
    cancelDrag,
    remeasureZones,
  };

  return (
    <DragDropContext.Provider value={value}>
      {children}
    </DragDropContext.Provider>
  );
}
