const {
  createRunArgs,
  configPath,
  ensureAndroidEmulator,
  ensureIosSimulator,
  isMetroRunning,
  normalizeCommandOutput,
} = require('../update-and-run');

describe('portable device preparation', () => {
  test('loads shield configuration from the plugin root', () => {
    expect(configPath).toBe(require('path').join(__dirname, '..', '..', 'shield-config.json'));
  });

  test('normalizes commands with no output', () => {
    expect(normalizeCommandOutput(null)).toBe('');
  });

  test('reuses a booted iOS simulator and reports it opened', () => {
    const run = jest.fn((command, args) => {
      if (command === 'xcrun' && args[0] === '--find') return '/usr/bin/simctl';
      if (command === 'xcrun' && args.includes('list')) {
        return JSON.stringify({
          devices: {
            'com.apple.CoreSimulator.SimRuntime.iOS-18-0': [
              { name: 'iPhone 16', udid: 'BOOTED-UDID', state: 'Booted', isAvailable: true },
            ],
          },
        });
      }
      return '';
    });
    const log = jest.fn();

    const result = ensureIosSimulator({ run, log });

    expect(result).toEqual({ udid: 'BOOTED-UDID', name: 'iPhone 16' });
    expect(run).toHaveBeenCalledWith('open', ['-a', 'Simulator'], { stdio: 'ignore' });
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('iOS simulator booted and opened: iPhone 16')
    );
  });

  test('boots an available Android AVD and reports it opened', () => {
    const run = jest.fn((command, args) => {
      if (command === 'adb' && args[0] === 'devices') return 'List of devices attached\n';
      if (command === 'emulator' && args[0] === '-list-avds') return 'Pixel_API_35\n';
      return '';
    });
    const spawn = jest.fn(() => ({ unref: jest.fn() }));
    const waitForBoot = jest.fn();
    const log = jest.fn();

    const result = ensureAndroidEmulator({ run, spawn, waitForBoot, log });

    expect(result).toEqual({ serial: null, avd: 'Pixel_API_35' });
    expect(spawn).toHaveBeenCalledWith(
      'emulator',
      ['@Pixel_API_35'],
      expect.objectContaining({ detached: true, stdio: 'ignore' })
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('Android emulator booted and opened: Pixel_API_35')
    );
    expect(waitForBoot).toHaveBeenCalledWith({ run });
  });

  test('passes the dynamically selected iOS UDID to React Native', () => {
    expect(createRunArgs('ios', 'DISCOVERED-UDID')).toEqual([
      'react-native',
      'run-ios',
      '--udid',
      'DISCOVERED-UDID',
    ]);
  });
});

describe('Metro lifecycle', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('recognizes an already-running Metro server', async () => {
    const probe = jest.fn().mockResolvedValue('packager-status:running');

    await expect(isMetroRunning({ probe })).resolves.toBe(true);
  });
});
