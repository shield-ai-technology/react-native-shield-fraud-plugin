const mockNativeModule = {
  addListener: jest.fn(),
  getLatestDeviceResult: jest.fn(),
  getSessionId: jest.fn(),
  initShield: jest.fn(),
  isShieldInitialized: jest.fn(),
  removeListeners: jest.fn(),
  sendAttributes: jest.fn(),
  sendAttributesWithCallback: jest.fn(),
  sendDeviceSignature: jest.fn(),
  setCrossPlatformParameters: jest.fn(),
  setDeviceResultStateListener: jest.fn(),
};

const mockAddListener = jest.fn();
const mockRemoveAllListeners = jest.fn();
let mockPlatformOS = 'android';
const fs = require('fs');
const path = require('path');

jest.mock('react-native', () => ({
  NativeEventEmitter: jest.fn().mockImplementation(() => ({
    addListener: mockAddListener,
    removeAllListeners: mockRemoveAllListeners,
  })),
  NativeModules: {
    ShieldFraudPlugin: mockNativeModule,
  },
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
  },
  TurboModuleRegistry: {
    get: jest.fn(() => mockNativeModule),
  },
}));

import ShieldFraud from '../index';

describe('ShieldFraud.isSDKready', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ShieldFraud as any).PlatformWrapper = mockNativeModule;
    (ShieldFraud as any).eventEmitter = {
      addListener: mockAddListener,
      removeAllListeners: mockRemoveAllListeners,
    };
    mockPlatformOS = 'android';
  });

  it('calls back with false on Android when the SDK is not initialized', async () => {
    const callback = jest.fn();
    const isShieldInitializedSpy = jest
      .spyOn(ShieldFraud, 'isShieldInitialized')
      .mockReturnValue(false);

    await ShieldFraud.isSDKready(callback);

    expect(isShieldInitializedSpy).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(false);
    expect(mockAddListener).not.toHaveBeenCalled();
    expect(
      mockNativeModule.setDeviceResultStateListener
    ).not.toHaveBeenCalled();

    isShieldInitializedSpy.mockRestore();
  });

  it('calls back with true on Android after the SDK is initialized', async () => {
    const callback = jest.fn();
    const isShieldInitializedSpy = jest
      .spyOn(ShieldFraud, 'isShieldInitialized')
      .mockReturnValue(true);

    await ShieldFraud.isSDKready(callback);

    expect(isShieldInitializedSpy).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(true);
    expect(mockAddListener).not.toHaveBeenCalled();
    expect(
      mockNativeModule.setDeviceResultStateListener
    ).not.toHaveBeenCalled();

    isShieldInitializedSpy.mockRestore();
  });

  it('removes existing success and error subscriptions before registering new callback listeners', async () => {
    const removeSuccessSubscription = jest.fn();
    const removeErrorSubscription = jest.fn();
    mockAddListener
      .mockReturnValueOnce({ remove: removeSuccessSubscription })
      .mockReturnValueOnce({ remove: removeErrorSubscription })
      .mockReturnValueOnce({ remove: jest.fn() })
      .mockReturnValueOnce({ remove: jest.fn() });

    await ShieldFraud.initShield(
      { siteID: 'site-id', secretKey: 'secret-key' },
      { onSuccess: jest.fn(), onFailure: jest.fn() }
    );
    await ShieldFraud.initShield(
      { siteID: 'site-id', secretKey: 'secret-key' },
      { onSuccess: jest.fn(), onFailure: jest.fn() }
    );

    expect(removeSuccessSubscription).toHaveBeenCalledTimes(1);
    expect(removeErrorSubscription).toHaveBeenCalledTimes(1);
    expect(mockAddListener).toHaveBeenCalledTimes(4);
  });

  it('exposes synchronous values for synchronous native state methods', () => {
    mockNativeModule.getSessionId.mockReturnValue('session-id');
    mockNativeModule.isShieldInitialized.mockReturnValue(true);

    const sessionId: string = ShieldFraud.getSessionId();
    const isInitialized: boolean = ShieldFraud.isShieldInitialized();

    expect(sessionId).toBe('session-id');
    expect(isInitialized).toBe(true);
  });

  it('starts the iOS readiness listener without a fixed JavaScript delay', async () => {
    mockPlatformOS = 'ios';
    const callback = jest.fn();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const isShieldInitializedSpy = jest
      .spyOn(ShieldFraud, 'isShieldInitialized')
      .mockReturnValue(true);

    await ShieldFraud.isSDKready(callback);

    expect(isShieldInitializedSpy).toHaveBeenCalledTimes(1);
    expect(mockAddListener).toHaveBeenCalledWith(
      'device_result_state',
      expect.any(Function)
    );
    expect(mockNativeModule.setDeviceResultStateListener).toHaveBeenCalledTimes(
      1
    );
    expect(setTimeoutSpy).not.toHaveBeenCalled();

    isShieldInitializedSpy.mockRestore();
    setTimeoutSpy.mockRestore();
  });
});

describe('Android ReactModuleInfo metadata', () => {
  it('does not advertise constants when the native module exports none', () => {
    const packageSource = fs.readFileSync(
      path.join(
        __dirname,
        '../../android/src/main/java/com/shieldfraudplugin/ShieldFraudPluginPackage.java'
      ),
      'utf8'
    );

    expect(packageSource).toContain(
      'false,                          // hasConstants'
    );
  });
});

describe('Android SDK migration comments', () => {
  it('does not claim mapped SDK values were removed', () => {
    const moduleSource = fs.readFileSync(
      path.join(
        __dirname,
        '../../android/src/main/java/com/shieldfraudplugin/ShieldFraudPluginModule.java'
      ),
      'utf8'
    );

    expect(moduleSource).not.toContain('VERBOSE removed');
    expect(moduleSource).not.toContain('STAGING removed');
  });
});

describe('Podspec metadata', () => {
  it('uses the SHIELD organization repository as its source URL', () => {
    const podspecSource = fs.readFileSync(
      path.join(__dirname, '../../react-native-shield-fraud-plugin.podspec'),
      'utf8'
    );

    expect(podspecSource).toContain(
      ':git => "https://github.com/shield-ai-technology/react-native-shield-fraud-plugin.git"'
    );
  });
});

describe('Android Gradle dependencies', () => {
  it('pins the React Native dependency instead of using a dynamic version', () => {
    const buildGradleSource = fs.readFileSync(
      path.join(__dirname, '../../android/build.gradle'),
      'utf8'
    );
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8')
    );

    expect(buildGradleSource).not.toContain(
      'com.facebook.react:react-native:+'
    );
    expect(buildGradleSource).toContain(
      `com.facebook.react:react-native:${packageJson.devDependencies['react-native']}`
    );
  });
});

describe('Cross-platform metadata', () => {
  it('reads package name and version from package.json', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../src/index.tsx'),
      'utf8'
    );

    expect(source).toContain('packageJson.name');
    expect(source).toContain('packageJson.version');
    expect(source).not.toContain("const crossPlatformVersion = '2.1.0'");
  });
});

describe('iOS object nil checks', () => {
  it('uses nil for Objective-C object absence checks', () => {
    const iosSource = fs.readFileSync(
      path.join(__dirname, '../../ios/ShieldFraudPlugin.mm'),
      'utf8'
    );

    expect(iosSource).not.toContain('!= NULL');
  });
});
