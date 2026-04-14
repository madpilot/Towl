/**
 * SwipeableItem — shopping list row with gesture-based actions.
 *
 * Gestures (all spring back to resting after release):
 *   Swipe left ≥ 36px   → toggle done
 *   Swipe right ≥ 36px  → toggle important (or undo if item is checked)
 *   Swipe right ≥ 108px → delete
 *   Hold ≥ 500ms        → start category drag (when inside DragDropProvider)
 *   Double-tap card      → enter edit mode
 *   Tap check button     → toggle done
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
import * as Haptics from 'expo-haptics';
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
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

function hapticSuccess(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

// ─── Thresholds ───────────────────────────────────────────────────
const SWIPE_DONE_PX = 36;
const SWIPE_DELETE_PX = 108;
const SWIPE_STAR_PX = 36;
const DOUBLE_TAP_MS = 280;

// Maximum card travel distances (clamped in onUpdate).
const LEFT_TRAVEL_MAX = 72;
const RIGHT_TRAVEL_MAX = 162;

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
      <Path
        d="M10 10 V16 M14 10 V16"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
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
type BackZone = 'none' | 'done' | 'delete' | 'star';

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
    if (!trimmed) { onCancel(); return; }

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
            if (nativeEvent.key === 'Escape') onCancel();
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
          {saving
            ? <ActivityIndicator size="small" color={Colors.white} />
            : <IconCheck color={Colors.white} size={16} />
          }
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
  // UI-thread zone tracker avoids calling runOnJS on every frame.
  const currentZone = useSharedValue(0); // 0=none 1=done 2=delete 3=star

  const [backZone, setBackZone] = useState<BackZone>('none');
  const lastTapRef = useRef(0);

  const dragDrop = useDragDrop();

  const updateZone = useCallback(
    (zone: BackZone) => setBackZone(zone),
    []
  );

  const handleCheckButtonPress = useCallback(() => {
    if (!item.isChecked) hapticSuccess();
    onToggleDone();
  }, [item.isChecked, onToggleDone]);

  // ── Gesture ───────────────────────────────────────────────────

  // Swipe pan — activates after horizontal movement; drives swipe actions.
  const pan = Gesture.Pan()
    // Activate only after 10 px of horizontal movement.
    .activeOffsetX([-10, 10])
    // Fail (hand off to ScrollView) if vertical movement exceeds 15 px first.
    .failOffsetY([-15, 15])
    .onUpdate((e) => {
      const x = Math.max(
        -LEFT_TRAVEL_MAX,
        Math.min(RIGHT_TRAVEL_MAX, e.translationX)
      );
      translateX.value = x;

      const zone =
        x < -SWIPE_DONE_PX    ? 1  // done
        : x > SWIPE_DELETE_PX ? 3  // delete (right long)
        : x > SWIPE_STAR_PX   ? 2  // star / undo (right short)
        : 0;

      if (zone !== currentZone.value) {
        currentZone.value = zone;
        const name: BackZone =
          zone === 1 ? 'done' : zone === 2 ? 'star' : zone === 3 ? 'delete' : 'none';
        runOnJS(updateZone)(name);
        runOnJS(hapticLight)();
      }
    })
    .onEnd((e) => {
      if (e.translationX < -SWIPE_DONE_PX) {
        if (!item.isChecked) runOnJS(hapticSuccess)();
        runOnJS(onToggleDone)();
      } else if (e.translationX > SWIPE_DELETE_PX) {
        runOnJS(onDelete)();
      } else if (e.translationX > SWIPE_STAR_PX) {
        // Checked (trolley) items: right-swipe short = undo back to list.
        // Unchecked items: right-swipe short = toggle important.
        if (item.isChecked) {
          runOnJS(onToggleDone)();
        } else {
          runOnJS(onToggleImportant)();
        }
      }

      translateX.value = withSpring(0, SPRING);
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

  const backStyle = useAnimatedStyle(() => {
    const x = translateX.value;
    const bg =
      x < -SWIPE_DONE_PX    ? (item.isChecked ? '#ffe8cc' : Colors.mintLight)
      : x > SWIPE_DELETE_PX ? Colors.deleteRed
      : x > SWIPE_STAR_PX   ? (item.isChecked ? '#ffe8cc' : '#fffae8')
      : 'transparent';
    return { backgroundColor: bg };
  });

  // ── Press / double-tap ────────────────────────────────────────

  const handlePress = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      lastTapRef.current = 0;
      onEdit();
    } else {
      lastTapRef.current = now;
    }
  }, [onEdit]);

  // ─────────────────────────────────────────────────────────────

  return (
    <View style={rowStyles.row}>
      {/* ── Back reveal ── */}
      <Animated.View
        style={[StyleSheet.absoluteFill, backStyles.container, backStyle]}
      >
        {(backZone === 'star' || backZone === 'delete') && (
          <View style={backStyles.leftZone}>
            {backZone === 'delete' && (
              <IconTrash color={Colors.deleteRedStrong} size={24} />
            )}
            {backZone === 'star' && item.isChecked && (
              <IconUndo color={Colors.mint} size={24} />
            )}
            {backZone === 'star' && !item.isChecked && (
              <IconStar color={Colors.yellow} size={24} filled={item.isImportant} />
            )}
          </View>
        )}
        {backZone === 'done' && (
          <View style={backStyles.rightZone}>
            {item.isChecked
              ? <IconUndo color={Colors.mint} size={24} />
              : <IconCheck color={Colors.mint} size={24} />
            }
          </View>
        )}
      </Animated.View>

      {/* ── Front card ── */}
      <GestureDetector gesture={gesture}>
        <Animated.View style={[rowStyles.card, frontStyle]} testID="swipeable-card">
          <View style={[rowStyles.iconWrap, item.isChecked && rowStyles.iconFaded]}>
            <KitchenOwlIcon iconKey={item.iconKey} size={28} style={{ color: Colors.mint }} />
          </View>

          <Text
            style={[rowStyles.name, item.isChecked && rowStyles.nameDone]}
            numberOfLines={1}
          >
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
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
  leftZone: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
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
