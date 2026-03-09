#import "ShieldFraudPlugin.h"

// Import the auto-generated Swift→ObjC header.
// This exposes all Swift-exported types (Configuration, Shield, BlockedDialog,
// LogLevel, Environment, ShieldCrossPlatformHelper, DeviceShieldCallback, …)
// without requiring Clang module syntax (@import), which fails in Obj-C++ files
// when C++ modules are not enabled (e.g. when the New Architecture codegen
// headers are included and the file is compiled as Obj-C++).
#import <ShieldFraud/ShieldFraud-Swift.h>

@implementation ShieldFraudPlugin

static BOOL isShieldInitialized = NO;

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
    NSDictionary<NSString *, id> *result = [[Shield shared] getLatestDeviceResult];
    if (result != NULL) {
        successCallback(@[result]);
        return;
    }

    NSError *error = [[Shield shared] getErrorResponse];
    if (error != NULL) {
        errorCallback(@[[error localizedDescription]]);
        return;
    }

    errorCallback(@[@"No device result available yet."]);
}

// Subscribe to real-time device-result state changes
RCT_EXPORT_METHOD(setDeviceResultStateListener)
{
    double delayInSeconds = 1.5;
    dispatch_time_t popTime = dispatch_time(DISPATCH_TIME_NOW,
                                            (int64_t)(delayInSeconds * NSEC_PER_SEC));
    dispatch_after(popTime, dispatch_get_main_queue(), ^(void) {
        [[Shield shared] setDeviceResultStateListener:^{
            [self sendEventWithName:@"device_result_state"
                              body:@{@"status": @"isSDKReady"}];
        }];
    });
}

// Attach arbitrary screen-level attributes
RCT_EXPORT_METHOD(sendAttributes:(NSString *)screenName
                  data:(NSDictionary *)data)
{
    [[Shield shared] sendAttributesWithScreenName:screenName data:data];
}

RCT_EXPORT_METHOD(sendAttributesWithCallback:(NSString *)screenName
                  data:(NSDictionary *)data
                  successCallback:(RCTResponseSenderBlock)successCallback
                  errorCallback:(RCTResponseSenderBlock)errorCallback)
{
    [[Shield shared] sendAttributesWithScreenName:screenName
                                             data:data
                                                :^(BOOL success, NSError *error) {
        dispatch_async(dispatch_get_main_queue(), ^{
            if (success) {
                successCallback(@[@(YES)]);
                return;
            }

            NSString *errorMessage = error != nil
                ? [error localizedDescription]
                : @"Failed to send attributes.";
            errorCallback(@[errorMessage]);
        });
    }];
}

// RCTEventEmitter — declare the events this module can emit
- (NSArray<NSString *> *)supportedEvents
{
    return @[@"success", @"error", @"device_result_state"];
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

// DeviceShieldCallback delegate — forwarded as JS events
- (void)didErrorWithError:(NSError *)error
{
    [self sendEventWithName:@"error" body:[error localizedDescription]];
}

- (void)didSuccessWithResult:(NSDictionary<NSString *, id> *)result
{
    [self sendEventWithName:@"success" body:result];
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
isOptimizedListener:(BOOL)isOptimizedListener
     blockedDialog:(NSDictionary * _Nullable)blockedDialog
          logLevel:(double)logLevel
   environmentInfo:(double)environmentInfo
blockScreenRecording:(BOOL)blockScreenRecording
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
    if (!isShieldInitialized) {
        Configuration *config = [[Configuration alloc] initWithSiteId:siteID
                                                            secretKey:secretKey];
        if (isOptimizedListener) {
            config.deviceShieldCallback = self;
        }

        if (blockedDialog != nil) {
            NSString *title = [blockedDialog objectForKey:@"title"];
            NSString *body  = [blockedDialog objectForKey:@"body"];
            config.defaultBlockedDialog = [[BlockedDialog alloc] initWithTitle:title
                                                                          body:body];
        }

        // JS numbers arrive as double; cast explicitly to Swift-bridged enum types.
        config.logLevel    = (LogLevel)(NSInteger)logLevel;
        config.environment = (Environment)(NSInteger)environmentInfo;

        [Shield setUpWith:config];
        isShieldInitialized = YES;
    }
    resolve(nil);
}

- (NSString *)getSessionId
{
    return [[Shield shared] sessionId];
}

- (NSNumber *)isShieldInitialized
{
    return @(isShieldInitialized);
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
//                   from NSNumber); no resolve/reject (bridge wraps the void
//                   return automatically).
//   • getSessionId / isShieldInitialized — must use the blocking-synchronous
//                   macro so the bridge returns the value to JS synchronously.
// -----------------------------------------------------------------------------

RCT_EXPORT_METHOD(initShield:(NSString *)siteID
                  secretKey:(NSString *)secretKey
                  isOptimizedListener:(BOOL)isOptimizedListener
                  blockedDialog:(NSDictionary *)blockedDialog
                  logLevel:(NSInteger)logLevel
                  environmentInfo:(NSInteger)environmentInfo
                  blockScreenRecording:(BOOL)blockScreenRecording)
{
    if (!isShieldInitialized) {
        Configuration *config = [[Configuration alloc] initWithSiteId:siteID
                                                            secretKey:secretKey];
        if (isOptimizedListener) {
            config.deviceShieldCallback = self;
        }

        if (blockedDialog != nil) {
            NSString *title = [blockedDialog objectForKey:@"title"];
            NSString *body  = [blockedDialog objectForKey:@"body"];
            config.defaultBlockedDialog = [[BlockedDialog alloc] initWithTitle:title
                                                                          body:body];
        }

        // Cast NSInteger to Swift-bridged enum types explicitly.
        config.logLevel    = (LogLevel)logLevel;
        config.environment = (Environment)environmentInfo;

        [Shield setUpWith:config];
        isShieldInitialized = YES;
    }
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(getSessionId)
{
    return [[Shield shared] sessionId];
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(isShieldInitialized)
{
    return @(isShieldInitialized);
}

#endif  // RCT_NEW_ARCH_ENABLED

@end
