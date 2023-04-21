import { NativeModules, Platform, NativeEventEmitter } from 'react-native';

const LINKING_ERROR =
  `The package 'react-native-shield-fraud-plugin' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

const ShieldFraudPlugin = NativeModules.ShieldFraudPlugin
  ? NativeModules.ShieldFraudPlugin
  : new Proxy(
    {},
    {
      get() {
        throw new Error(LINKING_ERROR);
      },
    }
  );

const eventEmitter = new NativeEventEmitter(ShieldFraudPlugin);

export enum LogLevel {
  LogLevelDebug = 3,
  LogLevelInfo = 2,
  LogLevelNone = 1,
}

export enum EnvironmentInfo {
  EnvironmentProd = 0,
  EnvironmentDev = 1,
  EnvironmentStag = 2,
}

export interface Config {
  siteID: string;
  secretKey: string;
  blockedDialog?: {
    title: string;
    body: string;
  } | null;
  logLevel: LogLevel;
  environmentInfo: EnvironmentInfo;
}

type SuccessCallback = (data: any) => void;
type FailureCallback = (error: any) => void;
export type ShieldCallback = {
  onSuccess?: SuccessCallback;
  onFailure?: FailureCallback;
};

export function initShield(config: Config, callbacks?: ShieldCallback): void {

  const isOptimizedListener = !!callbacks; // Set isOptimizedListener to true if callbacks are provided, otherwise false
  ShieldFraudPlugin.initShield(config.siteID, config.secretKey, isOptimizedListener, config.blockedDialog, config.logLevel, config.environmentInfo);

  if (isOptimizedListener ?? false) {
    listeners(callbacks);
  }
}

function listeners(callbacks?: ShieldCallback): void {
  eventEmitter.addListener('success', (data) => {
    if (callbacks?.onSuccess) {
      callbacks.onSuccess(data);
    }
  });

  eventEmitter.addListener('error', (error) => {
    if (callbacks?.onFailure) {
      callbacks.onFailure(error);
    }
  });
}

export function getSessionId(): Promise<string> {
  return ShieldFraudPlugin.getSessionId();
}

export function isSDKready(callback: (isReady: boolean) => void): void {
  ShieldFraudPlugin.setDeviceResultStateListener(() => {
    // Handle the callback logic here
    callback(true); // Pass the boolean value indicating SDK is ready
  });
}

export function sendAttributes(screenName: string, data: object): void {
  ShieldFraudPlugin.sendAttributes(screenName, data);
}

// Define the exported method
export const getLatestDeviceResult = (): Promise<object> => {
  return new Promise((resolve, reject) => {
    ShieldFraudPlugin.getLatestDeviceResult((result: object) => {
      // Handle success with the result object
      resolve(result);
    }, (error: object) => {
      // Handle error with the error object
      reject(error);
    });
  });
};