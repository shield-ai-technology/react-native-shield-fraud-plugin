const path = require('path');
const pak = require('../package.json');

module.exports = {
  dependencies: {
    [pak.name]: {
      root: path.join(__dirname, '..'),
      // The repo root holds one podspec per variant and its folder name matches
      // none of them, so the CLI would fall back to the first alphabetically.
      platforms: {
        ios: {
          podspecPath: path.join(__dirname, '..', `${pak.name}.podspec`),
        },
      },
    },
  },
};
