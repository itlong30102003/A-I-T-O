package com.aito.overlay;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class OverlayModule extends ReactContextBaseJavaModule implements ActivityEventListener {
    private static final int DRAW_OVER_OTHER_APP_PERMISSION_REQUEST_CODE = 1234;
    private Promise permissionPromise;

    public OverlayModule(ReactApplicationContext reactContext) {
        super(reactContext);
        reactContext.addActivityEventListener(this);
    }

    @Override
    public String getName() {
        return "OverlayModule";
    }

    @ReactMethod
    public void checkPermission(Promise promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            promise.resolve(Settings.canDrawOverlays(getReactApplicationContext()));
        } else {
            promise.resolve(true); // Always true for older versions
        }
    }

    @ReactMethod
    public void requestPermission(Promise promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(getReactApplicationContext())) {
                permissionPromise = promise; // Save promise to resolve later
                Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + getReactApplicationContext().getPackageName()));
                getCurrentActivity().startActivityForResult(intent, DRAW_OVER_OTHER_APP_PERMISSION_REQUEST_CODE);
            } else {
                promise.resolve(true);
            }
        } else {
            promise.resolve(true);
        }
    }

    @ReactMethod
    public void startOverlay(String text) {
        OverlayService.pendingBlocksJson = text;
        
        Intent intent = new Intent(getReactApplicationContext(), OverlayService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getReactApplicationContext().startForegroundService(intent);
        } else {
            getReactApplicationContext().startService(intent);
        }

        // Setup listener when service starts
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
                if (OverlayService.instance != null) {
                    OverlayService.instance.setOnLogoClickListener(new OverlayService.OnLogoClickListener() {
                        @Override
                        public void onClick() {
                            getReactApplicationContext()
                                .getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                                .emit("onOverlayLogoClick", null);
                        }
                    });
                }
            }
        }, 500);
    }

    @ReactMethod
    public void setInteractionEnabled(boolean enabled) {
        if (OverlayService.instance != null) {
            OverlayService.instance.setInteractionEnabled(enabled);
        }
    }

    @ReactMethod
    public void showLogo(int x, int y) {
        if (OverlayService.instance != null) {
            OverlayService.instance.showLogo(x, y);
        }
    }

    @ReactMethod
    public void hideLogo() {
        if (OverlayService.instance != null) {
            OverlayService.instance.hideLogo();
        }
    }

    @ReactMethod
    public void stopOverlay() {
        Intent intent = new Intent(getReactApplicationContext(), OverlayService.class);
        getReactApplicationContext().stopService(intent);
    }

    @Override
    public void onActivityResult(Activity activity, int requestCode, int resultCode, Intent data) {
        if (requestCode == DRAW_OVER_OTHER_APP_PERMISSION_REQUEST_CODE) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (permissionPromise != null) {
                    permissionPromise.resolve(Settings.canDrawOverlays(getReactApplicationContext()));
                    permissionPromise = null;
                }
            }
        }
    }

    @Override
    public void onNewIntent(Intent intent) {
        // Not used
    }
}
