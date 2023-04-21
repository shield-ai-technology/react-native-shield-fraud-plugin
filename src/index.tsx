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
      isOptimizedListener?: boolean;
      blockedDialog?: {
        title: string;
        body: string;
      } | null;
      logLevel: LogLevel;
      environmentInfo: EnvironmentInfo
    }
    
    export function initShield(config: Config, onSuccess?: (data: any) => void, onError?: (error: any) => void): void {
      ShieldFraudPlugin.initShield(config.siteID, config.secretKey, config.isOptimizedListener, config.blockedDialog, config.logLevel, config.environmentInfo);
      
      if (config.isOptimizedListener ?? false) {
        listeners(onSuccess, onError);
      }
    }
    
    function listeners(onSuccess?: (data: any) => void, onError?: (error: any) => void): void {
      eventEmitter.addListener('success', (data) => {
        if (onSuccess) {
          onSuccess(data);
        }
      });
    
      eventEmitter.addListener('error', error => {
        if (onError) {
          onError(error);
        }
      });
    }
    
    export function getSessionId(): Promise<string> {
      return ShieldFraudPlugin.getSessionId();
    }
    
    export function sendAttributes(screenName: string, data: object): void {
      ShieldFraudPlugin.sendAttributes(screenName, data);
    }