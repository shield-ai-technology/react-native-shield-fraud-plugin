import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * TypeScript spec for the ShieldFraudPlugin Turbo Module.
 * This file is used by React Native codegen to auto-generate
 * native interface code for both iOS and Android.
 */
export interface Spec extends TurboModule {
  /**
   * Initializes the ShieldFraud SDK with the provided configuration.
   */
  initShield(
    siteID: string,
    secretKey: string,
    isOptimizedListener: boolean,
    blockedDialog: Object | null,
    logLevel: number,
    environmentInfo: number
  ): Promise<void>;

  /**
   * Sets cross-platform metadata (name + version) on the SDK.
   */
  setCrossPlatformParameters(
    crossPlatformName: string,
    crossPlatformVersion: string
  ): void;

  /**
   * Returns the current session ID synchronously.
   */
  getSessionId(): string;

  /**
   * Returns whether the SDK has been initialized synchronously.
   */
  isShieldInitialized(): boolean;

  /**
   * Registers a listener for the device-result-ready state event.
   */
  setDeviceResultStateListener(): void;

  /**
   * Sends custom attributes for a given screen name.
   */
  sendAttributes(screenName: string, data: Object): void;

  /**
   * Retrieves the latest device result via success/error callbacks.
   */
  getLatestDeviceResult(
    successCallback: (result: Object) => void,
    errorCallback: (error: Object) => void
  ): void;

  // Required by RCTEventEmitter for New Architecture compatibility
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('ShieldFraudPlugin');
