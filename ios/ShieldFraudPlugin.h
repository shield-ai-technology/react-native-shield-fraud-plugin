
#ifdef RCT_NEW_ARCH_ENABLED
#import "RNShieldFraudPluginSpec.h"

@interface ShieldFraudPlugin : NSObject <NativeShieldFraudPluginSpec>
#else
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@import ShieldFraud;

@interface ShieldFraudPlugin : RCTEventEmitter <RCTBridgeModule, DeviceShieldCallback>
#endif

@end
