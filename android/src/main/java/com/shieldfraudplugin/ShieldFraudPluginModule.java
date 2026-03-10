package com.shieldfraudplugin;

import android.app.Application;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import com.shield.android.BlockedDialog;
import com.shield.android.DeviceIntelligence;
import com.shield.android.Environment;
import com.shield.android.LogLevel;
import com.shield.android.Result;
import com.shield.android.Shield;
import com.shield.android.ShieldConfig;
import com.shield.android.ShieldCrossPlatformHelper;
import com.shield.android.ShieldCrossPlatformParams;
import com.shield.android.ShieldError;
import com.shield.android.ShieldFactory;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

/**
 * ShieldFraudPlugin native module — Shield SDK 2.x (pure Java)
 *
 * SDK 2.x migration summary
 * ─────────────────────────
 * 1. Initialisation     : Shield.Builder  →  ShieldConfig + ShieldFactory
 * 2. Instance access    : Shield.getInstance()  →  stored `shield` member
 * 3. Session ID         : Shield.getInstance().getSessionId()  →  shield.getSessionId()
 * 4. Device results     : setDeviceResultStateListener(callback)
 *                           →  ShieldFactory.createShieldWithCallback (SHIELD Sentinel)
 * 5. sendAttributes     : void return
 *                           →  shield.sendAttributesWithCallback (Result<String> callback)
 * 6. LogLevel enum      : Shield.LogLevel.VERBOSE/DEBUG/INFO/NONE
 *                           →  LogLevel.DEBUG / INFO / NONE  (VERBOSE removed)
 * 7. Environment enum   : String constants ENVIRONMENT_PROD / DEV / STAGING
 *                           →  Environment.PROD / DEV  (STAGING removed)
 *
 * Architecture segmentation
 * ─────────────────────────
 * Handled by Gradle source sets (not #ifdef).
 *   src/oldarch/ShieldFraudPluginSpec.java  →  extends ReactContextBaseJavaModule
 *   src/newarch/ShieldFraudPluginSpec.java  →  extends NativeShieldFraudPluginSpec (codegen)
 * This module always extends ShieldFraudPluginSpec.
 */
@ReactModule(name = ShieldFraudPluginModule.NAME)
public class ShieldFraudPluginModule extends com.shieldfraudplugin.ShieldFraudPluginSpec {

    public static final String NAME = "ShieldFraudPlugin";

    private final ReactApplicationContext reactContext;

    /**
     * Stored Shield instance — created once by ShieldFactory in initShield().
     * All subsequent calls use this reference instead of a singleton accessor.
     */
    @Nullable
    private Shield shield = null;


    public ShieldFraudPluginModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    @NonNull
    public String getName() {
        return NAME;
    }

    // =========================================================================
    // Synchronous state queries
    // =========================================================================

    @ReactMethod(isBlockingSynchronousMethod = true)
    public boolean isShieldInitialized() {
        return shield != null;
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public String getSessionId() {
        return shield != null ? shield.getSessionId() : "";
    }

    // =========================================================================
    // SDK initialisation  (Shield SDK 2.x — ShieldConfig + ShieldFactory)
    //
    // createShieldWithCallback both initialises the SDK and acts as the
    // SHIELD Sentinel callback — it fires on the initial fingerprint and on
    // every subsequent device intelligence update during the session.
    //
    // logLevel / environmentInfo arrive as `double` from both architectures:
    //   • Old Arch — JS bridge maps JS numbers to double.
    //   • New Arch — codegen generates double for TypeScript number params.
    // =========================================================================

    @ReactMethod
    public void initShield(
            String siteID,
            String secretKey,
            boolean isOptimizedListener,
            @Nullable ReadableMap blockedDialog,
            double logLevel,
            double environmentInfo,
            boolean blockScreenRecording,
            Promise promise) {

        if (isShieldInitialized()) {
            promise.resolve(null);
            return;
        }

        Application application = (Application) reactContext.getApplicationContext();

        ShieldConfig config = new ShieldConfig(siteID, secretKey);
        config.setLogLevel(getLogLevelFromInt((int) logLevel));
        config.setEnvironment(getEnvironmentFromInt((int) environmentInfo));

        if (blockedDialog != null) {
            String title = blockedDialog.hasKey("title") ? blockedDialog.getString("title") : null;
            String body  = blockedDialog.hasKey("body")  ? blockedDialog.getString("body")  : null;
            config.setBlockedDialog(new BlockedDialog(title, body));
        }

        // blockScreenRecording is Android-only. JS always sends a real boolean
        // (true/false, never null) so the Old Arch bridge can safely read it as
        // a primitive. Defaults to false when the user doesn't set it in Config.
        config.setBlockScreenRecording(blockScreenRecording);

        if (isOptimizedListener) {
            // SDK 2.x: createShieldWithCallback initialises + acts as the Sentinel.
            // Unlike 1.x (which required a separate setDeviceResultStateListener() call
            // on the SDK), 2.x fires this callback automatically when device intelligence
            // is ready and on every subsequent risk-profile change.
            // The callback may arrive on a background thread — always post to main looper.
            shield = ShieldFactory.createShieldWithCallback(
                    application,
                    config,
                    result -> new android.os.Handler(android.os.Looper.getMainLooper()).post(() -> {
                        if (result instanceof Result.Success) {
                            DeviceIntelligence di =
                                    ((Result.Success<DeviceIntelligence>) result).getData();
                            JSONObject json = di != null ? di.getData() : null;
                            emitEvent("success", json != null ? json.toString() : null);
                        } else if (result instanceof Result.Failure) {
                            ShieldError error =
                                    ((Result.Failure<DeviceIntelligence>) result).getError();
                            emitEvent("error", error.getErrorMessage());
                        }
                    }));
        } else {
            // createShield = initialise without the real-time Sentinel callback.
            // Use getLatestDeviceResult() to poll on demand instead.
            shield = ShieldFactory.createShield(application, config);
        }

        promise.resolve(null);
    }

    // =========================================================================
    // Cross-platform metadata
    // =========================================================================

    @ReactMethod
    public void setCrossPlatformParameters(String crossPlatformName, String crossPlatformVersion) {
        ShieldCrossPlatformParams params =
                new ShieldCrossPlatformParams(crossPlatformName, crossPlatformVersion);
        ShieldCrossPlatformHelper.setCrossPlatformParameters(params);
    }

    // =========================================================================
    // setDeviceResultStateListener — no-op stub (SDK 2.x)
    //
    // SDK 1.x required a manual subscription call + Handler.postDelayed workaround.
    // SDK 2.x fires device result events automatically via createShieldWithCallback
    // when isOptimizedListener == true — no subscription call needed.
    //
    // The method is kept as a no-op stub so the shared TypeScript codegen spec
    // and iOS (which still calls the SDK method) remain unaffected.
    // =========================================================================

    @ReactMethod
    public void setDeviceResultStateListener() {
        // No-op on Android SDK 2.x — device result events are delivered
        // automatically through the createShieldWithCallback Sentinel.
    }

    // =========================================================================
    // Retrieve the latest device intelligence result
    //
    // Returns Shield SDK's latest device result payload.
    // =========================================================================

    @ReactMethod
    public void getLatestDeviceResult(Callback successCallback, Callback errorCallback) {
        if (shield == null) {
            errorCallback.invoke("Shield SDK is not initialized.");
            return;
        }

        JSONObject json = shield.getLatestDeviceResult();
        if (json == null) {
            errorCallback.invoke("No device result available yet.");
            return;
        }

        successCallback.invoke(toWritableMap(json));
    }

    // =========================================================================
    // Send user / screen attributes  (Shield SDK 2.x — sendAttributesWithCallback)
    //
    // sendAttributesWithCallback delivers a Result<String> where the String
    // is the sessionId on success.
    // =========================================================================

    @ReactMethod
    public void sendAttributes(String screenName, ReadableMap json) {
        if (shield == null) return;

        Map<String, String> data = toStringMap(json);

        shield.sendAttributesWithCallback(screenName, data, result -> {
            if (result instanceof Result.Failure) {
                ShieldError error = ((Result.Failure<String>) result).getError();
                emitEvent("error", error.getErrorMessage());
            }
        });
    }

    @ReactMethod
    public void sendAttributesWithCallback(
            String screenName,
            ReadableMap json,
            Callback successCallback,
            Callback errorCallback) {
        if (shield == null) {
            errorCallback.invoke("Shield SDK is not initialized.");
            return;
        }

        Map<String, String> data = toStringMap(json);
        shield.sendAttributesWithCallback(screenName, data, result ->
                new android.os.Handler(android.os.Looper.getMainLooper()).post(() -> {
                    if (result instanceof Result.Success) {
                        successCallback.invoke(true);
                    } else if (result instanceof Result.Failure) {
                        ShieldError error = ((Result.Failure<String>) result).getError();
                        String errorMessage = error != null
                                ? error.getErrorMessage()
                                : "Failed to send attributes.";
                        errorCallback.invoke(errorMessage);
                    }
                })
        );
    }

    // =========================================================================
    // Send device signature
    //
    // Triggers a device signature computation for the given screen name.
    // On success the SDK calls back with the session ID (String); the latest
    // device result JSONObject is then retrieved via shield.getLatestDeviceResult().
    // =========================================================================

    @ReactMethod
    public void sendDeviceSignature(
            String screenName,
            Callback successCallback,
            Callback errorCallback) {
        if (shield == null) {
            errorCallback.invoke("Shield SDK is not initialized.");
            return;
        }

        shield.sendDeviceSignatureWithCallback(screenName, result ->
                new android.os.Handler(android.os.Looper.getMainLooper()).post(() -> {
                    if (result instanceof Result.Success) {
                        JSONObject json = shield.getLatestDeviceResult();
                        successCallback.invoke(json != null ? toWritableMap(json) : null);
                    } else if (result instanceof Result.Failure) {
                        ShieldError error = ((Result.Failure<String>) result).getError();
                        errorCallback.invoke(error != null
                                ? error.getErrorMessage()
                                : "Failed to send device signature.");
                    }
                })
        );
    }

    // =========================================================================
    // RCTEventEmitter stubs — required for compatibility on both architectures
    // =========================================================================

    @ReactMethod
    public void addListener(String eventName) {}

    @ReactMethod
    public void removeListeners(double count) {}

    // =========================================================================
    // Module teardown
    // =========================================================================

    @Override
    public void invalidate() {
        // Do not call super.invalidate() — ReactContextBaseJavaModule does not
        // declare invalidate() as a concrete method in older React Native versions
        // (it is only on the NativeModule interface), so super.invalidate() fails
        // to compile. Our own cleanup is all that is needed here.
        shield = null;
    }

    // =========================================================================
    // Internal helpers
    // =========================================================================

    private void emitEvent(String eventName, Object data) {
        reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, data);
    }

    private Map<String, String> toStringMap(ReadableMap json) {
        Map<String, String> data = new HashMap<>();
        for (Map.Entry<String, Object> entry : json.toHashMap().entrySet()) {
            if (entry.getValue() instanceof String) {
                data.put(entry.getKey(), (String) entry.getValue());
            }
        }
        return data;
    }

    private WritableMap toWritableMap(JSONObject jsonObject) {
        WritableMap map = Arguments.createMap();
        Iterator<String> keys = jsonObject.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            putValueInMap(map, key, jsonObject.opt(key));
        }
        return map;
    }

    private WritableArray toWritableArray(JSONArray jsonArray) {
        WritableArray array = Arguments.createArray();
        for (int i = 0; i < jsonArray.length(); i++) {
            pushValueInArray(array, jsonArray.opt(i));
        }
        return array;
    }

    private void putValueInMap(WritableMap map, String key, Object value) {
        if (value == null || value == JSONObject.NULL) {
            map.putNull(key);
        } else if (value instanceof Boolean) {
            map.putBoolean(key, (Boolean) value);
        } else if (value instanceof Number) {
            map.putDouble(key, ((Number) value).doubleValue());
        } else if (value instanceof JSONObject) {
            map.putMap(key, toWritableMap((JSONObject) value));
        } else if (value instanceof JSONArray) {
            map.putArray(key, toWritableArray((JSONArray) value));
        } else {
            map.putString(key, String.valueOf(value));
        }
    }

    private void pushValueInArray(WritableArray array, Object value) {
        if (value == null || value == JSONObject.NULL) {
            array.pushNull();
        } else if (value instanceof Boolean) {
            array.pushBoolean((Boolean) value);
        } else if (value instanceof Number) {
            array.pushDouble(((Number) value).doubleValue());
        } else if (value instanceof JSONObject) {
            array.pushMap(toWritableMap((JSONObject) value));
        } else if (value instanceof JSONArray) {
            array.pushArray(toWritableArray((JSONArray) value));
        } else {
            array.pushString(String.valueOf(value));
        }
    }

    /**
     * Maps JS logLevel integer → Shield SDK LogLevel enum.
     *
     *  JS LogLevel enum values (src/index.tsx):
     *    LogLevelVerbose = 4  →  LogLevel.VERBOSE
     *    LogLevelDebug   = 3  →  LogLevel.DEBUG
     *    LogLevelInfo    = 2  →  LogLevel.INFO
     *    LogLevelNone    = 1  →  LogLevel.NONE   (default)
     */
    private LogLevel getLogLevelFromInt(int logLevel) {
        switch (logLevel) {
            case 4:  return LogLevel.VERBOSE;
            case 3:  return LogLevel.DEBUG;
            case 2:  return LogLevel.INFO;
            default: return LogLevel.NONE;
        }
    }

    /**
     * Maps JS environmentInfo integer → Shield SDK Environment enum.
     *
     *  JS EnvironmentInfo enum values (src/index.tsx):
     *    EnvironmentProd    = 0  →  Environment.PROD     (default)
     *    EnvironmentDev     = 1  →  Environment.DEV
     *    EnvironmentStaging = 2  →  Environment.STAGING
     */
    private Environment getEnvironmentFromInt(int environment) {
        switch (environment) {
            case 1:  return Environment.DEV;
            case 2:  return Environment.STAGING;
            default: return Environment.PROD;
        }
    }
}
