package com.aito.overlay;

import android.app.Service;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.IBinder;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.TextView;
import android.util.Log;

public class OverlayService extends Service {
    private WindowManager windowManager;
    private TextView floatingView;
    private static final String TAG = "OverlayService";

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Overlay Service Created");

        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        
        // Add the view to the window.
        floatingView = new TextView(this);
        floatingView.setText("Hello Overlay!");
        floatingView.setTextColor(Color.WHITE);
        floatingView.setBackgroundColor(Color.argb(150, 0, 0, 0)); // Semi-transparent black
        floatingView.setPadding(30, 20, 30, 20);
        floatingView.setTextSize(16f);

        int layoutFlag;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            layoutFlag = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
        } else {
            layoutFlag = WindowManager.LayoutParams.TYPE_PHONE;
        }

        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                layoutFlag,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | 
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                PixelFormat.TRANSLUCENT);

        params.gravity = Gravity.TOP | Gravity.START;
        params.x = 100;
        params.y = 200;

        try {
            windowManager.addView(floatingView, params);
            Log.d(TAG, "Overlay View Added");
        } catch (Exception e) {
            Log.e(TAG, "Error adding view: " + e.getMessage());
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && intent.hasExtra("text")) {
            String updatedText = intent.getStringExtra("text");
            if (floatingView != null) {
                floatingView.setText(updatedText);
            }
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (floatingView != null) {
            windowManager.removeView(floatingView);
            floatingView = null;
        }
        Log.d(TAG, "Overlay Service Destroyed");
    }
}
