#import "ShieldFraudPlugin.h"

// ShieldFraud is Swift-based, but this source must remain Objective-C++ for
// React Native's New Architecture. Importing the generated Objective-C header
// avoids forcing -fcxx-modules on consumers that link the plugin statically.
#import <ShieldFraud/ShieldFraud-Swift.h>

@interface ShieldFraudPlugin ()
@property (nonatomic, strong) id<Shield> shield;
@end

@implementation ShieldFraudPlugin

RCT_EXPORT_MODULE();

// =============================================================================
// MARK: - Shared methods (Old Architecture & New Architecture)
//
// These methods have identical signatures in both architectures.
// RCT_EXPORT_METHOD registers them with the bridge for Old Arch, and the
// matching Obj-C selectors satisfy the codegen protocol for New Arch.
// =============================================================================

// Cross-platform SDK metadata (React Native wrapper version / name)
RCT_EXPORT_METHOD(setCrossPlatformParameters:(NSString *)crossPlatformName
                  crossPlatformVersion:(NSString *)crossPlatformVersion)
{
    ShieldCrossPlatformParams *params = [[ShieldCrossPlatformParams alloc]
                                            initWithName:crossPlatformName
                                            version:crossPlatformVersion];
    [ShieldCrossPlatformHelper setCrossPlatformParameters:params];
}

// Retrieve the most-recently-computed device result
RCT_EXPORT_METHOD(getLatestDeviceResult:(RCTResponseSenderBlock)successCallback
                  errorCallback:(RCTResponseSenderBlock)errorCallback)
{
    if (self.shield == nil) {
        errorCallback(@[@"Shield SDK is not initialized."]);
        return;
    }

    DeviceIntelligence *deviceIntelligence = [self.shield getLatestDeviceResult];
    if (deviceIntelligence != nil) {
        successCallback(@[deviceIntelligence.data]);
        return;
    }

    errorCallback(@[@"No device result available yet."]);
}

// Attach arbitrary screen-level attributes
RCT_EXPORT_METHOD(sendAttributes:(NSString *)screenName
                  data:(NSDictionary *)data)
{
    if (self.shield == nil) {
        return;
    }

    [self.shield sendAttributesWithScreenName:screenName
                                         data:[self stringAttributesFromDictionary:data]
                                   completion:^(NSString *sessionId, ShieldError *error) {
        if (error != nil) {
            [self sendEventWithName:@"error" body:error.errorMessage];
        }
    }];
}

RCT_EXPORT_METHOD(sendAttributesWithCallback:(NSString *)screenName
                  data:(NSDictionary *)data
                  successCallback:(RCTResponseSenderBlock)successCallback
                  errorCallback:(RCTResponseSenderBlock)errorCallback)
{
    if (self.shield == nil) {
        errorCallback(@[@"Shield SDK is not initialized."]);
        return;
    }

    [self.shield sendAttributesWithScreenName:screenName
                                         data:[self stringAttributesFromDictionary:data]
                                   completion:^(NSString *sessionId, ShieldError *error) {
        if (sessionId != nil) {
            successCallback(@[@(YES)]);
            return;
        }

        NSString *errorMessage = error != nil
            ? error.errorMessage
            : @"Failed to send attributes.";
        errorCallback(@[errorMessage]);
    }];
}

// Trigger a device signature computation for a given screen name.
// Pass userId to associate the result with a specific user.
// The 2.x completion returns a session ID or ShieldError. On success, return
// the latest DeviceIntelligence payload to preserve the React Native API.
RCT_EXPORT_METHOD(sendDeviceSignature:(NSString *)screenName
                  userId:(NSString * _Nullable)userId
                  successCallback:(RCTResponseSenderBlock)successCallback
                  errorCallback:(RCTResponseSenderBlock)errorCallback)
{
    if (self.shield == nil) {
        errorCallback(@[@"Shield SDK is not initialized."]);
        return;
    }

    ShieldUserData *userData = [[ShieldUserData alloc]
                                    initWithScreenName:screenName
                                    userId:userId];

    [self.shield sendDeviceSignatureWithUserData:userData
                                      completion:^(NSString *sessionId, ShieldError *error) {
        if (error != nil) {
            errorCallback(@[error.errorMessage]);
            return;
        }

        DeviceIntelligence *deviceIntelligence = [self.shield getLatestDeviceResult];
        if (sessionId != nil && deviceIntelligence != nil) {
            successCallback(@[deviceIntelligence.data]);
            return;
        }

        errorCallback(@[@"No device result available."]);
    }];
}

// RCTEventEmitter — declare the events this module can emit
- (NSArray<NSString *> *)supportedEvents
{
    return @[@"success", @"error"];
}

// RCTEventEmitter — required overrides (no-op wrappers keep the base class happy)
- (void)addListener:(NSString *)eventName
{
    [super addListener:eventName];
}

- (void)removeListeners:(double)count
{
    [super removeListeners:count];
}

// =============================================================================
// MARK: - ShieldFraud 2.x helpers
// =============================================================================

- (void)initializeShieldWithSiteID:(NSString *)siteID
                         secretKey:(NSString *)secretKey
                         partnerId:(NSString * _Nullable)partnerId
               optimizedListener:(BOOL)isOptimizedListener
                    blockedDialog:(NSDictionary * _Nullable)blockedDialog
                         logLevel:(NSInteger)logLevel
                  environmentInfo:(NSInteger)environmentInfo
{
    if (self.shield != nil) {
        return;
    }

    ShieldConfig *config = [[ShieldConfig alloc] initWithSiteId:siteID
                                                       secretKey:secretKey];
    config.logLevel = [self logLevelFromInteger:logLevel];
    config.environment = [self environmentFromInteger:environmentInfo];
    if (partnerId != nil) {
        config.partnerId = partnerId;
    }

    if (blockedDialog != nil) {
        NSString *title = [blockedDialog objectForKey:@"title"];
        NSString *body = [blockedDialog objectForKey:@"body"];
        if (title != nil && body != nil) {
            config.defaultBlockedDialog = [[BlockedDialog alloc] initWithTitle:title body:body];
        }
    }

    self.shield = [ShieldFactory createShieldWithConfig:config];

    if (isOptimizedListener) {
        __weak ShieldFraudPlugin *weakSelf = self;
        [self.shield onDeviceResultWithHandler:^(DeviceIntelligence *deviceIntelligence,
                                                 ShieldError *error) {
            ShieldFraudPlugin *strongSelf = weakSelf;
            if (strongSelf == nil) {
                return;
            }

            if (deviceIntelligence != nil) {
                [strongSelf sendEventWithName:@"success" body:deviceIntelligence.data];
                return;
            }

            if (error != nil) {
                [strongSelf sendEventWithName:@"error" body:error.errorMessage];
            }
        }];
    }
}

- (NSDictionary<NSString *, NSString *> *)stringAttributesFromDictionary:(NSDictionary *)data
{
    NSMutableDictionary<NSString *, NSString *> *attributes = [NSMutableDictionary dictionary];
    [data enumerateKeysAndObjectsUsingBlock:^(id key, id value, BOOL *stop) {
        if ([key isKindOfClass:[NSString class]] && [value isKindOfClass:[NSString class]]) {
            attributes[key] = value;
        }
    }];
    return attributes;
}

- (LogLevel)logLevelFromInteger:(NSInteger)logLevel
{
    switch (logLevel) {
        case 4:
        case 3:
            return LogLevelDebug;
        case 2:
            return LogLevelInfo;
        default:
            return LogLevelNone;
    }
}

- (Environment)environmentFromInteger:(NSInteger)environmentInfo
{
    switch (environmentInfo) {
        case 1:
            return EnvironmentDev;
        case 2:
            return EnvironmentStag;
        default:
            return EnvironmentProd;
    }
}


// =============================================================================
// MARK: - Architecture-specific methods
// =============================================================================

#ifdef RCT_NEW_ARCH_ENABLED

// -----------------------------------------------------------------------------
// New Architecture  (Turbo Modules / JSI)
//
// Methods are implemented as plain Obj-C methods to directly satisfy the
// codegen-generated NativeShieldFraudPluginSpec protocol.
//
// Key differences from Old Arch:
//   • initShield  — logLevel/environmentInfo are `double` (JS numbers are
//                   always doubles); resolve/reject blocks are added for the
//                   Promise<void> return type declared in the TS spec.
//   • getSessionId / isShieldInitialized — synchronous return values are
//                   supported natively by JSI (no blocking-synchronous macro).
//   • isShieldInitialized — protocol requires NSNumber* so JSI can marshal
//                   the boolean; returning plain BOOL would be a type mismatch.
//   • getTurboModule: — wires this Obj-C class into the JSI runtime.
// -----------------------------------------------------------------------------

- (void)initShield:(NSString *)siteID
         secretKey:(NSString *)secretKey
         partnerId:(NSString * _Nullable)partnerId
isOptimizedListener:(BOOL)isOptimizedListener
     blockedDialog:(NSDictionary * _Nullable)blockedDialog
          logLevel:(double)logLevel
   environmentInfo:(double)environmentInfo
blockScreenRecording:(BOOL)blockScreenRecording
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
    [self initializeShieldWithSiteID:siteID
                           secretKey:secretKey
                           partnerId:partnerId
                  optimizedListener:isOptimizedListener
                       blockedDialog:blockedDialog
                            logLevel:(NSInteger)logLevel
                     environmentInfo:(NSInteger)environmentInfo];
    resolve(nil);
}

- (NSString *)getSessionId
{
    return self.shield != nil ? self.shield.sessionId : @"";
}

- (NSNumber *)isShieldInitialized
{
    return @(self.shield != nil);
}

// Wires this Obj-C class into the JSI runtime.
// The generated class name follows the codegenConfig "name" in package.json:
//   "RNShieldFraudPluginSpec"  →  NativeShieldFraudPluginSpecJSI
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeShieldFraudPluginSpecJSI>(params);
}

#else

// -----------------------------------------------------------------------------
// Old Architecture  (Bridge)
//
// RCT_EXPORT_METHOD      — registers void-return methods with the JS bridge.
// RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD — bridge-only macro for synchronous
//   return values; has no JSI equivalent and must stay inside #else.
//
// Key differences from New Arch:
//   • initShield  — logLevel/environmentInfo are NSInteger (bridge coerces
//                   from NSNumber); resolve/reject expose Promise<void> to JS.
//   • getSessionId / isShieldInitialized — must use the blocking-synchronous
//                   macro so the bridge returns the value to JS synchronously.
// -----------------------------------------------------------------------------

RCT_EXPORT_METHOD(initShield:(NSString *)siteID
                  secretKey:(NSString *)secretKey
                  partnerId:(NSString * _Nullable)partnerId
                  isOptimizedListener:(BOOL)isOptimizedListener
                  blockedDialog:(NSDictionary *)blockedDialog
                  logLevel:(NSInteger)logLevel
                  environmentInfo:(NSInteger)environmentInfo
                  blockScreenRecording:(BOOL)blockScreenRecording
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
    [self initializeShieldWithSiteID:siteID
                           secretKey:secretKey
                           partnerId:partnerId
                  optimizedListener:isOptimizedListener
                       blockedDialog:blockedDialog
                            logLevel:logLevel
                     environmentInfo:environmentInfo];
    resolve(nil);
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(getSessionId)
{
    return self.shield != nil ? self.shield.sessionId : @"";
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(isShieldInitialized)
{
    return @(self.shield != nil);
}

#endif  // RCT_NEW_ARCH_ENABLED

@end
