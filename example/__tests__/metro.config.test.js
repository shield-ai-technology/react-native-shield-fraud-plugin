const path = require('path');

const metroConfig = require('../metro.config');

describe('Metro peer dependency resolution', () => {
  it('blocks the repository React Native copy from the example bundle', () => {
    const repositoryReactNativeFile = path.resolve(
      __dirname,
      '../../node_modules/react-native/index.js'
    );

    expect(metroConfig.resolver.blockList.test(repositoryReactNativeFile)).toBe(
      true
    );
  });
});
