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
    mockPlatformOS = 'android';
  });

  it('calls back with false on Android when the SDK is not initialized', async () => {
    const callback = jest.fn();
    const isShieldInitializedSpy = jest
      .spyOn(ShieldFraud, 'isShieldInitialized')
      .mockResolvedValue(false);

    await ShieldFraud.isSDKready(callback);

    expect(isShieldInitializedSpy).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(false);
    expect(mockAddListener).not.toHaveBeenCalled();
    expect(mockNativeModule.setDeviceResultStateListener).not.toHaveBeenCalled();
  });

  it('calls back with true on Android after the SDK is initialized', async () => {
    const callback = jest.fn();
    const isShieldInitializedSpy = jest
      .spyOn(ShieldFraud, 'isShieldInitialized')
      .mockResolvedValue(true);

    await ShieldFraud.isSDKready(callback);

    expect(isShieldInitializedSpy).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(true);
    expect(mockAddListener).not.toHaveBeenCalled();
    expect(mockNativeModule.setDeviceResultStateListener).not.toHaveBeenCalled();
  });
});
