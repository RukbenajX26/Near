/* eslint-env jest */

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  default: {setString: jest.fn()},
}));

jest.mock('@react-native-community/datetimepicker', () => () => null);
jest.mock('@react-native-community/blur', () => {
  const mockReact = require('react');
  const {View: MockView} = require('react-native');
  return {BlurView: props => mockReact.createElement(MockView, props)};
});
jest.mock('react-native-fs', () => ({
  __esModule: true,
  default: {
    DocumentDirectoryPath: '/tmp',
    exists: jest.fn(() => Promise.resolve(true)),
    mkdir: jest.fn(() => Promise.resolve()),
    readFile: jest.fn(() => Promise.resolve('')), 
    writeFile: jest.fn(() => Promise.resolve()),
  },
}));
jest.mock('@react-native-documents/picker', () => ({
  errorCodes: {OPERATION_CANCELED: 'OPERATION_CANCELED'},
  isErrorWithCode: () => false,
  keepLocalCopy: jest.fn(),
  pick: jest.fn(),
  pickDirectory: jest.fn(),
  saveDocuments: jest.fn(),
  types: {allFiles: '*/*'},
}));

jest.mock('react-native-svg', () => {
  const mockReact = require('react');
  const {View: MockView} = require('react-native');
  const Svg = props => mockReact.createElement(MockView, props);
  return {
    __esModule: true,
    default: Svg,
    Circle: Svg,
    Defs: Svg,
    G: Svg,
    Line: Svg,
    LinearGradient: Svg,
    Path: Svg,
    Stop: Svg,
  };
});
