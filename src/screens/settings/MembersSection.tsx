import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import Sheet from '@/components/Sheet';
import { SectionLabel, Card, Sep, Field, PrimaryBtn, SecondaryBtn } from '@/components/settings';
import { useHouseholdDetailStore } from '@/store/householdDetailStore';
import { Colors, Spacing, FontSize } from '@/theme';

export function MembersSection() {
  const members = useHouseholdDetailStore((s) => s.members);
  const inviteMember = useHouseholdDetailStore((s) => s.inviteMember);
  const removeMember = useHouseholdDetailStore((s) => s.removeMember);

  const [modal, setModal] = useState<'invite' | 'remove' | null>(null);
  const [inviteUsername, setInviteUsername] = useState('');
  const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);
  const [removingMemberName, setRemovingMemberName] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleInvite() {
    if (!inviteUsername.trim()) return;
    setSaving(true);
    try {
      await inviteMember(inviteUsername.trim());
      setInviteUsername('');
      setModal(null);
    } catch (e: unknown) {
      Alert.alert('Not yet available', e instanceof Error ? e.message : 'Failed to invite member.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (removingMemberId === null) return;
    setSaving(true);
    try {
      await removeMember(removingMemberId);
      setModal(null);
    } catch (e: unknown) {
      Alert.alert('Not yet available', e instanceof Error ? e.message : 'Failed to remove member.');
    } finally {
      setSaving(false);
    }
  }

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
                <TouchableOpacity
                  onPress={() => { setRemovingMemberId(m.id); setRemovingMemberName(m.name); setModal('remove'); }}
                  hitSlop={8}
                >
                  <Text style={styles.removeBtn}>✕</Text>
                </TouchableOpacity>
              </View>
              {i < members.length - 1 && <Sep />}
            </View>
          ))
        )}
        <Sep />
        <TouchableOpacity
          style={styles.addRow}
          onPress={() => { setInviteUsername(''); setModal('invite'); }}
          activeOpacity={0.7}
        >
          <Text style={styles.addLabel}>+ Invite member</Text>
        </TouchableOpacity>
      </Card>

      <Sheet visible={modal === 'invite'} title="Invite member" onClose={() => setModal(null)}>
        <Field
          label="KitchenOwl username"
          value={inviteUsername}
          onChangeText={setInviteUsername}
          placeholder="username"
        />
        <PrimaryBtn label="Send invite" onPress={handleInvite} loading={saving} />
        <SecondaryBtn label="Cancel" onPress={() => setModal(null)} />
        <View style={{ height: Spacing.xl }} />
      </Sheet>

      <Sheet visible={modal === 'remove'} title={`Remove ${removingMemberName}`} onClose={() => setModal(null)}>
        <View style={styles.sheetBody}>
          <Text style={styles.sheetBodyText}>
            {removingMemberName} will lose access to this household.
          </Text>
        </View>
        <PrimaryBtn label="Remove member" onPress={handleRemove} loading={saving} danger />
        <SecondaryBtn label="Cancel" onPress={() => setModal(null)} />
        <View style={{ height: Spacing.xl }} />
      </Sheet>
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
  sheetBody: { padding: Spacing.xl, paddingBottom: Spacing.sm },
  sheetBodyText: { fontSize: FontSize.body, color: Colors.textFaded, lineHeight: 22 },
});
