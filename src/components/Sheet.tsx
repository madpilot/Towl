import React, { useEffect, useMemo } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, FontSize, Radii, Spacing } from '@/theme';

const SLIDE_DISTANCE = 600;
const OPEN_DURATION = 280;

type SheetProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

export default function Sheet({ visible, title, onClose, children }: SheetProps) {
  const backdropOpacity = useMemo(() => new Animated.Value(0), []);
  const sheetTranslateY = useMemo(() => new Animated.Value(SLIDE_DISTANCE), []);

  useEffect(() => {
    if (visible) {
      // Reset to hidden start state, then animate in
      backdropOpacity.setValue(0);
      sheetTranslateY.setValue(SLIDE_DISTANCE);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: OPEN_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: 0,
          duration: OPEN_DURATION,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset values so the next open starts clean
      backdropOpacity.setValue(0);
      sheetTranslateY.setValue(SLIDE_DISTANCE);
    }
  }, [visible, backdropOpacity, sheetTranslateY]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Backdrop fades in independently of the sheet */}
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        </Animated.View>

        {/* Sheet slides up independently */}
        <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: 'rgba(20,50,43,0.45)',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    paddingBottom: 32,
    maxHeight: '82%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.mintBg,
  },
  title: {
    flex: 1,
    fontSize: FontSize.heading,
    fontWeight: '800',
    color: Colors.textDark,
  },
  close: {
    fontSize: 16,
    color: Colors.mintLight,
    fontWeight: '700',
  },
});
