import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useItemSuggestions } from '@/hooks/useItemSuggestions';

export type AddItemSheetHandle = {
  focus: () => void;
};

type AddItemSheetProps = {
  visible: boolean;
  onClose: () => void;
  onAdd: (name: string, description: string) => Promise<void>;
};

const AddItemSheet = forwardRef<AddItemSheetHandle, AddItemSheetProps>(
  function AddItemSheet({ visible, onClose, onAdd }, ref) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [adding, setAdding] = useState(false);

    const nameInputRef = useRef<TextInput>(null);
    const suggestions = useItemSuggestions(name);

    useImperativeHandle(ref, () => ({
      focus: () => nameInputRef.current?.focus(),
    }));

    const handleAdd = useCallback(async () => {
      const trimmedName = name.trim();
      if (!trimmedName) return;
      setAdding(true);
      try {
        await onAdd(trimmedName, description.trim());
        setName('');
        setDescription('');
        onClose();
      } catch {
        // Error handling delegated to parent
      } finally {
        setAdding(false);
      }
    }, [name, description, onAdd, onClose]);

    const handleClose = useCallback(() => {
      setName('');
      setDescription('');
      onClose();
    }, [onClose]);

    const handleSuggestionPress = useCallback((displayName: string) => {
      setName(displayName);
    }, []);

    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={handleClose}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={styles.backdrop} onPress={handleClose} activeOpacity={1} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.title}>Add Item</Text>

            <TextInput
              ref={nameInputRef}
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Item name (e.g. Milk)"
              autoFocus
              returnKeyType="next"
              editable={!adding}
              testID="item-name-input"
            />

            {suggestions.length > 0 && (
              <View style={styles.suggestions}>
                {suggestions.map((s) => (
                  <TouchableOpacity
                    key={s.key}
                    style={styles.suggestionChip}
                    onPress={() => handleSuggestionPress(s.displayName)}
                  >
                    <Text style={styles.suggestionLabel}>{s.displayName}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="Note (optional)"
              returnKeyType="done"
              onSubmitEditing={handleAdd}
              editable={!adding}
              testID="item-desc-input"
            />

            <TouchableOpacity
              style={[styles.addButton, (!name.trim() || adding) ? styles.addButtonDisabled : undefined]}
              onPress={handleAdd}
              disabled={!name.trim() || adding}
              activeOpacity={0.8}
              testID="add-item-button"
            >
              {adding
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.addButtonText}>Add to List</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }
);

export default AddItemSheet;

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    gap: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ddd',
    marginBottom: 8,
  },
  title: { fontSize: 18, fontWeight: '600', color: '#1a1a1a', marginBottom: 4 },
  input: {
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#1a1a1a',
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0f4ff',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  suggestionLabel: { fontSize: 13, color: '#2563eb' },
  addButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  addButtonDisabled: { opacity: 0.45 },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
