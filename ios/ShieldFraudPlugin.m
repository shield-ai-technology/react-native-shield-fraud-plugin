#import "ShieldFraudPlugin.h"

@implementation ShieldFraudPlugin

static BOOL isShieldInitialized = NO;

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(initShield:(NSString *)siteID secretKey:(NSString *)secretKey isOptimizedListener:(BOOL)isOptimizedListener blockedDialog:(NSDictionary *)blockedDialog logLevel:(NSInteger)logLevel environmentInfo:(NSInteger)environmentInfo)
{
    if (!isShieldInitialized) {
        Configuration *config = [[Configuration alloc] initWithSiteId:siteID secretKey:secretKey];
        
        if (isOptimizedListener) {
            config.deviceShieldCallback = self;
        }
        
        if (blockedDialog != nil) {
            NSString *title = [blockedDialog objectForKey:@"title"];
            NSString *body = [blockedDialog objectForKey:@"body"];
            config.defaultBlockedDialog = [[BlockedDialog alloc] initWithTitle:title body:body];
        }
        
        // Use logLevel parameter as needed
        config.logLevel = logLevel;
        config.environment = environmentInfo;
        [Shield setUpWith:config];
        isShieldInitialized = YES;
    }
}

// New method to set cross-platform parameters
RCT_EXPORT_METHOD(setCrossPlatformParameters:(NSString *)crossPlatformName
                  crossPlatformVersion:(NSString *)crossPlatformVersion)
{
    ShieldCrossPlatformParams *params = [[ShieldCrossPlatformParams alloc] initWithName:crossPlatformName version:crossPlatformVersion];
    [ShieldCrossPlatformHelper setCrossPlatformParameters:params];
}

// get session id from shield sdk
RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(getSessionId) {
    return [[Shield shared]sessionId];
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(isShieldInitialized) {
    return @(isShieldInitialized);
}

// get device result to shield
RCT_EXPORT_METHOD(getLatestDeviceResult:(RCTResponseSenderBlock)successCallback errorCallback: (RCTResponseSenderBlock)errorCallback)
{
    NSDictionary<NSString *, id> *result = [[Shield shared] getLatestDeviceResult];
    if (result != NULL) {
        successCallback(@[result]);
    }
    
    NSError *error = [[Shield shared] getErrorResponse];
    if (error != NULL) {
        errorCallback(@[error]);
    }
}

RCT_EXPORT_METHOD(setDeviceResultStateListener)
{
    double delayInSeconds = 1.5;
        
    dispatch_time_t popTime = dispatch_time(DISPATCH_TIME_NOW, (int64_t)(delayInSeconds * NSEC_PER_SEC));
    
    dispatch_after(popTime, dispatch_get_main_queue(), ^(void){
        [[Shield shared] setDeviceResultStateListener:^{
            [self sendEventWithName:@"device_result_state" body:@{@"status": @"isSDKReady"}];
        }];
    });
}


- (NSArray<NSString *> *)supportedEvents {
    return @[@"success", @"error", @"device_result_state"];
}

- (void)addListener:(NSString *)eventName {
  [super addListener:eventName];
}

- (void)removeListeners:(double)count {
  [super removeListeners:count];
}

- (void)didErrorWithError:(NSError *)error
{
    [self sendEventWithName:@"error" body:[error localizedDescription]];
}

- (void)didSuccessWithResult:(NSDictionary<NSString *,id> *)result
{
    [self sendEventWithName:@"success" body: result];
}

RCT_EXPORT_METHOD(sendAttributes: (NSString *)screenName data: (NSDictionary *)data)
{
    [[Shield shared] sendAttributesWithScreenName:screenName data:data];
}
@end



