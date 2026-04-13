/**
 * SwipeableItem — shopping list row with gesture-based actions.
 *
 * Gestures (all spring back to resting after release):
 *   Swipe left ≥ 72px   → toggle done
 *   Swipe left ≥ 180px  → delete
 *   Swipe right ≥ 36px  → toggle important
 *   Double-tap card      → enter edit mode
 *   Tap check button     → toggle done
 *
 * Uses react-native-gesture-handler's Gesture.Pan() for reliable gesture
 * handling inside ScrollView (activeOffsetX / failOffsetY prevent conflicts)
 * and Reanimated for native-thread animation with worklet-computed colours.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
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
import Svg, { Path } from 'react-native-svg';
import KitchenOwlIcon from '@/components/KitchenOwlIcon';
import IconPicker from '@/components/IconPicker';
import { Colors, FontSize, Radii, Spacing } from '@/theme';
import type { LocalItem } from '@/db/items';

// ─── Thresholds ───────────────────────────────────────────────────
const SWIPE_DONE_PX = 72;
const SWIPE_DELETE_PX = 180;
const SWIPE_STAR_PX = 36;
const DOUBLE_TAP_MS = 280;

// Maximum card travel distances (clamped in onUpdate).
const LEFT_TRAVEL_MAX = (SWIPE_DELETE_PX + 30) * 2;          // 420 px
const RIGHT_TRAVEL_MAX = Math.round((SWIPE_STAR_PX + 10) / 2); // 23 px

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
      <Path
        d="M4 10 C4 10 4 4 12 4 C17 4 20 8 20 13"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <Path
        d="M8 6 L4 10 L8 14"
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
  onSave: (localId: string, name: string, iconKey: string | null) => void;
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
        onSave={(name, iconKey) => {
          onSave(item.localId, name, iconKey);
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
  onSave: (name: string, iconKey: string | null) => void;
  onCancel: () => void;
};

function EditRow({ item, onSave, onCancel }: EditRowProps) {
  const [name, setName] = useState(item.name);
  const [iconKey, setIconKey] = useState<string | null>(item.iconKey);
  const [pickerVisible, setPickerVisible] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 60);
    return () => clearTimeout(timer);
  }, []);

  function handleSave() {
    if (name.trim()) onSave(name.trim(), iconKey);
    else onCancel();
  }

  return (
    <>
      <View style={editStyles.row}>
        <TouchableOpacity
          style={editStyles.iconBtn}
          onPress={() => setPickerVisible(true)}
          activeOpacity={0.7}
        >
          <KitchenOwlIcon iconKey={iconKey} size={24} style={{ color: Colors.mint }} />
          <View style={editStyles.chevronBadge}>
            <Text style={editStyles.chevronText}>▾</Text>
          </View>
        </TouchableOpacity>

        <TextInput
          ref={inputRef}
          style={editStyles.input}
          value={name}
          onChangeText={setName}
          onSubmitEditing={handleSave}
          onKeyPress={({ nativeEvent }) => {
            if (nativeEvent.key === 'Escape') onCancel();
          }}
          returnKeyType="done"
          selectTextOnFocus
        />

        <TouchableOpacity style={editStyles.confirmBtn} onPress={handleSave} activeOpacity={0.8}>
          <IconCheck color={Colors.white} size={16} />
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

  const updateZone = useCallback(
    (zone: BackZone) => setBackZone(zone),
    []
  );

  // ── Gesture ───────────────────────────────────────────────────

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
        x < -SWIPE_DELETE_PX ? 2
        : x < -SWIPE_DONE_PX ? 1
        : x > SWIPE_STAR_PX  ? 3
        : 0;

      if (zone !== currentZone.value) {
        currentZone.value = zone;
        const name: BackZone =
          zone === 1 ? 'done' : zone === 2 ? 'delete' : zone === 3 ? 'star' : 'none';
        runOnJS(updateZone)(name);
      }
    })
    .onEnd((e) => {
      if (e.translationX < -SWIPE_DELETE_PX) {
        runOnJS(onDelete)();
      } else if (e.translationX < -SWIPE_DONE_PX) {
        runOnJS(onToggleDone)();
      } else if (e.translationX > SWIPE_STAR_PX) {
        runOnJS(onToggleImportant)();
      }

      translateX.value = withSpring(0, SPRING);
      currentZone.value = 0;
      runOnJS(updateZone)('none');
    });

  // ── Animated styles ───────────────────────────────────────────

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const backStyle = useAnimatedStyle(() => {
    const x = translateX.value;
    const bg =
      x < -SWIPE_DELETE_PX ? Colors.deleteRed
      : x < -SWIPE_DONE_PX ? (item.isChecked ? '#ffe8cc' : Colors.mintLight)
      : x > SWIPE_STAR_PX  ? '#fffae8'
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
        {backZone === 'star' && (
          <View style={backStyles.leftZone}>
            <IconStar color={Colors.yellow} size={24} filled={item.isImportant} />
          </View>
        )}
        {(backZone === 'done' || backZone === 'delete') && (
          <View style={backStyles.rightZone}>
            {backZone === 'delete' && (
              <IconTrash color={Colors.deleteRedStrong} size={24} />
            )}
            {backZone === 'done' && item.isChecked && (
              <IconUndo color={Colors.mint} size={24} />
            )}
            {backZone === 'done' && !item.isChecked && (
              <IconCheck color={Colors.mint} size={24} />
            )}
          </View>
        )}
      </Animated.View>

      {/* ── Front card ── */}
      <GestureDetector gesture={pan}>
        <Animated.View style={[rowStyles.card, frontStyle]} testID="swipeable-card">
          <View style={[rowStyles.iconWrap, item.isChecked && rowStyles.iconFaded]}>
            <KitchenOwlIcon iconKey={item.iconKey} size={28} style={{ color: Colors.mint }} />
          </View>

          <Text
            style={[rowStyles.name, item.isChecked && rowStyles.nameDone]}
            numberOfLines={1}
          >
            {item.name}
          </Text>

          {item.isDirty && !item.isChecked && <View style={rowStyles.dirtyDot} />}

          {item.isImportant && !item.isChecked && (
            <View testID="star-badge">
              <IconStar color={Colors.yellow} size={16} filled />
            </View>
          )}

          <TouchableOpacity
            style={[rowStyles.checkBtn, item.isChecked && rowStyles.checkBtnDone]}
            onPress={onToggleDone}
            activeOpacity={0.8}
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {item.isChecked && <IconCheck color={Colors.white} size={14} />}
          </TouchableOpacity>

          {/* Invisible full-card press target for double-tap-to-edit */}
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={handlePress}
            activeOpacity={1}
            accessible={false}
            testID="card-tap-target"
          />
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
