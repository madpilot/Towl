import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  TextInput,
} from 'react-native';
import Sheet from '@/components/Sheet';
import IconPicker from '@/components/IconPicker';
import KitchenOwlIcon from '@/components/KitchenOwlIcon';
import BottomNav from '@/components/BottomNav';
import { Card, Sep, PrimaryBtn } from '@/components/settings';
import { useAuthStore } from '@/store/authStore';
import { Colors, Spacing, Radii, FontSize } from '@/theme';
import type { HouseholdItemsScreenProps } from '@/navigation/types';
import type { HouseholdItem, HouseholdCategory } from '@/api/households';

// ─── Types ────────────────────────────────────────────────────────────────────

type SheetMode = 'new' | 'edit' | 'pick-category' | null;
type ActionKind = 'create' | 'update' | 'delete' | null;
type ItemSection = { title: string; data: HouseholdItem[] };

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('');

// Row heights must match the StyleSheet values below so getItemLayout is accurate.
const ITEM_HEIGHT = 50;    // paddingVertical 14×2 + icon/text content ~22px
const HEADER_HEIGHT = 34;  // paddingTop 12 + text ~18 + paddingBottom 4
const SEP_HEIGHT = 1;      // Sep component

// ─── Helpers ──────────────────────────────────────────────────────────────────

const buildSections = (items: HouseholdItem[]): ItemSection[] => {
  const map = new Map<string, HouseholdItem[]>();
  for (const item of items) {
    const letter = item.name.charAt(0).toUpperCase();
    const key = /[A-Z]/.test(letter) ? letter : '#';
    const bucket = map.get(key) ?? [];
    bucket.push(item);
    map.set(key, bucket);
  }
  return [...map.entries()]
    .sort(([a], [b]) => {
      if (a === '#') return 1;
      if (b === '#') return -1;
      return a.localeCompare(b);
    })
    .map(([title, data]) => ({ title, data }));
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HouseholdItemsScreen({ navigation, route }: HouseholdItemsScreenProps) {
  const { householdId, householdName } = route.params;
  const { householdsApi } = useAuthStore();

  // ── Data ───────────────────────────────────────────────────────────────────

  const [items, setItems] = useState<HouseholdItem[]>([]);
  const [categories, setCategories] = useState<HouseholdCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  // ── Sheet state ────────────────────────────────────────────────────────────

  const [sheet, setSheet] = useState<SheetMode>(null);
  const [editingItem, setEditingItem] = useState<HouseholdItem | null>(null);
  const [name, setName] = useState('');
  const [iconKey, setIconKey] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<HouseholdCategory | null>(null);
  const [iconPickerVisible, setIconPickerVisible] = useState(false);
  const [action, setAction] = useState<ActionKind>(null);
  const saving = action !== null;

  // Direction to return to after category / icon picker closes
  const backMode: 'new' | 'edit' = editingItem ? 'edit' : 'new';

  // SectionList infers ItemSection from the sections prop — no explicit generic needed on the ref
  const sectionListRef = useRef<SectionList>(null);

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!householdsApi) return;
    try {
      const [fetchedItems, fetchedCategories] = await Promise.all([
        householdsApi.getHouseholdItems(householdId),
        householdsApi.getCategories(householdId),
      ]);
      setItems(fetchedItems.slice().sort((a, b) => a.name.localeCompare(b.name)));
      setCategories(fetchedCategories.slice().sort((a, b) => a.ordering - b.ordering));
    } catch {
      Alert.alert('Error', 'Could not load items. Check your connection.');
    }
  }, [householdsApi, householdId]);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  // ── Derived: filtered + sectioned ─────────────────────────────────────────

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, query]);

  const sections = useMemo(() => buildSections(filteredItems), [filteredItems]);

  // ── Sheet helpers ──────────────────────────────────────────────────────────

  function openNew() {
    setEditingItem(null);
    setName('');
    setIconKey(null);
    setSelectedCategory(null);
    setIconPickerVisible(false);
    setSheet('new');
  }

  function openEdit(item: HouseholdItem) {
    setEditingItem(item);
    setName(item.name);
    setIconKey(item.icon ?? null);
    setSelectedCategory(item.category ?? null);
    setIconPickerVisible(false);
    setSheet('edit');
  }

  function closeSheet() {
    setSheet(null);
    setIconPickerVisible(false);
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!name.trim() || !householdsApi) return;
    setAction('create');
    try {
      const cat = selectedCategory
        ? { id: selectedCategory.id, name: selectedCategory.name, ordering: selectedCategory.ordering }
        : null;
      const created = await householdsApi.createHouseholdItem(householdId, name.trim(), iconKey, cat);
      setItems((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      closeSheet();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create item.');
    } finally {
      setAction(null);
    }
  }

  async function handleUpdate() {
    if (!name.trim() || !editingItem || !householdsApi) return;
    setAction('update');
    try {
      const cat = selectedCategory
        ? { id: selectedCategory.id, name: selectedCategory.name, ordering: selectedCategory.ordering }
        : null;
      await householdsApi.updateHouseholdItem(editingItem.id, name.trim(), iconKey, cat);
      setItems((prev) =>
        prev
          .map((i) =>
            i.id === editingItem.id
              ? { ...i, name: name.trim(), icon: iconKey, category: selectedCategory ?? undefined }
              : i
          )
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      closeSheet();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update item.');
    } finally {
      setAction(null);
    }
  }

  async function handleDelete() {
    if (!editingItem || !householdsApi) return;
    setAction('delete');
    try {
      await householdsApi.deleteHouseholdItem(editingItem.id);
      setItems((prev) => prev.filter((i) => i.id !== editingItem.id));
      closeSheet();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to delete item.');
    } finally {
      setAction(null);
    }
  }

  // ── getItemLayout ──────────────────────────────────────────────────────────
  // Provides pre-computed item positions so scrollToLocation works for offscreen
  // items without throwing the "scrollToIndex without getItemLayout" invariant.

  const getItemLayout = useCallback(
    (_data: unknown, index: number): { length: number; offset: number; index: number } => {
      let offset = 0;
      let flatIndex = 0;

      for (const section of sections) {
        // Section header occupies one flat index
        if (flatIndex === index) {
          return { length: HEADER_HEIGHT, offset, index };
        }
        offset += HEADER_HEIGHT;
        flatIndex++;

        // Data items
        for (let i = 0; i < section.data.length; i++) {
          // Separator is rendered between items, not after the last one
          const len = ITEM_HEIGHT + (i < section.data.length - 1 ? SEP_HEIGHT : 0);
          if (flatIndex === index) {
            return { length: len, offset, index };
          }
          offset += len;
          flatIndex++;
        }
      }

      return { length: ITEM_HEIGHT, offset, index };
    },
    [sections]
  );

  // ── Alphabet scrubber ──────────────────────────────────────────────────────

  function scrollToLetter(letter: string) {
    const sectionIndex = sections.findIndex((s) => s.title === letter);
    if (sectionIndex === -1 || !sectionListRef.current) return;
    sectionListRef.current.scrollToLocation({
      sectionIndex,
      itemIndex: 0,
      animated: false,
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{householdName} — Items</Text>
        <TouchableOpacity onPress={openNew} style={styles.addBtn}>
          <Text style={styles.addLabel}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search items…"
          placeholderTextColor={Colors.textFaded}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      {/* List + alphabet scrubber */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.mint} />
        </View>
      ) : (
        <View style={styles.listWrap}>
          <SectionList
            ref={sectionListRef}
            sections={sections}
            keyExtractor={(item: HouseholdItem) => String(item.id)}
            getItemLayout={getItemLayout}
            onScrollToIndexFailed={() => { /* getItemLayout prevents this; no-op fallback */ }}
            renderItem={({ item }: { item: HouseholdItem }) => (
              <TouchableOpacity
                style={styles.itemRow}
                onPress={() => openEdit(item)}
                activeOpacity={0.7}
              >
                <View style={styles.iconWrap}>
                  {item.icon ? (
                    <KitchenOwlIcon iconKey={item.icon} size={22} style={{ color: Colors.mint }} />
                  ) : (
                    <View style={styles.iconPlaceholder} />
                  )}
                </View>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                {item.category ? (
                  <Text style={styles.itemCategory} numberOfLines={1}>{item.category.name}</Text>
                ) : null}
                <Text style={styles.itemChevron}>›</Text>
              </TouchableOpacity>
            )}
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{section.title}</Text>
              </View>
            )}
            ItemSeparatorComponent={() => <Sep />}
            stickySectionHeadersEnabled={false}
            contentContainerStyle={filteredItems.length === 0 ? styles.emptyContainer : styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyRow}>
                <Text style={styles.emptyText}>
                  {query
                    ? 'No items match your search.'
                    : 'No items yet. Tap "+ New" to add one.'}
                </Text>
              </View>
            }
          />

          {/* Alphabet scrubber — hidden during search */}
          {!query && sections.length > 0 && (
            <View style={styles.alphaSidebar} pointerEvents="box-none">
              {ALPHABET.map((letter) => {
                const active = sections.some((s) => s.title === letter);
                return (
                  <TouchableOpacity
                    key={letter}
                    onPress={() => scrollToLetter(letter)}
                    disabled={!active}
                    hitSlop={4}
                  >
                    <Text style={[styles.alphaLetter, !active && styles.alphaLetterInactive]}>
                      {letter}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}

      <BottomNav active="settings" />

      {/* Create / Edit sheet */}
      <Sheet
        visible={sheet === 'new' || sheet === 'edit'}
        title={sheet === 'new' ? 'New item' : 'Edit item'}
        onClose={closeSheet}
      >
        {/* Icon button + name input inline */}
        <View style={styles.nameRow}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setIconPickerVisible(true)}
            activeOpacity={0.7}
          >
            <KitchenOwlIcon iconKey={iconKey} size={24} style={{ color: Colors.mint }} />
            <View style={styles.chevronBadge}>
              <Text style={styles.chevronText}>▾</Text>
            </View>
          </TouchableOpacity>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="Item name"
            placeholderTextColor={Colors.textFaded}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
          />
        </View>

        {/* Category row */}
        <TouchableOpacity
          style={styles.categoryRow}
          onPress={() => setSheet('pick-category')}
          activeOpacity={0.7}
        >
          <Text style={styles.categoryLabel}>Category</Text>
          <Text style={[styles.categoryValue, !selectedCategory && styles.categoryNone]}>
            {selectedCategory ? selectedCategory.name : 'None'}
          </Text>
          <Text style={styles.categoryChevron}>›</Text>
        </TouchableOpacity>

        {/* Primary action */}
        {sheet === 'new' ? (
          <PrimaryBtn
            label="Add item"
            onPress={handleCreate}
            loading={action === 'create'}
            disabled={saving}
          />
        ) : (
          <PrimaryBtn
            label="Save changes"
            onPress={handleUpdate}
            loading={action === 'update'}
            disabled={saving}
          />
        )}

        {/* Danger zone — edit only */}
        {sheet === 'edit' && (
          <>
            <View style={styles.dangerDivider}>
              <Text style={styles.dangerDividerLabel}>Danger zone</Text>
            </View>
            <PrimaryBtn
              label="Delete item"
              onPress={handleDelete}
              loading={action === 'delete'}
              disabled={saving}
              danger
            />
          </>
        )}

        <View style={{ height: Spacing.xl }} />

        {/* Icon picker rendered inside the sheet modal so it stacks correctly */}
        <IconPicker
          visible={iconPickerVisible}
          selected={iconKey}
          onSelect={(key) => setIconKey(key)}
          onClose={() => setIconPickerVisible(false)}
        />
      </Sheet>

      {/* Category picker sheet */}
      <Sheet
        visible={sheet === 'pick-category'}
        title="Choose category"
        onClose={() => setSheet(backMode)}
      >
        <Card>
          <TouchableOpacity
            style={styles.catPickRow}
            onPress={() => { setSelectedCategory(null); setSheet(backMode); }}
            activeOpacity={0.7}
          >
            <Text style={[styles.catPickName, !selectedCategory && styles.catPickSelected]}>None</Text>
            {!selectedCategory && <Text style={styles.catTick}>✓</Text>}
          </TouchableOpacity>
          {categories.map((cat, idx) => (
            <View key={cat.id}>
              {idx === 0 && <Sep />}
              <TouchableOpacity
                style={styles.catPickRow}
                onPress={() => { setSelectedCategory(cat); setSheet(backMode); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.catPickName, selectedCategory?.id === cat.id && styles.catPickSelected]}>
                  {cat.name}
                </Text>
                {selectedCategory?.id === cat.id && <Text style={styles.catTick}>✓</Text>}
              </TouchableOpacity>
              {idx < categories.length - 1 && <Sep />}
            </View>
          ))}
        </Card>
        <View style={{ height: Spacing.xl }} />
      </Sheet>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.mintBg },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  backBtn: { paddingRight: Spacing.sm },
  backChevron: { fontSize: 28, color: Colors.mint, fontWeight: '300', lineHeight: 32 },
  title: {
    flex: 1,
    fontSize: FontSize.heading + 2,
    fontWeight: '900',
    color: Colors.textDark,
    letterSpacing: -0.3,
  },
  addBtn: { paddingLeft: Spacing.sm },
  addLabel: { fontSize: FontSize.body, fontWeight: '700', color: Colors.mintLight },

  // Search
  searchWrap: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  searchInput: {
    height: 40,
    borderRadius: Radii.lg,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.body,
    color: Colors.textDark,
    borderWidth: 1.5,
    borderColor: Colors.mintPale,
  },

  // List
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listWrap: { flex: 1 },
  listContent: { paddingBottom: 100 },
  emptyContainer: { flex: 1, paddingBottom: 100 },
  emptyRow: { padding: Spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: FontSize.body, color: Colors.textFaded, textAlign: 'center' },

  // Section header
  sectionHeader: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
    backgroundColor: Colors.mintBg,
  },
  sectionHeaderText: {
    fontSize: FontSize.small,
    fontWeight: '800',
    color: Colors.textFaded,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Item rows
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md + 2,
    backgroundColor: Colors.white,
  },
  iconWrap: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  iconPlaceholder: {
    width: 22,
    height: 22,
    borderRadius: Radii.sm,
    backgroundColor: Colors.mintPale,
  },
  itemName: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.textDark,
  },
  itemCategory: {
    fontSize: FontSize.small,
    color: Colors.textFaded,
    marginRight: Spacing.sm,
    maxWidth: 120,
  },
  itemChevron: { fontSize: 20, color: Colors.mintPale, fontWeight: '700' },

  // Alphabet scrubber
  alphaSidebar: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 1,
  },
  alphaLetter: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.mint,
    lineHeight: 14,
    textAlign: 'center',
    minWidth: 16,
  },
  alphaLetterInactive: { color: Colors.mintPale },

  // Sheet — icon + name row
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.md,
  },
  iconBtn: {
    width: 44,
    height: 44,
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
    width: 14,
    height: 14,
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
  nameInput: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: '600',
    color: Colors.textDark,
    borderWidth: 1.5,
    borderColor: Colors.mintPale,
    borderRadius: Radii.md,
    padding: Spacing.md,
    backgroundColor: Colors.mintBg,
  },

  // Sheet — category row
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.mintPale,
    marginBottom: Spacing.sm,
  },
  categoryLabel: {
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.textFaded,
    marginRight: Spacing.md,
  },
  categoryValue: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: '600',
    color: Colors.textDark,
  },
  categoryNone: { color: Colors.textFaded },
  categoryChevron: { fontSize: 20, color: Colors.mintPale, fontWeight: '700' },

  // Sheet — danger zone
  dangerDivider: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.mintPale,
    paddingTop: Spacing.md,
  },
  dangerDividerLabel: {
    fontSize: FontSize.small,
    fontWeight: '800',
    color: Colors.textFaded,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Category picker sheet
  catPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md + 2,
  },
  catPickName: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.textDark,
  },
  catPickSelected: { color: Colors.mint },
  catTick: { fontSize: FontSize.body, color: Colors.mint, fontWeight: '700' },
});
