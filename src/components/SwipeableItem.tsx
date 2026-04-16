/**
 * SwipeableItem — shopping list row with gesture-based actions.
 *
 * Gestures:
 *   Swipe left ≥ 36px         → toggle done (springs back to rest)
 *   Swipe right ≥ 48px        → locks open, revealing star + delete buttons
 *   Swipe back ≥ 30px (locked) → closes buttons
 *   Tap star button            → toggle important (or undo check if item is checked)
 *   Tap delete button          → delete item
 *   Hold ≥ 500ms               → start category drag (when inside DragDropProvider)
 *   Double-tap card            → enter edit mode
 *   Tap check button           → toggle done
 *
 * Uses react-native-gesture-handler's Gesture.Pan() for reliable gesture
 * handling inside ScrollView (activeOffsetX / failOffsetY prevent conflicts)
 * and Reanimated for native-thread animation with worklet-computed colours.
 * When inside a DragDropProvider, Gesture.Race(drag, pan) is used so a quick
 * horizontal swipe (<500 ms) still triggers the swipe actions and a long hold
 * activates the drag.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import {
  impactAsync,
  ImpactFeedbackStyle,
  notificationAsync,
  NotificationFeedbackType,
} from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import KitchenOwlIcon from '@/components/KitchenOwlIcon';
import IconPicker from '@/components/IconPicker';
import { useDragDrop } from '@/components/DragDropContext';
import { useHouseholdStore } from '@/store/householdStore';
import { useAuthStore } from '@/store/authStore';
import { parseItemInput } from '@/utils/parseItemInput';
import { Colors, FontSize, Radii, Spacing } from '@/theme';
import type { LocalItem } from '@/db/items';

// ─── Haptic helpers (module-level so runOnJS refs are stable) ────
function hapticLight(): void {
  void impactAsync(ImpactFeedbackStyle.Light).catch(() => {});
}

function hapticSuccess(): void {
  void notificationAsync(NotificationFeedbackType.Success).catch(() => {});
}

// ─── Thresholds & geometry ────────────────────────────────────────
const SWIPE_DONE_PX = 36; // left-swipe distance to trigger done
const DOUBLE_TAP_MS = 280;

// Right-swipe locking: the card snaps open to reveal two tappable buttons.
const BUTTON_WIDTH = 72; // width of each action button
const BUTTON_GAP = 4; // gap between buttons, and between last button and card
const LOCK_OFFSET = BUTTON_WIDTH * 2 + BUTTON_GAP * 2; // card travel to fully reveal buttons
const OPEN_THRESHOLD = 48; // drag past this to snap open
const CLOSE_THRESHOLD = 30; // swipe back this far (when locked) to close

const LEFT_TRAVEL_MAX = 72;

const SPRING = { damping: 20, stiffness: 200 } as const;

// ─── SVG icon components ──────────────────────────────────────────

type IconProps = { color: string; size: number };

function IconCheck({ color, size }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 12 L9 18 L20 6"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function IconUndo({ color, size }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Counterclockwise arc from right side, over the top, to left side */}
      <Path
        d="M19 15 C19 10 16 7 12 7 C8 7 5 10 5 15"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      {/* Arrowhead at the left end pointing downward */}
      <Path
        d="M3 13 L5 15 L7 13"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function IconTrash({ color, size }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 4 H15 V6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M3 6 H21" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path
        d="M5 6 L6 19 H18 L19 6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M10 10 V16 M14 10 V16" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function IconStar({ color, size, filled }: IconProps & { filled: boolean }) {
  const d =
    'M12 2 L14.4 8.8 L21.5 8.9 L15.8 13.2 L17.9 20.1 L12 16 L6.1 20.1 L8.2 13.2 L2.5 8.9 L9.6 8.8 Z';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={d}
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────
export type SwipeableItemHandlers = {
  onToggleDone: (localId: string) => void;
  onToggleImportant: (localId: string) => void;
  onDelete: (localId: string) => void;
  onSave: (localId: string, name: string, description: string, iconKey: string | null) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
};

type SwipeableItemProps = SwipeableItemHandlers & { item: LocalItem };

// Zone shown in the back reveal area while dragging.
type BackZone = 'none' | 'done';

// ─── Public component ─────────────────────────────────────────────

export default function SwipeableItem({
  item,
  onToggleDone,
  onToggleImportant,
  onDelete,
  onSave,
  editingId,
  setEditingId,
}: SwipeableItemProps) {
  const isEditing = editingId === item.localId;

  if (isEditing) {
    return (
      <EditRow
        item={item}
        onSave={(name, description, iconKey) => {
          onSave(item.localId, name, description, iconKey);
          setEditingId(null);
        }}
        onCancel={() => setEditingId(null)}
      />
    );
  }

  return (
    <SwipeRowContent
      item={item}
      onToggleDone={() => onToggleDone(item.localId)}
      onToggleImportant={() => onToggleImportant(item.localId)}
      onDelete={() => onDelete(item.localId)}
      onEdit={() => setEditingId(item.localId)}
    />
  );
}

// ─── Edit row ─────────────────────────────────────────────────────

type EditRowProps = {
  item: LocalItem;
  onSave: (name: string, description: string, iconKey: string | null) => void;
  onCancel: () => void;
};

function EditRow({ item, onSave, onCancel }: EditRowProps) {
  // Show the full display text (description + name) so what the user sees in
  // the list is exactly what they edit.
  const initialText = item.description ? `${item.description} ${item.name}` : item.name;
  const [editText, setEditText] = useState(initialText);
  const [iconKey, setIconKey] = useState<string | null>(item.iconKey);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Build a searchFn for re-parsing (same pattern as AddItemBar).
  const householdId = useHouseholdStore((s) => s.selectedHousehold?.id ?? null);
  const shoppingListsApi = useAuthStore((s) => s.shoppingListsApi);
  const searchFn = useMemo(
    () =>
      householdId && shoppingListsApi
        ? (query: string) => shoppingListsApi.searchItems(householdId, query)
        : null,
    [householdId, shoppingListsApi]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 60);
    return () => clearTimeout(timer);
  }, []);

  async function handleSave() {
    const trimmed = editText.trim();
    if (!trimmed) {
      onCancel();
      return;
    }

    if (!searchFn) {
      // Offline / unauthenticated — save raw text as name, no description.
      onSave(trimmed, '', iconKey);
      return;
    }

    // Re-parse using the same progressive-token-strip algorithm as AddItemBar
    // so that edits like "500g → 1kg Beef Mince" correctly update description.
    setSaving(true);
    try {
      const result = await parseItemInput(trimmed, searchFn);
      // Keep the user-selected icon rather than overwriting with the parse result.
      onSave(result.name, result.description, iconKey);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <View style={editStyles.row}>
        <TouchableOpacity
          style={editStyles.iconBtn}
          onPress={() => setPickerVisible(true)}
          activeOpacity={0.7}
          disabled={saving}
        >
          <KitchenOwlIcon iconKey={iconKey} size={24} style={{ color: Colors.mint }} />
          <View style={editStyles.chevronBadge}>
            <Text style={editStyles.chevronText}>▾</Text>
          </View>
        </TouchableOpacity>

        <TextInput
          ref={inputRef}
          style={editStyles.input}
          value={editText}
          onChangeText={setEditText}
          onSubmitEditing={handleSave}
          onKeyPress={({ nativeEvent }) => {
            if (nativeEvent.key === 'Escape') {
              onCancel();
            }
          }}
          returnKeyType="done"
          selectTextOnFocus
          editable={!saving}
        />

        <TouchableOpacity
          style={editStyles.confirmBtn}
          onPress={handleSave}
          activeOpacity={0.8}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <IconCheck color={Colors.white} size={16} />
          )}
        </TouchableOpacity>
      </View>

      <IconPicker
        visible={pickerVisible}
        selected={iconKey}
        onSelect={setIconKey}
        onClose={() => setPickerVisible(false)}
      />
    </>
  );
}

// ─── Swipe row content ────────────────────────────────────────────

type SwipeRowContentProps = {
  item: LocalItem;
  onToggleDone: () => void;
  onToggleImportant: () => void;
  onDelete: () => void;
  onEdit: () => void;
};

function SwipeRowContent({
  item,
  onToggleDone,
  onToggleImportant,
  onDelete,
  onEdit,
}: SwipeRowContentProps) {
  const translateX = useSharedValue(0);
  // Captures translateX at the start of each gesture so panning from a
  // locked position (translateX = LOCK_OFFSET) works correctly.
  const startOffset = useSharedValue(0);
  // Tracks locked state on the UI thread so onEnd can read it in a worklet.
  const isLocked = useSharedValue(0);
  // UI-thread zone tracker avoids calling runOnJS on every frame.
  const currentZone = useSharedValue(0); // 0=none 1=done

  const [backZone, setBackZone] = useState<BackZone>('none');
  // Whether the card is snapped open and the action buttons are tappable.
  const [buttonsVisible, setButtonsVisible] = useState(false);
  const lastTapRef = useRef(0);

  const dragDrop = useDragDrop();

  const updateZone = useCallback((zone: BackZone) => setBackZone(zone), []);

  const handleCheckButtonPress = useCallback(() => {
    if (!item.isChecked) {
      hapticSuccess();
    }
    onToggleDone();
  }, [item.isChecked, onToggleDone]);

  // ── Close buttons (JS-thread helper) ─────────────────────────
  // Called from button onPress handlers and handlePress. Safe to call on the
  // JS thread — Reanimated shared values can be written from either thread.

  const closeButtons = useCallback(() => {
    translateX.value = withSpring(0, SPRING);
    isLocked.value = 0;
    setButtonsVisible(false);
  }, [translateX, isLocked]);

  // ── Button handlers ───────────────────────────────────────────

  const handleStarPress = useCallback(() => {
    closeButtons();
    if (item.isChecked) {
      onToggleDone();
    } else {
      onToggleImportant();
    }
  }, [closeButtons, item.isChecked, onToggleDone, onToggleImportant]);

  const handleDeletePress = useCallback(() => {
    closeButtons();
    onDelete();
  }, [closeButtons, onDelete]);

  // ── Gesture ───────────────────────────────────────────────────

  // Swipe pan — activates after horizontal movement; drives swipe actions.
  const pan = Gesture.Pan()
    // Activate only after 10 px of horizontal movement.
    .activeOffsetX([-10, 10])
    // Fail (hand off to ScrollView) if vertical movement exceeds 15 px first.
    .failOffsetY([-15, 15])
    .onStart(() => {
      // Capture current card position so panning from locked state is relative.
      startOffset.value = translateX.value;
    })
    .onUpdate((e) => {
      const raw = startOffset.value + e.translationX;
      // Clamp: can't go right past LOCK_OFFSET or left past LEFT_TRAVEL_MAX.
      const x = Math.max(-LEFT_TRAVEL_MAX, Math.min(LOCK_OFFSET, raw));
      translateX.value = x;

      // Only track the left-swipe (done) zone; right side uses locked buttons.
      const zone = x < -SWIPE_DONE_PX ? 1 : 0;
      if (zone !== currentZone.value) {
        currentZone.value = zone;
        runOnJS(updateZone)(zone === 1 ? 'done' : 'none');
        runOnJS(hapticLight)();
      }
    })
    .onEnd((e) => {
      const finalX = startOffset.value + e.translationX;

      if (isLocked.value === 1) {
        // Card is locked open. Swiping back far enough closes the buttons;
        // otherwise snap back to the locked position.
        if (e.translationX < -CLOSE_THRESHOLD) {
          translateX.value = withSpring(0, SPRING);
          isLocked.value = 0;
          runOnJS(setButtonsVisible)(false);
        } else {
          translateX.value = withSpring(LOCK_OFFSET, SPRING);
        }
      } else if (finalX < -SWIPE_DONE_PX) {
        // Left swipe → toggle done.
        if (!item.isChecked) {
          runOnJS(hapticSuccess)();
        }
        runOnJS(onToggleDone)();
        translateX.value = withSpring(0, SPRING);
      } else if (finalX > OPEN_THRESHOLD) {
        // Right swipe past threshold → snap open and reveal action buttons.
        translateX.value = withSpring(LOCK_OFFSET, SPRING);
        isLocked.value = 1;
        runOnJS(hapticLight)();
        runOnJS(setButtonsVisible)(true);
      } else {
        // Short drag — spring back to rest.
        translateX.value = withSpring(0, SPRING);
      }

      currentZone.value = 0;
      runOnJS(updateZone)('none');
    });

  // Compose gestures: when inside a DragDropProvider, Race lets whichever
  // gesture activates first (swipe or long-press drag) win.
  let gesture: ReturnType<typeof Gesture.Pan> | ReturnType<typeof Gesture.Race>;
  if (dragDrop) {
    const drag = Gesture.Pan()
      // Activate after a 500 ms hold.
      .activateAfterLongPress(500)
      // Fail on vertical movement so pull-to-refresh still works: if the user
      // pulls down, this gesture fails immediately and the ScrollView takes over.
      .failOffsetY([-10, 10])
      .onStart((e) => {
        runOnJS(dragDrop.startDrag)(item, e.absoluteX, e.absoluteY);
      })
      .onUpdate((e) => {
        runOnJS(dragDrop.updateDragPosition)(e.absoluteX, e.absoluteY);
      })
      .onEnd(() => {
        runOnJS(dragDrop.commitDrop)();
      })
      .onFinalize(() => {
        runOnJS(dragDrop.cancelDrag)();
      });
    gesture = Gesture.Race(drag, pan);
  } else {
    gesture = pan;
  }

  // ── Animated styles ───────────────────────────────────────────

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // ── Sliding-door button animation ────────────────────────────
  // Both buttons start stacked at LOCK_OFFSET (the card's resting left edge)
  // and slide left to their final positions as the card moves right.
  // The star button travels the full LOCK_OFFSET distance; the delete button
  // travels only the remaining gap, so the star glides over the delete as
  // they spread apart — like two sliding doors opening.

  const starSlide = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, translateX.value / LOCK_OFFSET));
    return { transform: [{ translateX: LOCK_OFFSET * (1 - progress) }] };
  });

  const deleteSlide = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, translateX.value / LOCK_OFFSET));
    return {
      transform: [{ translateX: (LOCK_OFFSET - BUTTON_WIDTH - BUTTON_GAP) * (1 - progress) }],
    };
  });

  // Only colour the back for the left-swipe (done) zone; the right side is
  // handled by the button backgrounds themselves.
  const backStyle = useAnimatedStyle(() => {
    const x = translateX.value;
    const bg =
      x < -SWIPE_DONE_PX
        ? item.isChecked
          ? '#ffe8cc'
          : Colors.mintLight
        : x > 0
          ? Colors.mintBg
          : 'transparent';
    return { backgroundColor: bg };
  });

  // ── Press / double-tap ────────────────────────────────────────

  const handlePress = useCallback(() => {
    // If buttons are open, a tap on the card closes them without any action.
    if (buttonsVisible) {
      closeButtons();
      return;
    }
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      lastTapRef.current = 0;
      onEdit();
    } else {
      lastTapRef.current = now;
    }
  }, [buttonsVisible, closeButtons, onEdit]);

  // ─────────────────────────────────────────────────────────────

  return (
    <View style={rowStyles.row}>
      {/* ── Back reveal ── */}
      <Animated.View style={[StyleSheet.absoluteFill, backStyles.container, backStyle]}>
        {/* Right-swipe action buttons. Always rendered so they are visible the
            moment the user begins dragging; disabled until the card snaps open. */}
        <View
          style={backStyles.buttonRow}
          pointerEvents={buttonsVisible ? 'box-none' : 'none'}
        >
          {/* Delete — behind (rendered first, lower z-order).
              Slides from LOCK_OFFSET to its resting position so the star can
              glide over it as they spread apart like sliding doors. */}
          <Animated.View style={[backStyles.deleteContainer, deleteSlide]}>
            <TouchableOpacity
              style={[backStyles.actionButton, backStyles.deleteButton]}
              onPress={handleDeletePress}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Delete"
              disabled={!buttonsVisible}
            >
              <IconTrash color={Colors.white} size={22} />
            </TouchableOpacity>
          </Animated.View>

          {/* Star / undo — in front (rendered second, higher z-order).
              Slides all the way to the left, gliding over the delete button. */}
          <Animated.View style={[backStyles.starContainer, starSlide]}>
            <TouchableOpacity
              style={[
                backStyles.actionButton,
                item.isChecked ? backStyles.undoButton : backStyles.starButton,
              ]}
              onPress={handleStarPress}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={item.isChecked ? 'Undo' : 'Favourite'}
              disabled={!buttonsVisible}
            >
              {item.isChecked ? (
                <IconUndo color={Colors.mint} size={22} />
              ) : (
                <IconStar color={Colors.yellow} size={22} filled={item.isImportant} />
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Left-swipe done indicator */}
        {backZone === 'done' && (
          <View style={backStyles.rightZone}>
            {item.isChecked ? (
              <IconUndo color={Colors.mint} size={24} />
            ) : (
              <IconCheck color={Colors.mint} size={24} />
            )}
          </View>
        )}
      </Animated.View>

      {/* ── Front card ── */}
      <GestureDetector gesture={gesture}>
        <Animated.View style={[rowStyles.card, frontStyle]} testID="swipeable-card">
          <View style={[rowStyles.iconWrap, item.isChecked && rowStyles.iconFaded]}>
            <KitchenOwlIcon iconKey={item.iconKey} size={28} style={{ color: Colors.mint }} />
          </View>

          <Text style={[rowStyles.name, item.isChecked && rowStyles.nameDone]} numberOfLines={1}>
            {item.description ? `${item.description} ${item.name}` : item.name}
          </Text>

          {item.isDirty && !item.isChecked && <View style={rowStyles.dirtyDot} />}

          {item.isImportant && !item.isChecked && (
            <View testID="star-badge">
              <IconStar color={Colors.yellow} size={16} filled />
            </View>
          )}

          {/* Invisible full-card press target for double-tap-to-edit.
              Rendered before the checkbox so the checkbox sits on top and
              receives taps in its area first. */}
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={handlePress}
            activeOpacity={1}
            accessible={false}
            testID="card-tap-target"
          />

          <TouchableOpacity
            style={[rowStyles.checkBtn, item.isChecked && rowStyles.checkBtnDone]}
            onPress={handleCheckButtonPress}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Check"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            testID="check-button"
          >
            {item.isChecked && <IconCheck color={Colors.white} size={14} />}
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────

const editStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 2.5,
    borderColor: Colors.mint,
    shadowColor: Colors.mint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: Radii.md,
    borderWidth: 2,
    borderColor: Colors.mintPale,
    backgroundColor: Colors.mintBg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chevronBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 13,
    height: 13,
    borderRadius: Radii.full,
    backgroundColor: Colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronText: {
    color: Colors.white,
    fontSize: 7,
    lineHeight: 10,
    includeFontPadding: false,
  },
  input: {
    flex: 1,
    borderBottomWidth: 2,
    borderBottomColor: Colors.mintPale,
    fontSize: FontSize.body,
    fontWeight: '600',
    color: Colors.textDark,
    paddingVertical: Spacing.xs,
    backgroundColor: 'transparent',
  },
  confirmBtn: {
    width: 28,
    height: 28,
    borderRadius: Radii.full,
    backgroundColor: Colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});

const backStyles = StyleSheet.create({
  container: {
    borderRadius: Radii.lg,
    overflow: 'hidden',
  },
  // Container for the two sliding-door action buttons.
  buttonRow: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: LOCK_OFFSET,
  },
  // Star / undo button — final resting position at the left edge.
  starContainer: {
    position: 'absolute',
    left: 0,
    top: BUTTON_GAP,
    bottom: BUTTON_GAP,
    width: BUTTON_WIDTH,
  },
  // Delete button — final resting position just right of the star.
  deleteContainer: {
    position: 'absolute',
    left: BUTTON_WIDTH + BUTTON_GAP,
    top: BUTTON_GAP,
    bottom: BUTTON_GAP,
    width: BUTTON_WIDTH,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.md,
  },
  starButton: {
    backgroundColor: '#fffae8',
  },
  undoButton: {
    backgroundColor: Colors.mintLight,
  },
  deleteButton: {
    backgroundColor: Colors.deleteRedStrong,
  },
  rightZone: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const rowStyles = StyleSheet.create({
  row: {
    width: '100%',
    marginBottom: Spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radii.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
    shadowColor: Colors.mint,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  iconWrap: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconFaded: {
    opacity: 0.45,
  },
  name: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: '600',
    color: Colors.textDark,
  },
  nameDone: {
    color: Colors.textFaded,
    textDecorationLine: 'line-through',
  },
  dirtyDot: {
    width: 7,
    height: 7,
    borderRadius: Radii.full,
    backgroundColor: Colors.yellow,
    flexShrink: 0,
  },
  checkBtn: {
    width: 26,
    height: 26,
    borderRadius: Radii.full,
    borderWidth: 2.5,
    borderColor: Colors.mintPale,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkBtnDone: {
    borderColor: Colors.mint,
    backgroundColor: Colors.mint,
  },
});
