package com.shieldfraudplugin;

import androidx.annotation.NonNull;

import com.facebook.react.TurboReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.module.model.ReactModuleInfo;
import com.facebook.react.module.model.ReactModuleInfoProvider;

import java.util.HashMap;
import java.util.Map;

/**
 * Package registration for ShieldFraudPlugin — works on both architectures.
 *
 * Why TurboReactPackage instead of ReactPackage
 * ─────────────────────────────────────────────
 * TurboReactPackage is a drop-in replacement for the legacy ReactPackage that
 * adds support for Turbo Modules (New Architecture) while remaining fully
 * backward-compatible with the Old Architecture bridge.
 *
 * On Old Architecture the isTurboModule flag in ReactModuleInfo is simply
 * ignored and the module is loaded via the bridge as normal.
 * On New Architecture the flag tells the runtime to resolve the module through
 * the Turbo Module system (JSI) instead of the bridge.
 *
 * The isTurboModule flag is driven by BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
 * which build.gradle sets to true/false based on the newArchEnabled property:
 *
 *   buildConfigField "boolean", "IS_NEW_ARCHITECTURE_ENABLED",
 *                    isNewArchitectureEnabled().toString()
 */
public class ShieldFraudPluginPackage extends TurboReactPackage {

    // =========================================================================
    // Module instantiation
    // =========================================================================

    @Override
    public NativeModule getModule(@NonNull String name,
                                  @NonNull ReactApplicationContext reactContext) {
        if (name.equals(ShieldFraudPluginModule.NAME)) {
            return new ShieldFraudPluginModule(reactContext);
        }
        return null;
    }

    // =========================================================================
    // Module metadata
    //
    // ReactModuleInfoProvider returns the metadata the runtime needs to decide
    // how to load the module:
    //   • Old Arch  → isTurboModule=false → loaded via JS bridge
    //   • New Arch  → isTurboModule=true  → loaded via JSI (Turbo Module)
    // =========================================================================

    @Override
    public ReactModuleInfoProvider getReactModuleInfoProvider() {
        return () -> {
            final boolean isTurboModule = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED;
            Map<String, ReactModuleInfo> moduleInfos = new HashMap<>();
            moduleInfos.put(
                ShieldFraudPluginModule.NAME,
                new ReactModuleInfo(
                    ShieldFraudPluginModule.NAME,  // name
                    ShieldFraudPluginModule.NAME,  // className
                    false,                          // canOverrideExistingModule
                    false,                          // needsEagerInit
                    true,                           // hasConstants
                    false,                          // isCxxModule
                    isTurboModule                   // isTurboModule
                )
            );
            return moduleInfos;
        };
    }
}
