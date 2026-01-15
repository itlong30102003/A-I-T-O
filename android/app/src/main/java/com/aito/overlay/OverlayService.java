package com.aito.overlay;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.IBinder;
import android.view.Gravity;
import android.view.WindowManager;
import android.util.Log;
import android.content.pm.ServiceInfo;
import androidx.core.app.NotificationCompat;

public class OverlayService extends Service {
    private WindowManager windowManager;
    private OverlayView overlayView;
    private static final String TAG = "OverlayService";
    private static final String CHANNEL_ID = "overlay_channel";
    private static final int NOTIFICATION_ID = 2001;
    
    // Static reference to avoid TransactionTooLarge when passing large data via Intent
    public static String pendingBlocksJson = null;

    @Override
    public IBinder onBind(Intent intent) {
        return null; // Not binding
    }

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Overlay Service Created");

        // Start as foreground service (required for Android 8+)
        createNotificationChannel();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, createNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIFICATION_ID, createNotification());
        }

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

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Translation Overlay",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Shows translated text overlay");
            channel.setShowBadge(false);
            
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification createNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Translation Overlay Active")
                .setContentText("Displaying translated text")
                .setSmallIcon(android.R.drawable.ic_menu_view)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .build();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // First check static reference (preferred method to avoid TransactionTooLarge)
        if (pendingBlocksJson != null && overlayView != null) {
            overlayView.updateBlocks(pendingBlocksJson);
            pendingBlocksJson = null; // Clear after use
        }
        // Fallback to intent extras for backward compatibility (small data only)
        else if (intent != null && intent.hasExtra("text")) {
            String jsonString = intent.getStringExtra("text");
            if (overlayView != null && jsonString != null) {
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
