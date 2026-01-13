package com.aito.overlay;

import android.app.Service;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.IBinder;
import android.view.Gravity;
import android.view.WindowManager;
import android.util.Log;

public class OverlayService extends Service {
    private WindowManager windowManager;
    private OverlayView overlayView;
    private static final String TAG = "OverlayService";

    @Override
    public IBinder onBind(Intent intent) {
        return null; // Not binding
    }

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Overlay Service Created");

        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        
        // Initialize our custom view
        overlayView = new OverlayView(this);

        int layoutFlag;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            layoutFlag = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
        } else {
            layoutFlag = WindowManager.LayoutParams.TYPE_PHONE;
        }

        // Full screen, pass-through touches
        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                layoutFlag,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | 
                WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE | 
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                PixelFormat.TRANSLUCENT);

        params.gravity = Gravity.TOP | Gravity.START;
        params.x = 0;
        params.y = 0;

        try {
            windowManager.addView(overlayView, params);
            Log.d(TAG, "Overlay View Added");
        } catch (Exception e) {
            Log.e(TAG, "Error adding view: " + e.getMessage());
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && intent.hasExtra("text")) {
            String jsonString = intent.getStringExtra("text");
            if (overlayView != null) {
                overlayView.updateBlocks(jsonString);
            }
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (overlayView != null) {
            windowManager.removeView(overlayView);
            overlayView = null;
        }
        Log.d(TAG, "Overlay Service Destroyed");
    }
}
