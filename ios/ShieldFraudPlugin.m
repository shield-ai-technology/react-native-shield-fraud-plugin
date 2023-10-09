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

RCT_EXPORT_METHOD(setDeviceResultStateListener:(RCTResponseSenderBlock)callback)
{
    [[Shield shared] setDeviceResultStateListener:^{
        callback(@[]);
    }];
}

- (NSArray<NSString *> *)supportedEvents {
    return @[@"success", @"error"];
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



