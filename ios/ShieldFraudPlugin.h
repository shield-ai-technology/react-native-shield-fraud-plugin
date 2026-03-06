
#ifdef RCT_NEW_ARCH_ENABLED
// New Architecture: conform to the codegen-generated spec protocol.
// RCTEventEmitter is still used as the base so that sendEventWithName: works.
#import <React/RCTEventEmitter.h>
#import "RNShieldFraudPluginSpec.h"

// Forward-declare the protocol — the full definition is imported in the .mm file.
// A forward declaration is sufficient for the @interface conformance declaration.
@protocol DeviceShieldCallback;

@interface ShieldFraudPlugin : RCTEventEmitter <NativeShieldFraudPluginSpec, DeviceShieldCallback>
#else
// Old Architecture: standard bridge module + event emitter.
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

// Forward-declare the protocol — full definition imported in the .mm file.
@protocol DeviceShieldCallback;

@interface ShieldFraudPlugin : RCTEventEmitter <RCTBridgeModule, DeviceShieldCallback>
#endif

@end
