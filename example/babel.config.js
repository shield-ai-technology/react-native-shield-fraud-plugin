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
        // Alias both variant names so App.tsx resolves after `yarn use-fraud` / `yarn use-full`
        alias: {
          'react-native-shield-fraud-plugin': source,
          'react-native-shield-full-plugin': source,
        },
      },
    ],
  ],
};
