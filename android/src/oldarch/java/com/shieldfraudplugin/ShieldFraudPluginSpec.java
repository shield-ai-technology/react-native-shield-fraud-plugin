package com.shieldfraudplugin;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.ReadableMap;

/**
 * Old Architecture base class for ShieldFraudPluginModule.
 *
 * On Old Architecture this simply extends ReactContextBaseJavaModule,
 * which is the standard bridge module base class.
 */
abstract class ShieldFraudPluginSpec extends ReactContextBaseJavaModule {

    ShieldFraudPluginSpec(ReactApplicationContext context) {
        super(context);
    }
}
