/**
 * Jest global setup — runs before the test framework installs.
 * Mocks native/runtime modules that are incompatible with the Jest/Node environment.
 */

// Mock expo's WinterCG runtime polyfills — they rely on native globals and
// dynamic require semantics that Jest CommonJS sandbox does not support.
jest.mock('expo/src/winter/ImportMetaRegistry', () => ({
  ImportMetaRegistry: { url: null },
}));
jest.mock('expo/src/winter', () => ({}));

// expo-font requires native font-loading capabilities.
jest.mock('expo-font', () => ({
  isLoaded: jest.fn(() => true),
  loadAsync: jest.fn().mockResolvedValue(undefined),
  useFonts: jest.fn(() => [true, null]),
}));

// react-native-worklets must be mocked before react-native-reanimated/mock
// is required, because Reanimated 4's mock.ts imports from ./index which
// transitively loads the native Worklets module.
jest.mock('react-native-worklets', () =>
  require('react-native-worklets/src/mock')
);

// react-native-reanimated — use the official RN mock.
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock')
);

// react-native-gesture-handler — mock Gesture API so that components using
// GestureDetector / Gesture.Pan() render without native initialisation.
// Individual test files override this mock to capture gesture callbacks.
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');

  function GestureDetector({ children }: { children: React.ReactNode }) {
    return children;
  }

  const pan = {
    activeOffsetX: function () { return pan; },
    failOffsetY: function () { return pan; },
    onUpdate: function () { return pan; },
    onEnd: function () { return pan; },
  };

  const Gesture = { Pan: () => pan };

  return { Gesture, GestureDetector };
});

// @gorhom/bottom-sheet — requires Reanimated + Gesture Handler.
jest.mock('@gorhom/bottom-sheet', () => {
  const RN = require('react-native');
  return {
    __esModule: true,
    default: RN.View,
    BottomSheetModal: RN.View,
    BottomSheetScrollView: RN.ScrollView,
    BottomSheetFlatList: RN.FlatList,
  };
});

// Prevent expo winter runtime from installing native polyfills that require
// dynamic import or lazy native module loading.
jest.mock('expo/src/winter/runtime.native', () => ({}));

// Prevent expo's web-streams polyfill from being loaded. It installs a
// ReadableStream implementation that conflicts with axios's fetch adapter in
// Node.js, causing "Cannot cancel a stream that already has a reader" crashes.
jest.mock('expo/virtual/streams', () => ({}));

// expo-crypto — delegate randomUUID() to Node's built-in crypto so DB helpers
// that generate local IDs work correctly in the Jest/Node environment.
jest.mock('expo-crypto', () => ({
  randomUUID: () => require('node:crypto').randomUUID(),
}));

// expo-haptics — no native haptic hardware in tests.
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy', Soft: 'soft', Rigid: 'rigid' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));
