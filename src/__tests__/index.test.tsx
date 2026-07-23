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
};

const mockAddListener = jest.fn();
const mockRemoveAllListeners = jest.fn();
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
    OS: 'android',
  },
  TurboModuleRegistry: {
    get: jest.fn(() => mockNativeModule),
  },
}));

import ShieldFraud from '../index';

describe('ShieldFraud native integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ShieldFraud as any).PlatformWrapper = mockNativeModule;
    (ShieldFraud as any).eventEmitter = {
      addListener: mockAddListener,
      removeAllListeners: mockRemoveAllListeners,
    };
  });

  it.each([
    [{ siteID: '', secretKey: 'secret-key' }, 'siteId must not be empty'],
    [{ siteID: 'site-id', secretKey: '' }, 'secretKey must not be empty'],
  ])('rejects invalid credentials in JavaScript', async (config, message) => {
    await expect(ShieldFraud.initShield(config)).rejects.toThrow(message);
    expect(mockNativeModule.initShield).not.toHaveBeenCalled();
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

  it('registers optimized listeners before initialization and forwards partnerId', async () => {
    mockAddListener.mockReturnValue({ remove: jest.fn() });

    await ShieldFraud.initShield(
      {
        siteID: 'site-id',
        secretKey: 'secret-key',
        partnerId: 'partner-id',
      },
      { onSuccess: jest.fn(), onFailure: jest.fn() }
    );

    expect(mockNativeModule.initShield).toHaveBeenCalledWith(
      'site-id',
      'secret-key',
      'partner-id',
      true,
      null,
      1,
      0,
      false
    );
    expect(mockAddListener.mock.invocationCallOrder[0]!).toBeLessThan(
      mockNativeModule.initShield.mock.invocationCallOrder[0]!
    );
  });

  it('exposes synchronous values for synchronous native state methods', () => {
    mockNativeModule.getSessionId.mockReturnValue('session-id');
    mockNativeModule.isShieldInitialized.mockReturnValue(true);

    const sessionId: string = ShieldFraud.getSessionId();
    const isInitialized: boolean = ShieldFraud.isShieldInitialized();

    expect(sessionId).toBe('session-id');
    expect(isInitialized).toBe(true);
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

  it('requires ShieldFraud 2.0.0 or newer in both package variants', () => {
    const fraudPodspec = fs.readFileSync(
      path.join(__dirname, '../../react-native-shield-fraud-plugin.podspec'),
      'utf8'
    );
    const fullPodspec = fs.readFileSync(
      path.join(__dirname, '../../react-native-shield-full-plugin.podspec'),
      'utf8'
    );

    expect(fraudPodspec).toContain('s.dependency "ShieldFraud", ">= 2.0.0"');
    expect(fullPodspec).toContain('s.dependency "ShieldFraud", ">= 2.0.0"');
  });

  it('does not force C++ module flags on static-library consumers', () => {
    const fraudPodspec = fs.readFileSync(
      path.join(__dirname, '../../react-native-shield-fraud-plugin.podspec'),
      'utf8'
    );
    const fullPodspec = fs.readFileSync(
      path.join(__dirname, '../../react-native-shield-full-plugin.podspec'),
      'utf8'
    );

    for (const podspec of [fraudPodspec, fullPodspec]) {
      expect(podspec).not.toContain('CLANG_ENABLE_MODULES');
      expect(podspec).not.toContain('OTHER_CPLUSPLUSFLAGS');
      expect(podspec).not.toContain('-fcxx-modules');
    }
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

describe('iOS ShieldFraud 2.x migration', () => {
  const iosSource = fs.readFileSync(
    path.join(__dirname, '../../ios/ShieldFraudPlugin.mm'),
    'utf8'
  );
  const iosHeader = fs.readFileSync(
    path.join(__dirname, '../../ios/ShieldFraudPlugin.h'),
    'utf8'
  );
  const androidSource = fs.readFileSync(
    path.join(
      __dirname,
      '../../android/src/main/java/com/shieldfraudplugin/ShieldFraudPluginModule.java'
    ),
    'utf8'
  );
  const nativeSpec = fs.readFileSync(
    path.join(__dirname, '../NativeShieldFraudPlugin.ts'),
    'utf8'
  );
  const wrapperSource = fs.readFileSync(
    path.join(__dirname, '../index.tsx'),
    'utf8'
  );

  it('creates and retains a Shield instance through ShieldFactory', () => {
    expect(iosSource).toContain(
      '@property (nonatomic, strong) id<Shield> shield;'
    );
    expect(iosSource).toContain('[[ShieldConfig alloc] initWithSiteId:siteID');
    expect(iosSource).toContain(
      '[ShieldFactory createShieldWithConfig:config]'
    );
    expect(iosSource).not.toContain('[Shield setUpWith:config]');
    expect(iosSource).not.toContain('[Shield shared]');
  });

  it('uses the Shield 2.x result and error types', () => {
    expect(iosSource).toContain('#import <ShieldFraud/ShieldFraud-Swift.h>');
    expect(iosSource).not.toContain('@import ShieldFraud;');
    expect(iosSource).toContain('[self.shield onDeviceResultWithHandler:');
    expect(iosSource).toContain('deviceIntelligence.data');
    expect(iosSource).toContain('error.errorMessage');
    expect(iosSource).not.toContain('getErrorResponse');
    expect(iosHeader).not.toContain('DeviceShieldCallback');
  });

  it('forwards partnerId through both native ShieldConfig implementations', () => {
    expect(nativeSpec).toContain('partnerId: string | null');
    expect(iosSource).toContain('config.partnerId = partnerId;');
    expect(androidSource).toContain('config.setPartnerId(partnerId);');
  });

  it('registers the iOS device-result handler only for optimized mode', () => {
    const optimizedBlock = iosSource.slice(
      iosSource.indexOf('if (isOptimizedListener) {'),
      iosSource.indexOf('- (NSDictionary<NSString *, NSString *> *)')
    );

    expect(optimizedBlock).toContain('[self.shield onDeviceResultWithHandler:');
    expect(iosSource.indexOf('if (isOptimizedListener) {')).toBeLessThan(
      iosSource.indexOf('[self.shield onDeviceResultWithHandler:')
    );
  });

  it('emits object payloads for optimized results on both platforms', () => {
    expect(iosSource).toContain(
      'sendEventWithName:@"success" body:deviceIntelligence.data'
    );
    expect(androidSource).toContain(
      'emitEvent("success", json != null ? toWritableMap(json) : null);'
    );
    expect(androidSource).not.toContain(
      'emitEvent("success", json != null ? json.toString() : null);'
    );
  });

  it('reports the same missing device-signature result error on both platforms', () => {
    expect(iosSource).toContain('@"No device result available."');
    expect(androidSource).toContain(
      'errorCallback.invoke("No device result available.");'
    );
    expect(androidSource).not.toContain(
      'successCallback.invoke(json != null ? toWritableMap(json) : null);'
    );
  });

  it('resolves initShield as a promise in both iOS architectures', () => {
    expect(
      iosSource.match(/resolve:\(RCTPromiseResolveBlock\)resolve/g)
    ).toHaveLength(2);
    expect(iosSource.match(/resolve\(nil\);/g)).toHaveLength(2);
  });

  it('does not emit the legacy iOS 1.5.x readiness event', () => {
    expect(iosSource).not.toContain('@"isSDKReady"');
    expect(iosSource).not.toContain('@"device_result_state"');
  });

  it('removes the obsolete device-result readiness listener API', () => {
    expect(wrapperSource).not.toContain('isSDKready');
    expect(iosSource).not.toContain('setDeviceResultStateListener');
    expect(androidSource).not.toContain('setDeviceResultStateListener');
    expect(nativeSpec).not.toContain('setDeviceResultStateListener');
  });

  it('does not configure excluded modules or debugKey options', () => {
    expect(iosSource).not.toContain('config.modules');
    expect(iosSource).not.toContain('config.debugKey');
  });
});
