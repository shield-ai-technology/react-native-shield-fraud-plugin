#import "ShieldFraudPlugin.h"

@implementation ShieldFraudPlugin

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(initShield:(NSString *)siteID secretKey:(NSString *)secretKey isOptimizedListener:(BOOL)isOptimizedListener blockedDialog:(NSDictionary *)blockedDialog logLevel:(NSInteger)logLevel environmentInfo:(NSInteger)environmentInfo)
{
    NSLog(@"siteId : %@ and secret key: %@", siteID, secretKey);
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
}

// get session id from shield sdk
RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(getSessionId) {
    NSLog(@"SHIELD:: get sessionID");
    return [[Shield shared]sessionId];
}

// get device result to shield
RCT_EXPORT_METHOD(getDeviceResult:(RCTResponseSenderBlock)successCallback errorCallback: (RCTResponseSenderBlock)errorCallback)
{
    [[Shield shared] setDeviceResultStateListener:^{ // check whether device result assessment is complete
        NSDictionary<NSString *, id> *result = [[Shield shared] getLatestDeviceResult];
        if (result != NULL) {
            successCallback(@[result]);
        }
        
        NSError *error = [[Shield shared] getErrorResponse];
        if (error != NULL) {
            errorCallback(@[error]);
        }
    }];
}

- (NSArray<NSString *> *)supportedEvents {
    return @[@"success", @"error"];
}

- (void)didErrorWithError:(NSError *)error
{
    [self sendEventWithName:@"error" body: error];
}

- (void)didSuccessWithResult:(NSDictionary<NSString *,id> *)result
{
    [self sendEventWithName:@"success" body: result];
}

RCT_EXPORT_METHOD(sendAttributes: (NSString *)screenName data: (NSDictionary *)data)
{
    [[Shield shared] setDeviceResultStateListener:^{ // check whether device fingerprinting is completed
        [[Shield shared] sendAttributesWithScreenName:screenName data:data];
    }];
}


@end



