// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock react-native-dotenv @env module
jest.mock('@env', () => ({
  TMDB_API_KEY: 'mock_tmdb_api_key_for_testing',
}), { virtual: true });

// Mock react-native-vector-icons
jest.mock('react-native-vector-icons/Ionicons', () => {
  const React = require('react');
  return class Ionicons extends React.Component {
    render() {
      return React.createElement('Text', this.props, this.props.children);
    }
  };
});

// Mock react-native Voice module
jest.mock('@react-native-voice/voice', () => ({
  Voice: {
    onSpeechStart: jest.fn(),
    onSpeechRecognized: jest.fn(),
    onSpeechEnd: jest.fn(),
    onSpeechError: jest.fn(),
    onSpeechResults: jest.fn(),
    onSpeechPartialResults: jest.fn(),
    onSpeechVolumeChanged: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    cancel: jest.fn(),
    destroy: jest.fn(),
    isAvailable: jest.fn(),
    isStarted: jest.fn(),
  },
}));

// Mock react-native-webview
jest.mock('react-native-webview', () => {
  const React = require('react');
  return class WebView extends React.Component {
    render() {
      return React.createElement('View', this.props, this.props.children);
    }
  };
});

// Mock react-native-linear-gradient
jest.mock('react-native-linear-gradient', () => {
  const React = require('react');
  return class LinearGradient extends React.Component {
    render() {
      return React.createElement('View', this.props, this.props.children);
    }
  };
});

// Mock AppState and BackHandler APIs
jest.mock('react-native', () => {
  const reactNative = jest.requireActual('react-native');
  // Avoid mutations that fail under native getter locks
  Object.defineProperty(reactNative, 'AppState', {
    value: {
      addEventListener: jest.fn(() => ({
        remove: jest.fn(),
      })),
      removeEventListener: jest.fn(),
      currentState: 'active',
    },
    writable: true,
  });
  Object.defineProperty(reactNative, 'BackHandler', {
    value: {
      addEventListener: jest.fn(() => ({
        remove: jest.fn(),
      })),
      removeEventListener: jest.fn(),
      exitApp: jest.fn(),
    },
    writable: true,
  });
  return reactNative;
});


