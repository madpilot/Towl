import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';

jest.mock('@/store/householdDetailStore');
jest.mock('@/store/listDetailStore', () => ({ useListDetailStore: { getState: jest.fn(() => ({ syncLists: jest.fn() })) } }));
jest.mock('@/components/Sheet', () => {
  const { View } = require('react-native');
  function Sheet({ visible, children }: { visible: boolean; children: React.ReactNode }) {
    return visible ? <View>{children}</View> : null;
  }
  return Sheet;
});

import { MembersSection } from '@/screens/settings/MembersSection';
import { useMembersSection } from '@/store/householdDetailStore';

const mockInviteMember = jest.fn();
const mockRemoveMember = jest.fn();

function mockHook(overrides: Record<string, unknown> = {}) {
  (useMembersSection as jest.Mock).mockReturnValue({
    members: [],
    inviteMember: mockInviteMember,
    removeMember: mockRemoveMember,
    ...overrides,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHook();
});

describe('MembersSection', () => {
  it('shows empty state when there are no members', () => {
    render(<MembersSection />);
    expect(screen.getByText('Members not yet available')).toBeTruthy();
  });

  it('renders member names', () => {
    mockHook({
      members: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ],
    });
    render(<MembersSection />);
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('opens invite sheet when invite button is pressed', () => {
    render(<MembersSection />);
    fireEvent.press(screen.getByText('+ Invite member'));
    expect(screen.getByText('Send invite')).toBeTruthy();
  });

  it('calls inviteMember when invite is confirmed', async () => {
    mockInviteMember.mockResolvedValue(undefined);
    render(<MembersSection />);
    fireEvent.press(screen.getByText('+ Invite member'));
    fireEvent.changeText(screen.getByPlaceholderText('username'), 'alice');
    await act(async () => {
      fireEvent.press(screen.getByText('Send invite'));
    });
    expect(mockInviteMember).toHaveBeenCalledWith('alice');
  });

  it('opens remove sheet when ✕ is pressed', () => {
    mockHook({ members: [{ id: 1, name: 'Alice' }] });
    render(<MembersSection />);
    fireEvent.press(screen.getByText('✕'));
    expect(screen.getByText('Remove member')).toBeTruthy();
  });

  it('calls removeMember when removal is confirmed', async () => {
    mockRemoveMember.mockResolvedValue(undefined);
    mockHook({ members: [{ id: 1, name: 'Alice' }] });
    render(<MembersSection />);
    fireEvent.press(screen.getByText('✕'));
    await act(async () => {
      fireEvent.press(screen.getByText('Remove member'));
    });
    expect(mockRemoveMember).toHaveBeenCalledWith(1);
  });
});
