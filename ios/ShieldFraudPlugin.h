
#ifdef RCT_NEW_ARCH_ENABLED
// New Architecture: conform to the codegen-generated spec protocol.
// RCTEventEmitter is still used as the base so that sendEventWithName: works.
#import <React/RCTEventEmitter.h>
#if __has_include("RNShieldFraudPluginSpec.h")
#import "RNShieldFraudPluginSpec.h"
#else
#import <RNShieldFraudPluginSpec/RNShieldFraudPluginSpec.h>
#endif

@interface ShieldFraudPlugin : RCTEventEmitter <NativeShieldFraudPluginSpec>
#else
// Old Architecture: standard bridge module + event emitter.
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface ShieldFraudPlugin : RCTEventEmitter <RCTBridgeModule>
#endif

@end
