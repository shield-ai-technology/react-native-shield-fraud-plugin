const path = require('path');
const pak = require('../package.json');

const source = path.join(__dirname, '..', pak.source);

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        extensions: ['.tsx', '.ts', '.js', '.json'],
        // Alias every variant name so App.tsx resolves after `yarn use-fraud` / `yarn use-full` / `yarn use-alpha`
        alias: {
          'react-native-shield-fraud-plugin': source,
          'react-native-shield-full-plugin': source,
          'react-native-shield-alpha-plugin': source,
        },
      },
    ],
  ],
};
