import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import KitchenOwlIcon from '@/components/KitchenOwlIcon';
import CameraIcon from '@/components/icons/CameraIcon';
import { useItemSuggestions } from '@/hooks/useItemSuggestions';
import { useHouseholdStore } from '@/store/householdStore';
import { useAuthStore } from '@/store/authStore';
import { parseItemInput } from '@/utils/parseItemInput';
import { Colors, Spacing, Radii, FontSize } from '@/theme';
import type { ItemSuggestion } from '@/hooks/useItemSuggestions';

type AddItemBarProps = {
  onAdd: (name: string, description: string, iconKey: string | null, category: string) => void;
};

/**
 * Returns the text in `input` that precedes `matchedName` (case-insensitive).
 * Used to capture a quantity or modifier prefix when the user selects a
 * suggestion chip — e.g. typing "500g Beef Mince" then tapping "Beef Mince"
 * gives description = "500g".
 */
function extractPrefix(input: string, matchedName: string): string {
  const idx = input.toLowerCase().indexOf(matchedName.toLowerCase());
  if (idx <= 0) { return ''; }
  return input.slice(0, idx).trim();
}

export default function AddItemBar({ onAdd }: AddItemBarProps) {
  const [value, setValue] = useState('');
  const [parsing, setParsing] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const householdId = useHouseholdStore((s) => s.selectedHousehold?.id ?? null);
  const shoppingListsApi = useAuthStore((s) => s.shoppingListsApi);

  const searchFn = useMemo(
    () =>
      householdId && shoppingListsApi
        ? (query: string) => shoppingListsApi.searchItems(householdId, query)
        : null,
    [householdId, shoppingListsApi]
  );

  const suggestions = useItemSuggestions(value, 5, searchFn);
  const trimmedValue = value.trim();
  const exactMatch =
    trimmedValue.length >= 2
      ? (suggestions.find((s) => s.displayName.toLowerCase() === trimmedValue.toLowerCase()) ??
        null)
      : null;
  const showSuggestions = trimmedValue.length >= 2 && suggestions.length > 0;

  function commit(name: string, description: string, iconKey: string | null, category: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    onAdd(trimmed, description.trim(), iconKey, category);
    setValue('');
    inputRef.current?.blur();
  }

  async function handleAdd() {
    const trimmed = trimmedValue;
    if (!trimmed || parsing) { return; }

    if (exactMatch) {
      // User typed the item name exactly — no prefix to extract.
      commit(exactMatch.displayName, '', exactMatch.iconKey, exactMatch.category);
      return;
    }

    if (!searchFn) {
      // Offline / unauthenticated — skip parse, add raw input.
      commit(trimmed, '', null, 'Other');
      return;
    }

    // Run the progressive-token-stripping parser to split the free-text input
    // into a canonical catalog name + quantity/modifier description prefix.
    setParsing(true);
    try {
      const result = await parseItemInput(trimmed, searchFn);
      commit(result.name, result.description, result.iconKey, result.category);
    } finally {
      setParsing(false);
    }
  }

  function handleSuggestion(s: ItemSuggestion) {
    // Capture any prefix the user typed before the suggestion's name so that
    // e.g. "500g Beef Mince" + tap "Beef Mince" → description = "500g".
    const description = extractPrefix(value.trim(), s.displayName);
    commit(s.displayName, description, s.iconKey, s.category);
  }

  const busy = parsing;

  return (
    <View style={styles.wrapper}>
      {/* Input row */}
      <View style={[styles.inputRow, showSuggestions && styles.inputRowOpen]}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={setValue}
          onSubmitEditing={handleAdd}
          placeholder="What do we need?"
          placeholderTextColor={Colors.textFaded}
          returnKeyType="done"
          blurOnSubmit={false}
          testID="add-item-input"
        />
        <TouchableOpacity
          style={[styles.addBtn, busy && styles.addBtnBusy]}
          onPress={handleAdd}
          activeOpacity={0.85}
          disabled={busy}
          testID="add-item-submit"
        >
          {busy ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : value.trim() ? (
            <Text style={styles.addBtnPlus}>+</Text>
          ) : (
            <CameraIcon size={20} color={Colors.white} />
          )}
        </TouchableOpacity>
      </View>

      {/* Suggestions */}
      {showSuggestions && (
        <View style={styles.suggestions}>
          {/* Add-as-typed row — hidden when the typed value exactly matches a suggestion */}
          {!exactMatch && (
            <TouchableOpacity style={styles.suggestTyped} onPress={handleAdd} activeOpacity={0.8}>
              <View style={styles.suggestTypedIcon}>
                <Text style={styles.suggestTypedPlus}>+</Text>
              </View>
              <Text style={styles.suggestName} numberOfLines={1}>
                {trimmedValue}
              </Text>
              <Text style={styles.suggestArrow}>→</Text>
            </TouchableOpacity>
          )}

          {suggestions.map((s, i) => (
            <TouchableOpacity
              key={s.key}
              style={[styles.suggestRow, i < suggestions.length - 1 && styles.suggestRowBorder]}
              onPress={() => handleSuggestion(s)}
              activeOpacity={0.8}
            >
              <View style={styles.suggestIconWrap}>
                <KitchenOwlIcon iconKey={s.iconKey} size={22} style={{ color: Colors.mint }} />
              </View>
              <Text style={styles.suggestName} numberOfLines={1}>
                <SuggestLabel name={s.displayName} query={value} />
              </Text>
              <Text style={styles.suggestCategory}>{s.category}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

/** Renders suggestion name with the matched portion bolded. */
function SuggestLabel({ name, query }: { name: string; query: string }) {
  const idx = name.toLowerCase().indexOf(query.toLowerCase().trim());
  if (idx === -1) {
    return <>{name}</>;
  }
  return (
    <>
      {name.slice(0, idx)}
      <Text style={styles.boldMatch}>{name.slice(idx, idx + query.trim().length)}</Text>
      {name.slice(idx + query.trim().length)}
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radii.xl,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.xs,
    paddingVertical: Spacing.xs,
    shadowColor: Colors.mint,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  inputRowOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 1,
    borderBottomColor: Colors.mintPale,
  },
  input: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: '600',
    color: Colors.textDark,
    paddingVertical: Spacing.sm,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: Radii.md,
    backgroundColor: Colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnBusy: {
    opacity: 0.6,
  },
  addBtnPlus: {
    color: Colors.white,
    fontSize: 24,
    fontWeight: '300',
    lineHeight: 28,
    includeFontPadding: false,
  },
  suggestions: {
    backgroundColor: Colors.white,
    borderBottomLeftRadius: Radii.xl,
    borderBottomRightRadius: Radii.xl,
    shadowColor: Colors.mint,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  suggestTyped: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.mintPale,
  },
  suggestTypedIcon: {
    width: 30,
    height: 30,
    borderRadius: Radii.md,
    backgroundColor: Colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  suggestTypedPlus: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '300',
    lineHeight: 22,
    includeFontPadding: false,
  },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    backgroundColor: Colors.white,
  },
  suggestRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.mintBg,
  },
  suggestIconWrap: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  suggestName: {
    flex: 1,
    fontSize: FontSize.body - 1,
    fontWeight: '600',
    color: Colors.textDark,
  },
  suggestCategory: {
    fontSize: FontSize.label,
    fontWeight: '700',
    color: Colors.mintLight,
    flexShrink: 0,
  },
  suggestArrow: {
    fontSize: FontSize.small,
    color: Colors.mint,
    flexShrink: 0,
  },
  boldMatch: {
    fontWeight: '800',
    color: Colors.mint,
  },
});
