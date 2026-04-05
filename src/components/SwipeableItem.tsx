import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import KitchenOwlIcon from '@/components/KitchenOwlIcon';
import IconPicker from '@/components/IconPicker';
import { getIconMeta } from '@/data/iconMetadata';
import { Colors, Spacing, Radii, FontSize } from '@/theme';
import type { LocalItem } from '@/db/items';

// ─── Swipe thresholds ────────────────────────────────────────────
const SWIPE_DONE_PX = 72;    // left-short → toggle done
const SWIPE_DELETE_PX = 180; // left-long  → delete
const SWIPE_STAR_PX = 72;    // right      → toggle important
const DOUBLE_TAP_MS = 280;

// ─── Types ───────────────────────────────────────────────────────
export type SwipeableItemHandlers = {
  onToggleDone: (localId: string) => void;
  onToggleImportant: (localId: string) => void;
  onDelete: (localId: string) => void;
  onSave: (localId: string, name: string, iconKey: string | null) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
}

type SwipeableItemProps = SwipeableItemHandlers & {
  item: LocalItem;
}

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
    <SwipeRow
      item={item}
      onToggleDone={() => onToggleDone(item.localId)}
      onToggleImportant={() => onToggleImportant(item.localId)}
      onDelete={() => onDelete(item.localId)}
      onEdit={() => setEditingId(item.localId)}
    />
  );
}

// ─── Edit row ────────────────────────────────────────────────────

type EditRowProps = {
  item: LocalItem;
  onSave: (name: string, iconKey: string | null) => void;
  onCancel: () => void;
}

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
        {/* Icon button opens the picker modal */}
        <TouchableOpacity
          style={editStyles.iconBtn}
          onPress={() => setPickerVisible(true)}
          activeOpacity={0.7}
        >
          <KitchenOwlIcon
            iconKey={iconKey}
            size={24}
            fallbackEmoji={getIconMeta(iconKey).emoji}
            style={{ color: Colors.mint }}
          />
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

        {/* Confirm button */}
        <TouchableOpacity style={editStyles.confirmBtn} onPress={handleSave} activeOpacity={0.8}>
          <Text style={editStyles.confirmCheck}>✓</Text>
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

// ─── Swipe row ───────────────────────────────────────────────────

type SwipeRowProps = {
  item: LocalItem;
  onToggleDone: () => void;
  onToggleImportant: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

function SwipeRow({ item, onToggleDone, onToggleImportant, onDelete, onEdit }: SwipeRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const lastTap = useRef(0);
  // Track whether a gesture is in progress so we can skip the spring on release.
  const isDragging = useRef(false);
  // Raw dx accumulated during this gesture.
  const rawDx = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4,
      onPanResponderGrant: () => {
        isDragging.current = false;
        rawDx.current = 0;
      },
      onPanResponderMove: (_, g) => {
        isDragging.current = true;
        rawDx.current = g.dx;
        const clamped = Math.max(-SWIPE_DELETE_PX - 20, Math.min(SWIPE_STAR_PX + 20, g.dx));
        translateX.setValue(clamped);
      },
      onPanResponderRelease: (_, g) => {
        const moved = Math.abs(g.dx);
        const dx = g.dx;

        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 120,
          friction: 10,
        }).start();

        if (moved < 5) {
          // Tap — check for double-tap (Date.now in gesture handler, not in render)
          // eslint-disable-next-line react-hooks/purity
          const now = Date.now();
          if (now - lastTap.current < DOUBLE_TAP_MS) {
            lastTap.current = 0;
            onEdit();
          } else {
            lastTap.current = now;
          }
        } else if (dx < -SWIPE_DELETE_PX) {
          onDelete();
        } else if (dx < -SWIPE_DONE_PX) {
          onToggleDone();
        } else if (dx > SWIPE_STAR_PX) {
          onToggleImportant();
        }

        isDragging.current = false;
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        isDragging.current = false;
      },
    })
  ).current;

  // Derive reveal opacity/colour from translate (read synchronously for native driver compat)
  const leftOpacity = translateX.interpolate({
    inputRange: [-SWIPE_DONE_PX, -8],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const leftColor = translateX.interpolate({
    inputRange: [-SWIPE_DELETE_PX, -SWIPE_DELETE_PX + 1],
    outputRange: [Colors.deleteRed, item.isChecked ? '#ffe8cc' : Colors.mintLight],
    extrapolate: 'clamp',
  });
  const rightOpacity = translateX.interpolate({
    inputRange: [8, SWIPE_STAR_PX],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={rowStyles.wrapper}>
      {/* Left reveal (done / delete) */}
      <Animated.View style={[rowStyles.reveal, rowStyles.revealLeft, { opacity: leftOpacity, backgroundColor: leftColor }]}>
        <Text style={rowStyles.revealLabel}>{item.isChecked ? '↩' : '✓'}</Text>
      </Animated.View>

      {/* Right reveal (star) */}
      <Animated.View style={[rowStyles.reveal, rowStyles.revealRight, { opacity: rightOpacity }]}>
        <Text style={rowStyles.starReveal}>{item.isImportant ? '★' : '☆'}</Text>
      </Animated.View>

      {/* Card */}
      <Animated.View
        style={[rowStyles.card, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {/* Icon */}
        <View style={[rowStyles.iconWrap, item.isChecked && rowStyles.iconFaded]}>
          <KitchenOwlIcon
            iconKey={item.iconKey}
            size={28}
            fallbackEmoji={getIconMeta(item.iconKey).emoji}
            style={{ color: Colors.mint }}
          />
        </View>

        {/* Name */}
        <Text
          style={[rowStyles.name, item.isChecked && rowStyles.nameDone]}
          numberOfLines={1}
        >
          {item.name}
        </Text>

        {/* Dirty indicator */}
        {item.isDirty && !item.isChecked && (
          <View style={rowStyles.dirtyDot} />
        )}

        {/* Star badge */}
        {item.isImportant && !item.isChecked && (
          <Text style={rowStyles.starBadge}>★</Text>
        )}

        {/* Check button */}
        <TouchableOpacity
          style={[rowStyles.checkBtn, item.isChecked && rowStyles.checkBtnDone]}
          onPress={onToggleDone}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {item.isChecked && <Text style={rowStyles.checkMark}>✓</Text>}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────

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
  confirmCheck: {
    color: Colors.white,
    fontSize: FontSize.small,
    fontWeight: '700',
  },
});

const rowStyles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    borderRadius: Radii.lg,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  reveal: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: Radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  revealLeft: {
    right: 0,
    left: 0,
    alignItems: 'flex-end',
    backgroundColor: Colors.mintLight,
  },
  revealRight: {
    left: 0,
    right: 0,
    alignItems: 'flex-start',
    backgroundColor: '#fffae8',
  },
  revealLabel: {
    fontSize: FontSize.heading,
    fontWeight: '800',
    color: Colors.mint,
  },
  starReveal: {
    fontSize: FontSize.heading,
    color: Colors.yellow,
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
  starBadge: {
    fontSize: FontSize.small,
    color: Colors.yellow,
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
  checkMark: {
    color: Colors.white,
    fontSize: FontSize.small,
    fontWeight: '700',
    lineHeight: FontSize.small + 2,
  },
});
