package com.aito.overlay;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;

import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.modules.core.DeviceEventManagerModule;

/**
 * OverlayModule - React Native bridge for OverlayService.
 * Handles general overlay permissions, logo visibility, navbar, and translation display.
 * Selection mode is now handled by SelectionModeModule.
 */
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
            promise.resolve(true);
        }
    }

    @ReactMethod
    public void requestPermission(Promise promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(getReactApplicationContext())) {
                permissionPromise = promise;
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

    /**
     * Run a task when OverlayService.instance is ready.
     * Polls every 100ms, up to 2 seconds.
     */
    private void runWhenServiceReady(Runnable task) {
        Handler handler = new Handler(Looper.getMainLooper());
        handler.post(new Runnable() {
            int attempts = 0;
            @Override
            public void run() {
                if (OverlayService.instance != null) {
                    task.run();
                } else if (attempts < 20) {
                    attempts++;
                    handler.postDelayed(this, 100);
                }
            }
        });
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

        runWhenServiceReady(() -> {
            setupServiceListeners();
            if (text != null && !text.isEmpty()) {
                OverlayService.instance.updateTranslationBlocks(text);
            }
        });
    }
    
    private void setupServiceListeners() {
        if (OverlayService.instance == null) return;
        
        OverlayService.instance.setOnLogoClickListener(() -> emitEvent("onOverlayLogoClick", null));
        
        OverlayService.instance.setOnNavbarEventListener(new OverlayService.OnNavbarEventListener() {
            @Override
            public void onSourceLangClick() {
                emitEvent("onNavbarSourceLangClick", null);
            }
            
            @Override
            public void onTargetLangClick() {
                emitEvent("onNavbarTargetLangClick", null);
            }
            
            @Override
            public void onTranslateClick() {
                emitEvent("onNavbarTranslateClick", null);
            }
            
            @Override
            public void onAutoModeClick() {
                emitEvent("onNavbarAutoModeClick", null);
            }
            
            @Override
            public void onCloseClick() {
                emitEvent("onNavbarCloseClick", null);
            }
        });
    }
    
    private void emitEvent(String eventName, Object data) {
        try {
            getReactApplicationContext()
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, data);
        } catch (Exception e) {
            // Context might not be ready
        }
    }

    @ReactMethod
    public void showLogo() {
        runWhenServiceReady(() -> OverlayService.instance.showLogo());
    }

    @ReactMethod
    public void hideLogo() {
        runWhenServiceReady(() -> OverlayService.instance.hideLogo());
    }
    
    @ReactMethod
    public void toggleNavbar() {
        runWhenServiceReady(() -> OverlayService.instance.toggleNavbar());
    }
    
    @ReactMethod
    public void setNavbarConfig(String mode, String sourceLang, String targetLang) {
        runWhenServiceReady(() -> OverlayService.instance.setNavbarConfig(mode, sourceLang, targetLang));
    }

    @ReactMethod
    public void setTranslating(boolean translating) {
        runWhenServiceReady(() -> OverlayService.instance.setTranslating(translating));
    }
    
    @ReactMethod
    public void showTranslation() {
        if (OverlayService.instance != null) OverlayService.instance.showTranslation();
    }
    
    @ReactMethod
    public void hideTranslation() {
        if (OverlayService.instance != null) OverlayService.instance.hideTranslation();
    }

    @ReactMethod
    public void setOverlayStyle(String style) {
        if (OverlayService.instance != null) OverlayService.instance.setOverlayStyle(style);
    }

    @ReactMethod
    public void setOverlayTextSize(double scale) {
        if (OverlayService.instance != null) OverlayService.instance.setOverlayTextSize((float) scale);
    }

    @ReactMethod
    public void stopOverlay() {
        Intent intent = new Intent(getReactApplicationContext(), OverlayService.class);
        getReactApplicationContext().stopService(intent);
    }
    
    @ReactMethod
    public void addListener(String eventName) {}

    @ReactMethod
    public void removeListeners(int count) {}

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
    public void onNewIntent(Intent intent) {}
}
