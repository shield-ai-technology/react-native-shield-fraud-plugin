package com.shieldfraudplugin;

import androidx.annotation.NonNull;

import com.facebook.react.TurboReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.module.model.ReactModuleInfo;
import com.facebook.react.module.model.ReactModuleInfoProvider;

import java.util.HashMap;
import java.util.Map;

/**
 * Package registration for ShieldFraudPlugin.
 *
 * Uses {@link TurboReactPackage} instead of the legacy {@link com.facebook.react.ReactPackage}
 * so that the module is correctly registered as a Turbo Module when New Architecture is enabled,
 * while remaining fully backward-compatible with Old Architecture builds.
 */
public class ShieldFraudPluginPackage extends TurboReactPackage {

    @Override
    public NativeModule getModule(@NonNull String name, @NonNull ReactApplicationContext reactContext) {
        if (name.equals(ShieldFraudPluginModule.NAME)) {
            return new ShieldFraudPluginModule(reactContext);
        }
        return null;
    }

    @Override
    public ReactModuleInfoProvider getReactModuleInfoProvider() {
        return () -> {
            Map<String, ReactModuleInfo> moduleInfos = new HashMap<>();
            // isTurboModule = true enables the Turbo Module path on New Architecture.
            // On Old Architecture the flag is ignored and the bridge path is used.
            boolean isTurboModule = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED;
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
