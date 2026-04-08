import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SectionLabel, Card, Sep } from '@/components/settings/SettingsUI';
import { Colors, Spacing, FontSize } from '@/theme';
import type { HouseholdMember } from '@/api/households';

type Props = {
  members: HouseholdMember[];
  onInvite: () => void;
  onRemove: (member: HouseholdMember) => void;
};

export function MembersSection({ members, onInvite, onRemove }: Props) {
  return (
    <>
      <SectionLabel label="Members" />
      <Card>
        {members.length === 0 ? (
          <View style={styles.emptyRow}>
            <Text style={styles.emptyText}>Members not yet available</Text>
          </View>
        ) : (
          members.map((m, i) => (
            <View key={m.id}>
              <View style={styles.memberRow}>
                <View style={styles.avatar}>
                  <Text style={styles.initial}>{m.name[0]?.toUpperCase() ?? '?'}</Text>
                </View>
                <Text style={styles.name}>{m.name}</Text>
                <TouchableOpacity onPress={() => onRemove(m)} hitSlop={8}>
                  <Text style={styles.removeBtn}>✕</Text>
                </TouchableOpacity>
              </View>
              {i < members.length - 1 && <Sep />}
            </View>
          ))
        )}
        <Sep />
        <TouchableOpacity style={styles.addRow} onPress={onInvite} activeOpacity={0.7}>
          <Text style={styles.addLabel}>+ Invite member</Text>
        </TouchableOpacity>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  emptyRow: { padding: Spacing.xl },
  emptyText: { fontSize: FontSize.body, color: Colors.textFaded },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.mintLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  initial: { color: Colors.white, fontWeight: '800', fontSize: FontSize.body },
  name: { flex: 1, fontSize: FontSize.body, fontWeight: '700', color: Colors.textDark },
  removeBtn: { fontSize: 14, color: Colors.textFaded, fontWeight: '700', padding: 4 },
  addRow: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md + 2 },
  addLabel: { fontSize: FontSize.body, fontWeight: '700', color: Colors.mint },
});
