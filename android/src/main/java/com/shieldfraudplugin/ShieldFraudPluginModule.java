package com.shieldfraudplugin;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.module.annotations.ReactModule;

import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.shield.android.BlockedDialog;
import com.shield.android.Shield;
import com.shield.android.ShieldCallback;
import com.shield.android.ShieldException;
import com.shield.android.ShieldCrossPlatformParams;
import com.shield.android.ShieldCrossPlatformHelper;

import org.json.JSONObject;

import java.util.HashMap;
import java.util.Map;

import javax.annotation.Nonnull;
import javax.annotation.Nullable;

@ReactModule(name = ShieldFraudPluginModule.NAME)
public class ShieldFraudPluginModule extends ReactContextBaseJavaModule implements ShieldCallback<JSONObject> {
    public static final String NAME = "ShieldFraudPlugin";
    private final ReactApplicationContext reactContext;

    public ShieldFraudPluginModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    @NonNull
    public String getName() {
        return NAME;
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public boolean isShieldInitialized() {
        try {
            return Shield.getInstance() != null;
        } catch (IllegalStateException e) {
            return false;
        }
    }

    @ReactMethod
    public void initShield(String siteID, String secretKey, Boolean isOptimizedListener, ReadableMap blockedDialog, Integer logLevel, Integer environment) {
        if (isShieldInitialized()) {
            return;
        }
        Activity currentActivity = getCurrentActivity();
        if (currentActivity != null) {
            Shield.Builder builder = new Shield.Builder(currentActivity, siteID, secretKey)
                    .setAutoBlockDialog(getBlockedDialogFromReadableMap(blockedDialog));

            if (isOptimizedListener) {
                builder.registerDeviceShieldCallback(this);
            }

            String environmentString = getEnvironmentStringFromInteger(environment);
            builder.setEnvironment(environmentString);

            Shield.LogLevel logLevelEnum = getLogLevelEnumFromInteger(logLevel);
            builder.setLogLevel(logLevelEnum);

            Shield shield = builder.build();
            Shield.setSingletonInstance(shield);
        }
    }

    @ReactMethod
    public void setCrossPlatformParameters(String crossPlatformName, String crossPlatformVersion) {
        ShieldCrossPlatformParams params = new ShieldCrossPlatformParams(crossPlatformName, crossPlatformVersion);
        ShieldCrossPlatformHelper.setCrossPlatformParameters(params);
    }

    private BlockedDialog getBlockedDialogFromReadableMap(ReadableMap blockedDialog) {
        if (blockedDialog != null) {
            String title = blockedDialog.hasKey("title") ? blockedDialog.getString("title") : null;
            String body = blockedDialog.hasKey("body") ? blockedDialog.getString("body") : null;
            return new BlockedDialog(title, body);
        }
        return null;
    }

    private String getEnvironmentStringFromInteger(Integer environment) {
        String environmentString;
        switch (environment) {
            case 1:
                environmentString = Shield.ENVIRONMENT_DEV;
                break;
            case 2:
                environmentString = Shield.ENVIRONMENT_STAGING;
                break;
            default:
                environmentString = Shield.ENVIRONMENT_PROD;
                break;
        }
        return environmentString;
    }

    private Shield.LogLevel getLogLevelEnumFromInteger(Integer logLevel) {
        Shield.LogLevel logLevelEnum;
        switch (logLevel) {
            case 1:
                logLevelEnum = Shield.LogLevel.NONE;
                break;
            case 2:
                logLevelEnum = Shield.LogLevel.INFO;
                break;
            case 3:
                logLevelEnum = Shield.LogLevel.DEBUG;
                break;
            default:
                logLevelEnum = Shield.LogLevel.VERBOSE;
                break;
        }
        return logLevelEnum;
    }

    @ReactMethod
    public void setDeviceResultStateListener() {
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
                Shield.getInstance().setDeviceResultStateListener(new Shield.DeviceResultStateListener() {
                    @Override
                    public void isReady() {
                        // Emit an event when the device is ready
                        WritableMap params = Arguments.createMap();
                        params.putString("status", "isSDKReady");
                        reactContext
                                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                                .emit("device_result_state", params);
                    }
                });
            }
        }, 1500);
    }


    @ReactMethod(isBlockingSynchronousMethod = true)
    public String getSessionId() {
        return Shield.getInstance().getSessionId();
    }

    @Override
    public void onSuccess(@Nullable JSONObject jsonObject) {
        if (jsonObject != null) {
            reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit("success", jsonObject.toString());
        }
    }

    @Override
    public void onFailure(@Nullable ShieldException e) {
        if (e != null) {
            reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit("error", e.getLocalizedMessage());
        }

    }

    @ReactMethod
    public void sendAttributes(String screenName, ReadableMap json) {
        HashMap<String, String> data = new HashMap<String, String>();
        for (Map.Entry<String, Object> entry : json.toHashMap().entrySet()) {
            data.put(entry.getKey(), (String) entry.getValue());
        }
        Shield.getInstance().sendAttributes(screenName, data);
    }

    @ReactMethod
    public void getLatestDeviceResult(Callback successCallback, Callback errorCallback) {
        Shield shieldInstance = Shield.getInstance();
        JSONObject deviceResult = shieldInstance.getLatestDeviceResult();
    
        if (deviceResult != null) {
            successCallback.invoke(deviceResult.toString());
        } else {
            ShieldException error = shieldInstance.getResponseError();
            String errorMessage = (error != null) ? error.getMessage() : "unknown error";
            errorCallback.invoke(errorMessage);
        }
    } 
    @ReactMethod
    public void addListener(String eventName) {
        // Code to handle adding listeners
    }
    
    @ReactMethod
    public void removeListeners(int count) {
        // Code to handle removing listeners
    }
}
