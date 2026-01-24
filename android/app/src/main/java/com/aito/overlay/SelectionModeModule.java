package com.aito.overlay;

import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

/**
 * SelectionModeModule - React Native bridge for SelectionModeService
 */
public class SelectionModeModule extends ReactContextBaseJavaModule {
    private static final String TAG = "SelectionModeModule";
    
    public SelectionModeModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }
    
    @Override
    public String getName() {
        return "SelectionModeModule";
    }
    
    /**
     * Start selection mode service
     * @param type - "WORD" or "PARAGRAPH"
     */
    @ReactMethod
    public void start(String type) {
        Intent intent = new Intent(getReactApplicationContext(), SelectionModeService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getReactApplicationContext().startForegroundService(intent);
        } else {
            getReactApplicationContext().startService(intent);
        }
        
        // Setup listener after service starts
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            setupServiceListener();
            if (SelectionModeService.instance != null) {
                SelectionModeService.instance.setSelectionType(type);
            }
        }, 300);
    }
    
    /**
     * Stop selection mode service
     */
    @ReactMethod
    public void stop() {
        if (SelectionModeService.instance != null) {
            SelectionModeService.instance.hideOverlay();
            SelectionModeService.instance.hideResultPopup();
        }
        Intent intent = new Intent(getReactApplicationContext(), SelectionModeService.class);
        getReactApplicationContext().stopService(intent);
    }
    
    /**
     * Toggle selection overlay visibility
     */
    @ReactMethod
    public void toggleOverlay() {
        if (SelectionModeService.instance != null) {
            SelectionModeService.instance.toggleOverlay();
        }
    }
    
    /**
     * Show selection overlay
     */
    @ReactMethod
    public void showOverlay() {
        if (SelectionModeService.instance != null) {
            SelectionModeService.instance.showOverlay();
        }
    }
    
    /**
     * Hide selection overlay
     */
    @ReactMethod
    public void hideOverlay() {
        if (SelectionModeService.instance != null) {
            SelectionModeService.instance.hideOverlay();
        }
    }
    
    /**
     * Check if overlay is visible
     */
    @ReactMethod
    public void isOverlayVisible(Promise promise) {
        if (SelectionModeService.instance != null) {
            promise.resolve(SelectionModeService.instance.isOverlayVisible());
        } else {
            promise.resolve(false);
        }
    }
    
    /**
     * Set selection type (WORD or PARAGRAPH)
     */
    @ReactMethod
    public void setSelectionType(String type) {
        if (SelectionModeService.instance != null) {
            SelectionModeService.instance.setSelectionType(type);
        }
    }
    
    /**
     * Show result popup
     */
    @ReactMethod
    public void showResultPopup(String originalText, String translatedText, int hintX, int hintY) {
        if (SelectionModeService.instance != null) {
            SelectionModeService.instance.showResultPopup(originalText, translatedText, hintX, hintY);
        }
    }
    
    /**
     * Hide result popup
     */
    @ReactMethod
    public void hideResultPopup() {
        if (SelectionModeService.instance != null) {
            SelectionModeService.instance.hideResultPopup();
        }
    }
    
    private void setupServiceListener() {
        if (SelectionModeService.instance == null) return;
        
        SelectionModeService.instance.setOnSelectionEventListener(new SelectionModeService.OnSelectionEventListener() {
            @Override
            public void onWordTapped(int x, int y) {
                WritableMap params = Arguments.createMap();
                params.putInt("x", x);
                params.putInt("y", y);
                emitEvent("onSelectionWordTapped", params);
            }
            
            @Override
            public void onParagraphSelected(int x, int y, int width, int height) {
                WritableMap params = Arguments.createMap();
                params.putInt("x", x);
                params.putInt("y", y);
                params.putInt("width", width);
                params.putInt("height", height);
                emitEvent("onSelectionParagraphSelected", params);
            }
            
            @Override
            public void onSelectionCancelled() {
                emitEvent("onSelectionCancelled", null);
            }
            
            @Override
            public void onResultPopupDismissed() {
                emitEvent("onSelectionPopupDismissed", null);
            }
            
            @Override
            public void onOverlayToggled(boolean isVisible) {
                WritableMap params = Arguments.createMap();
                params.putBoolean("isVisible", isVisible);
                emitEvent("onSelectionOverlayToggled", params);
            }
        });
    }
    
    private void emitEvent(String eventName, Object data) {
        try {
            getReactApplicationContext()
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, data);
        } catch (Exception e) {
            // Ignore if JS context not available
        }
    }
    
    @ReactMethod
    public void addListener(String eventName) {
        // Required for RN EventEmitter
    }
    
    @ReactMethod
    public void removeListeners(int count) {
        // Required for RN EventEmitter
    }
}
