import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SectionLabel, Card, Sep, Row, Field, PrimaryBtn, SecondaryBtn } from '@/components/settings';

describe('SectionLabel', () => {
  it('renders label text in uppercase', () => {
    render(<SectionLabel label="profile" />);
    expect(screen.getByText('PROFILE')).toBeTruthy();
  });
});

describe('Card', () => {
  it('renders children', () => {
    render(<Card><Row label="Test row" /></Card>);
    expect(screen.getByText('Test row')).toBeTruthy();
  });
});

describe('Sep', () => {
  it('renders without error', () => {
    const { toJSON } = render(<Sep />);
    expect(toJSON()).toBeTruthy();
  });
});

describe('Row', () => {
  it('renders label', () => {
    render(<Row label="Name" />);
    expect(screen.getByText('Name')).toBeTruthy();
  });

  it('renders sub text when provided', () => {
    render(<Row label="Name" sub="John Doe" />);
    expect(screen.getByText('John Doe')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    render(<Row label="Name" onPress={onPress} />);
    fireEvent.press(screen.getByText('Name'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows chevron by default', () => {
    const { toJSON } = render(<Row label="Name" />);
    const json = JSON.stringify(toJSON());
    expect(json).toContain('›');
  });

  it('hides chevron when showChevron is false', () => {
    const { toJSON } = render(<Row label="Name" showChevron={false} />);
    const json = JSON.stringify(toJSON());
    expect(json).not.toContain('›');
  });
});

describe('Field', () => {
  it('renders label and current value', () => {
    render(<Field label="Email" value="test@example.com" onChangeText={jest.fn()} />);
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByDisplayValue('test@example.com')).toBeTruthy();
  });

  it('calls onChangeText when input changes', () => {
    const onChangeText = jest.fn();
    render(<Field label="Email" value="" onChangeText={onChangeText} placeholder="you@example.com" />);
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'new@example.com');
    expect(onChangeText).toHaveBeenCalledWith('new@example.com');
  });
});

describe('PrimaryBtn', () => {
  it('renders label and calls onPress', () => {
    const onPress = jest.fn();
    render(<PrimaryBtn label="Save" onPress={onPress} />);
    fireEvent.press(screen.getByText('Save'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows ActivityIndicator when loading', () => {
    render(<PrimaryBtn label="Save" onPress={jest.fn()} loading />);
    expect(screen.queryByText('Save')).toBeNull();
  });
});

describe('SecondaryBtn', () => {
  it('renders label and calls onPress', () => {
    const onPress = jest.fn();
    render(<SecondaryBtn label="Cancel" onPress={onPress} />);
    fireEvent.press(screen.getByText('Cancel'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
