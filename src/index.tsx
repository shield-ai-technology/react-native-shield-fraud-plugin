import { NativeModules, NativeEventEmitter } from "react-native";

/**
 * Enum representing the log levels for ShieldFraud.
 */
export enum LogLevel {
  LogLevelDebug = 3,
  LogLevelInfo = 2,
  LogLevelNone = 1,
}

/**
 * Enum representing the environment information for ShieldFraud.
 */
export enum EnvironmentInfo {
  EnvironmentProd = 0,
  EnvironmentDev = 1,
  EnvironmentStag = 2,
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
   */
  private static PlatformWrapper = NativeModules.ShieldFraudPlugin;

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

    // Call the native method to initialize ShieldFraud with the provided configuration.
    await ShieldFraud.PlatformWrapper.initShield(
      config.siteID,
      config.secretKey,
      isOptimizedListener,
      config.blockedDialog,
      logLevel,
      environmentInfo
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
    const crossPlatformVersion = "1.0.11"; 

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
   * Checks if the ShieldFraud SDK is ready and invokes the provided callback with the readiness state.
   *
   * @param callback - A callback function to be invoked with the readiness state.
   *   - `isReady` (boolean): A boolean value indicating whether the ShieldFraud SDK is ready.
   */
  public static async isSDKready(
    callback: (isReady: boolean) => void
  ): Promise<void> {
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
   * Retrieves the latest device result from the ShieldFraud plugin.
   *
   * @returns A Promise that resolves with the latest device result object.
   */
  public static getLatestDeviceResult(): Promise<object> {
    return new Promise((resolve, reject) => {
      ShieldFraud.PlatformWrapper.getLatestDeviceResult(
        (result: object) => {
          // Handle success with the result object
          resolve(result);
        },
        (error: object) => {
          // Handle error with the error object
          reject(error);
        }
      );
    });
  }
}

export default ShieldFraud;
