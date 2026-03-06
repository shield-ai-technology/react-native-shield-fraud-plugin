package com.shieldfraudplugin;

import com.facebook.react.bridge.ReactApplicationContext;

/**
 * New Architecture base class for ShieldFraudPluginModule.
 *
 * On New Architecture, React Native codegen produces
 * NativeShieldFraudPluginSpec (from the TypeScript spec in
 * src/NativeShieldFraudPlugin.ts).  This shim extends that generated
 * class so ShieldFraudPluginModule only needs to extend ShieldFraudPluginSpec
 * on both architectures.
 */
abstract class ShieldFraudPluginSpec extends NativeShieldFraudPluginSpec {

    ShieldFraudPluginSpec(ReactApplicationContext context) {
        super(context);
    }
}
