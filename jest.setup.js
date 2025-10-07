// Jest setup file

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

// Mock Firebase
jest.mock('@react-native-firebase/app', () => ({
  default: jest.fn(),
}));

jest.mock('@react-native-firebase/firestore', () => ({
  default: jest.fn(() => ({
    collection: jest.fn(),
  })),
  FieldValue: {
    serverTimestamp: jest.fn(() => new Date()),
    increment: jest.fn((value) => value),
  },
}));

jest.mock('@react-native-firebase/auth', () => ({
  default: jest.fn(() => ({
    currentUser: { uid: 'test-uid' },
    signInAnonymously: jest.fn(() => Promise.resolve({ user: { uid: 'test-uid' } })),
    onAuthStateChanged: jest.fn(),
  })),
}));

jest.mock('@react-native-firebase/functions', () => ({
  default: jest.fn(() => ({
    httpsCallable: jest.fn(() => jest.fn()),
  })),
}));

// Mock Expo modules
jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
  cancelScheduledNotificationAsync: jest.fn(),
}));

// Suppress console warnings during tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};

