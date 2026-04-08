import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { MembersSection } from '@/screens/settings/MembersSection';
import type { HouseholdMember } from '@/api/households';

const members: HouseholdMember[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
];

describe('MembersSection', () => {
  it('shows empty state when there are no members', () => {
    render(<MembersSection members={[]} onInvite={jest.fn()} onRemove={jest.fn()} />);
    expect(screen.getByText('Members not yet available')).toBeTruthy();
  });

  it('renders member names', () => {
    render(<MembersSection members={members} onInvite={jest.fn()} onRemove={jest.fn()} />);
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('calls onInvite when invite button is pressed', () => {
    const onInvite = jest.fn();
    render(<MembersSection members={[]} onInvite={onInvite} onRemove={jest.fn()} />);
    fireEvent.press(screen.getByText('+ Invite member'));
    expect(onInvite).toHaveBeenCalledTimes(1);
  });

  it('calls onRemove with the correct member when ✕ is pressed', () => {
    const onRemove = jest.fn();
    render(<MembersSection members={members} onInvite={jest.fn()} onRemove={onRemove} />);
    const removeBtns = screen.getAllByText('✕');
    fireEvent.press(removeBtns[0]);
    expect(onRemove).toHaveBeenCalledWith(members[0]);
  });
});
