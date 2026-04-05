import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import KitchenOwlIcon from '@/components/KitchenOwlIcon';
import { useItemSuggestions } from '@/hooks/useItemSuggestions';
import { Colors, Spacing, Radii, FontSize } from '@/theme';
import type { ItemSuggestion } from '@/hooks/useItemSuggestions';

type AddItemBarProps = {
  onAdd: (name: string, description: string, iconKey: string | null, category: string) => void;
}

export default function AddItemBar({ onAdd }: AddItemBarProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<TextInput>(null);
  const suggestions = useItemSuggestions(value, 5);
  const showSuggestions = value.trim().length >= 2 && suggestions.length > 0;

  function commit(name: string, iconKey: string | null, category: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed, '', iconKey, category);
    setValue('');
    inputRef.current?.blur();
  }

  function handleAdd() {
    commit(value, null, 'Other');
  }

  function handleSuggestion(s: ItemSuggestion) {
    commit(s.displayName, s.iconKey, s.category);
  }

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
        <TouchableOpacity style={styles.addBtn} onPress={handleAdd} activeOpacity={0.85} testID="add-item-submit">
          {value.trim() ? (
            <Text style={styles.addBtnPlus}>+</Text>
          ) : (
            <Text style={styles.addBtnCamera}>📷</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Suggestions */}
      {showSuggestions && (
        <View style={styles.suggestions}>
          {/* Add-as-typed row */}
          <TouchableOpacity
            style={styles.suggestTyped}
            onPress={handleAdd}
            activeOpacity={0.8}
          >
            <View style={styles.suggestTypedIcon}>
              <Text style={styles.suggestTypedPlus}>+</Text>
            </View>
            <Text style={styles.suggestName} numberOfLines={1}>{value.trim()}</Text>
            <Text style={styles.suggestArrow}>→</Text>
          </TouchableOpacity>

          {suggestions.map((s, i) => (
            <TouchableOpacity
              key={s.key}
              style={[
                styles.suggestRow,
                i < suggestions.length - 1 && styles.suggestRowBorder,
              ]}
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
  if (idx === -1) return <>{name}</>;
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
    shadowOpacity: 0.10,
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
  addBtnPlus: {
    color: Colors.white,
    fontSize: 24,
    fontWeight: '300',
    lineHeight: 28,
    includeFontPadding: false,
  },
  addBtnCamera: {
    fontSize: 18,
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
