package com.shieldfraudplugin;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;

/**
 * Old Architecture base class for ShieldFraudPluginModule.
 *
 * Selected by Gradle when newArchEnabled=false (the default).
 * Extends ReactContextBaseJavaModule — the standard base class for modules
 * that communicate with JS over the legacy bridge.
 *
 * How the source-set swap works
 * ─────────────────────────────
 * build.gradle adds either src/oldarch or src/newarch to the Java source
 * directories depending on the newArchEnabled project property:
 *
 *   sourceSets {
 *     main {
 *       if (isNewArchitectureEnabled()) {
 *         java.srcDirs += ['src/newarch']   // this file is excluded
 *       } else {
 *         java.srcDirs += ['src/oldarch']   // this file is included
 *       }
 *     }
 *   }
 *
 * ShieldFraudPluginModule (in src/main/) always extends ShieldFraudPluginSpec,
 * so it compiles correctly regardless of which shim is selected.
 */
abstract class ShieldFraudPluginSpec extends ReactContextBaseJavaModule {

    ShieldFraudPluginSpec(ReactApplicationContext context) {
        super(context);
    }
}
