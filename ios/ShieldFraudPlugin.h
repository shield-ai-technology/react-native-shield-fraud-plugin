
#ifdef RCT_NEW_ARCH_ENABLED
// New Architecture: conform to the codegen-generated spec protocol.
// RCTEventEmitter is still used as the base so that sendEventWithName: works.
#import <React/RCTEventEmitter.h>
#import "RNShieldFraudPluginSpec.h"

@import ShieldFraud;

@interface ShieldFraudPlugin : RCTEventEmitter <NativeShieldFraudPluginSpec, DeviceShieldCallback>
#else
// Old Architecture: standard bridge module + event emitter.
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@import ShieldFraud;

@interface ShieldFraudPlugin : RCTEventEmitter <RCTBridgeModule, DeviceShieldCallback>
#endif

@end
