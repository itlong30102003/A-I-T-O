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

    @ReactMethod
    public void startOverlay(String text) {
        OverlayService.pendingBlocksJson = text;
        
        Intent intent = new Intent(getReactApplicationContext(), OverlayService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getReactApplicationContext().startForegroundService(intent);
        } else {
            getReactApplicationContext().startService(intent);
        }

        // Setup listeners and update translation blocks when service is ready
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
                setupServiceListeners();
                // Update translation blocks on the service
                if (OverlayService.instance != null && text != null && !text.isEmpty()) {
                    OverlayService.instance.updateTranslationBlocks(text);
                }
            }
        }, 500);
    }
    
    private void setupServiceListeners() {
        if (OverlayService.instance == null) return;
        
        OverlayService.instance.setOnLogoClickListener(new OverlayService.OnLogoClickListener() {
            @Override
            public void onClick() {
                emitEvent("onOverlayLogoClick", null);
            }
        });
        
        OverlayService.instance.setOnNavbarEventListener(new OverlayService.OnNavbarEventListener() {
            @Override
            public void onSourceLangClick() {
                emitEvent("onNavbarSourceLangClick", null);
            }
            
            @Override
            public void onTargetLangClick() {
                emitEvent("onNavbarTargetLangClick", null);
            }
        });
    }
    
    private void emitEvent(String eventName, Object data) {
        getReactApplicationContext()
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit(eventName, data);
    }

    @ReactMethod
    public void setInteractionEnabled(boolean enabled) {
        if (OverlayService.instance != null) {
            OverlayService.instance.setInteractionEnabled(enabled);
        }
    }

    @ReactMethod
    public void showLogo() {
        if (OverlayService.instance != null) {
            OverlayService.instance.showLogo();
        }
    }

    @ReactMethod
    public void hideLogo() {
        if (OverlayService.instance != null) {
            OverlayService.instance.hideLogo();
        }
    }
    
    @ReactMethod
    public void toggleNavbar() {
        if (OverlayService.instance != null) {
            OverlayService.instance.toggleNavbar();
        }
    }
    
    @ReactMethod
    public void setNavbarConfig(String mode, String sourceLang, String targetLang) {
        if (OverlayService.instance != null) {
            OverlayService.instance.setNavbarConfig(mode, sourceLang, targetLang);
        }
    }
    
    @ReactMethod
    public void showTranslation() {
        if (OverlayService.instance != null) {
            OverlayService.instance.showTranslation();
        }
    }
    
    @ReactMethod
    public void hideTranslation() {
        if (OverlayService.instance != null) {
            OverlayService.instance.hideTranslation();
        }
    }

    @ReactMethod
    public void stopOverlay() {
        Intent intent = new Intent(getReactApplicationContext(), OverlayService.class);
        getReactApplicationContext().stopService(intent);
    }
    
    @ReactMethod
    public void addListener(String eventName) {
        // Required for RN EventEmitter
    }

    @ReactMethod
    public void removeListeners(int count) {
        // Required for RN EventEmitter
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
