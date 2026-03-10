import {
  NativeModules,
  NativeEventEmitter,
  Platform,
  TurboModuleRegistry,
} from "react-native";

/**
 * Resolve the native module through TurboModuleRegistry (New Architecture)
 * with a fallback to NativeModules bridge (Old Architecture).
 */
const ShieldFraudPluginNativeModule =
  TurboModuleRegistry.get<any>("ShieldFraudPlugin") ??
  NativeModules.ShieldFraudPlugin;

/**
 * Enum representing the log levels for ShieldFraud.
 */
export enum LogLevel {
  LogLevelVerbose = 4,
  LogLevelDebug = 3,
  LogLevelInfo = 2,
  LogLevelNone = 1,
}

/**
 * Enum representing the environment information for ShieldFraud.
 */
export enum EnvironmentInfo {
  EnvironmentProd = 0,    // Environment.PROD
  EnvironmentDev = 1,     // Environment.DEV
  EnvironmentStaging = 2, // Environment.STAGING
}

/**
 * Configuration object for initializing ShieldFraud.
 */
export interface Config {
  siteID: string;
  secretKey: string;
  blockedDialog?: {
    title: string;
    body: string;
  } | null;
  logLevel?: LogLevel;
  environmentInfo?: EnvironmentInfo;
  /**
   * Android-only: when true, the Shield SDK will block screen recording
   * while it is active. Has no effect on iOS (the value is forwarded but
   * the native side ignores it). Defaults to false when not provided.
   */
  blockScreenRecording?: boolean;
}

/**
 * Type definition for the success callback function.
 */
type SuccessCallback = (data: any) => void;

/**
 * Type definition for the failure callback function.
 */
type FailureCallback = (error: any) => void;

/**
 * Type definition for the ShieldFraud callback functions.
 */
export type ShieldCallback = {
  onSuccess?: SuccessCallback;
  onFailure?: FailureCallback;
};

/**
 * The `ShieldFraud` class is a wrapper for the ShieldFraudPlugin native module in React Native.
 * It provides methods for initializing ShieldFraud, retrieving session ID, checking the SDK readiness,
 * sending attributes, and getting the latest device result.
 */
class ShieldFraud {
  /**
   * The native module for accessing the ShieldFraudPlugin.
   * Resolved via TurboModuleRegistry on New Architecture, with
   * a NativeModules bridge fallback for Old Architecture.
   */
  private static PlatformWrapper = ShieldFraudPluginNativeModule;

  /**
   * The event emitter for listening to success and error events.
   */
  private static eventEmitter = new NativeEventEmitter(
    ShieldFraud.PlatformWrapper
  );

  /**
   * Initializes the ShieldFraud plugin with the provided configuration.
   *
   * @param config - The configuration object containing the required properties.
   * @param callbacks - (Optional) The callback functions for success and failure events.
   */
  public static async initShield(
    config: Config,
    callbacks?: ShieldCallback
  ): Promise<void> {
    const isOptimizedListener = !!callbacks;

    // Set default values if logLevel is not provided
    const logLevel = config.logLevel || LogLevel.LogLevelNone;

    // Set default values if environmentInfo is not provided
    const environmentInfo =
      config.environmentInfo || EnvironmentInfo.EnvironmentProd;
    
    // Set cross-platform parameters internally (React Native and version from package.json)
    ShieldFraud.setCrossPlatformParameters();

    // blockScreenRecording is Android-only; iOS native ignores the value.
    // Always send a real boolean — the Old Arch bridge cannot handle null
    // for boolean parameters (causes NPE in ReadableNativeArray.getBoolean).
    const blockScreenRecording =
      Platform.OS === "android" ? (config.blockScreenRecording ?? false) : false;

    // Call the native method to initialize ShieldFraud with the provided configuration.
    await ShieldFraud.PlatformWrapper.initShield(
      config.siteID,
      config.secretKey,
      isOptimizedListener,
      config.blockedDialog ?? null,
      logLevel,
      environmentInfo,
      blockScreenRecording
    );

    if (isOptimizedListener) {
      // Set up listeners for success and error events if callbacks are provided.
      ShieldFraud.listeners(callbacks);
    }
  }

  /**
   * Private method to set cross-platform parameters.
   * The cross-platform name and the version is fetched from package.json.
   */
  private static setCrossPlatformParameters(): void {
    const crossPlatformName = "react-native-shield-fraud-plugin";
    const crossPlatformVersion = "1.1.0";

    ShieldFraud.PlatformWrapper.setCrossPlatformParameters(
      crossPlatformName,
      crossPlatformVersion
    );
  }

  /**
   * Sets up event listeners for success and error events.
   *
   * @param callbacks - The callback functions for success and failure events.
   */
  private static listeners(callbacks?: ShieldCallback): void {
    // Listen for success events and invoke the onSuccess callback if provided.
    ShieldFraud.eventEmitter.addListener("success", (data) => {
      if (callbacks?.onSuccess) {
        callbacks.onSuccess(data);
      }
    });

    // Listen for error events and invoke the onFailure callback if provided.
    ShieldFraud.eventEmitter.addListener("error", (error) => {
      if (callbacks?.onFailure) {
        callbacks.onFailure(error);
      }
    });
  }

  /**
   * Retrieves the session ID from the ShieldFraud plugin.
   *
   * @returns A Promise that resolves with the session ID.
   */
  public static getSessionId(): Promise<string> {
    return ShieldFraud.PlatformWrapper.getSessionId();
  }

  /**
   * Checks whether the ShieldFraud plugin is initialized.
   *
   * @returns A Promise that resolves with a boolean value indicating whether the ShieldFraud plugin is initialized (true) or not (false).
   */
  public static isShieldInitialized(): Promise<boolean> {
    return ShieldFraud.PlatformWrapper.isShieldInitialized();
  }

  /**
   * iOS only — checks if the ShieldFraud SDK is ready and invokes the provided
   * callback with the readiness state.
   *
   * On Android (SDK 2.x) device result events fire automatically via the
   * Sentinel inside createShieldWithCallback. There is no subscription call
   * and no reliable way to intercept the event after the fact, so this method
   * is a no-op on Android. Use the `callbacks` parameter of `initShield`
   * instead to receive device results on Android.
   *
   * @param callback - A callback function to be invoked with the readiness state.
   *   - `isReady` (boolean): true when the SDK has produced a device result.
   */
  public static async isSDKready(
    callback: (isReady: boolean) => void
  ): Promise<void> {
    if (Platform.OS !== "ios") {
      return;
    }

    try {
      // Adding a timeout of 100 milliseconds
      await new Promise((resolve) => setTimeout(resolve, 100));

      const isInitialized = await this.isShieldInitialized();

      if (!isInitialized) {
        console.log("Shield SDK not initialized:");
        callback(false);
        return;
      }

      const deviceResultListener = (event: { status: string }) => {
        if (event.status === "isSDKReady") {
          ShieldFraud.eventEmitter.removeAllListeners("device_result_state");
          callback(true);
        }
      };

      ShieldFraud.eventEmitter.addListener(
        "device_result_state",
        deviceResultListener
      );

      // Trigger the SDK subscription — iOS 1.x requires this explicit call.
      ShieldFraud.PlatformWrapper.setDeviceResultStateListener();
    } catch (error) {
      console.error("An error occurred:", error);
      callback(false);
    }
  }

  /**
   * Sends attributes to the ShieldFraud plugin for a specific screen.
   *
   * @param screenName - The name of the screen.
   * @param data - The attribute data object.
   */
  public static sendAttributes(screenName: string, data: object): void {
    ShieldFraud.PlatformWrapper.sendAttributes(screenName, data);
  }

  /**
   * Sends attributes and resolves with `true` when the native SDK confirms success.
   *
   * @param screenName - The name of the screen.
   * @param data - The attribute data object.
   * @returns A Promise that resolves to true on success and rejects on error.
   */
  public static sendAttributesWithCallback(
    screenName: string,
    data: object
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      ShieldFraud.PlatformWrapper.sendAttributesWithCallback(
        screenName,
        data,
        (result: boolean) => {
          resolve(!!result);
        },
        (error: object) => {
          reject(error);
        }
      );
    });
  }

  /**
   * Retrieves the latest device result from the ShieldFraud plugin.
   *
   * @returns A Promise that resolves with the latest device result object.
   */
  public static getLatestDeviceResult(): Promise<object> {
    return new Promise((resolve, reject) => {
      ShieldFraud.PlatformWrapper.getLatestDeviceResult(
        (result: object) => {
          resolve(result);
        },
        (error: object) => {
          reject(error);
        }
      );
    });
  }

  /**
   * Triggers a device signature computation for a given screen name.
   * On success, resolves with the latest device result object.
   * On failure, rejects with the error message.
   *
   * @param screenName - The name of the screen triggering the signature.
   * @returns A Promise that resolves with the device result or rejects with an error.
   */
  public static sendDeviceSignature(screenName: string): Promise<object> {
    return new Promise((resolve, reject) => {
      ShieldFraud.PlatformWrapper.sendDeviceSignature(
        screenName,
        (result: object) => {
          resolve(result);
        },
        (error: string) => {
          reject(error);
        }
      );
    });
  }
}

export default ShieldFraud;
