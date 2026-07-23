
#ifdef RCT_NEW_ARCH_ENABLED
// New Architecture: conform to the codegen-generated spec protocol.
// RCTEventEmitter is still used as the base so that sendEventWithName: works.
#import <React/RCTEventEmitter.h>
#import "RNShieldFraudPluginSpec.h"

@interface ShieldFraudPlugin : RCTEventEmitter <NativeShieldFraudPluginSpec>
#else
// Old Architecture: standard bridge module + event emitter.
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface ShieldFraudPlugin : RCTEventEmitter <RCTBridgeModule>
#endif

@end
