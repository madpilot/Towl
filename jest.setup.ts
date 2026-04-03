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

// react-native-reanimated — use the official RN mock.
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock')
);

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
