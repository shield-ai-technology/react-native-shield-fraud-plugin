import { NativeModules, NativeEventEmitter } from 'react-native';

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

class ShieldFraud {
  private static PlatformWrapper = NativeModules.ShieldFraudPlugin;
  private static eventEmitter = new NativeEventEmitter(ShieldFraud.PlatformWrapper);

  public static initShield(config: Config, callbacks?: ShieldCallback): void {
    const isOptimizedListener = !!callbacks;
    ShieldFraud.PlatformWrapper.initShield(
      config.siteID,
      config.secretKey,
      isOptimizedListener,
      config.blockedDialog,
      config.logLevel,
      config.environmentInfo
    );

    if (isOptimizedListener ?? false) {
      ShieldFraud.listeners(callbacks);
    }
  }

  private static listeners(callbacks?: ShieldCallback): void {
    ShieldFraud.eventEmitter.addListener('success', (data) => {
      if (callbacks?.onSuccess) {
        callbacks.onSuccess(data);
      }
    });

    ShieldFraud.eventEmitter.addListener('error', (error) => {
      if (callbacks?.onFailure) {
        callbacks.onFailure(error);
      }
    });
  }

  public static getSessionId(): Promise<string> {
    return ShieldFraud.PlatformWrapper.getSessionId();
  }

  public static isSDKready(callback: (isReady: boolean) => void): void { //TODO:: rename it to device state listenere
    ShieldFraud.PlatformWrapper.setDeviceResultStateListener(() => {
      callback(true);
    });
  }

  public static sendAttributes(screenName: string, data: object): void {
    ShieldFraud.PlatformWrapper.sendAttributes(screenName, data);
  }

  public static getLatestDeviceResult(): Promise<object> {
    return new Promise((resolve, reject) => {
      ShieldFraud.PlatformWrapper.getLatestDeviceResult((result: object) => {
        // Handle success with the result object
        resolve(result);
      }, (error: object) => {
        // Handle error with the error object
        reject(error);
      });
    });
  }
}

export default ShieldFraud;
