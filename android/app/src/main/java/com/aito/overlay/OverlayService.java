package com.aito.overlay;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.IBinder;
import android.view.View;
import android.view.Gravity;
import android.view.WindowManager;
import android.util.Log;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import androidx.core.app.NotificationCompat;
import android.view.MotionEvent;
import android.widget.ImageView;
import android.content.res.Resources;

public class OverlayService extends Service {
    private WindowManager windowManager;
    private OverlayView overlayView;
    private WindowManager.LayoutParams textParams;
    
    // Logo Floating Bubble
    private ImageView logoView;
    private WindowManager.LayoutParams logoParams;
    
    private static final String TAG = "OverlayService";
    private static final String CHANNEL_ID = "overlay_channel";
    private static final int NOTIFICATION_ID = 2001;
    
    public static OverlayService instance = null;
    public static String pendingBlocksJson = null;

    private OnLogoClickListener jsListener;

    public interface OnLogoClickListener {
        void onClick();
    }

    public void setOnLogoClickListener(OnLogoClickListener listener) {
        this.jsListener = listener;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);

        createNotificationChannel();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, createNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIFICATION_ID, createNotification());
        }

        setupTextOverlay();
        setupLogoOverlay();
    }

    private void setupTextOverlay() {
        overlayView = new OverlayView(this);
        int layoutFlag = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ?
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY :
                WindowManager.LayoutParams.TYPE_PHONE;

        textParams = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                layoutFlag,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | 
                WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE | 
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                PixelFormat.TRANSLUCENT);

        textParams.gravity = Gravity.TOP | Gravity.START;
        windowManager.addView(overlayView, textParams);
    }

    private void setupLogoOverlay() {
        logoView = new ImageView(this);
        
        // Load the aito_logo from resources
        int logoResId = getResources().getIdentifier("aito_logo", "drawable", getPackageName());
        if (logoResId != 0) {
            logoView.setImageResource(logoResId);
        } else {
            // Fallback if resource not found
            logoView.setBackgroundColor(Color.BLUE);
        }

        int size = dpToPx(64);
        int layoutFlag = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ?
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY :
                WindowManager.LayoutParams.TYPE_PHONE;

        logoParams = new WindowManager.LayoutParams(
                size, size,
                layoutFlag,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                PixelFormat.TRANSLUCENT);

        logoParams.gravity = Gravity.TOP | Gravity.START;
        logoParams.x = 100;
        logoParams.y = 500;
        
        // Hide by default
        logoView.setVisibility(View.GONE);

        // Implement Drag and Click
        logoView.setOnTouchListener(new View.OnTouchListener() {
            private int initialX, initialY;
            private float initialTouchX, initialTouchY;
            private long lastTouchTime = 0;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        initialX = logoParams.x;
                        initialY = logoParams.y;
                        initialTouchX = event.getRawX();
                        initialTouchY = event.getRawY();
                        lastTouchTime = System.currentTimeMillis();
                        return true;
                    case MotionEvent.ACTION_UP:
                        long clickDuration = System.currentTimeMillis() - lastTouchTime;
                        if (clickDuration < 200) {
                            if (jsListener != null) jsListener.onClick();
                        }
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        logoParams.x = initialX + (int) (event.getRawX() - initialTouchX);
                        logoParams.y = initialY + (int) (event.getRawY() - initialTouchY);
                        windowManager.updateViewLayout(logoView, logoParams);
                        return true;
                }
                return false;
            }
        });

        windowManager.addView(logoView, logoParams);
    }

    public void setInteractionEnabled(final boolean enabled) {
        new android.os.Handler(android.os.Looper.getMainLooper()).post(new Runnable() {
            @Override
            public void run() {
                if (textParams == null || windowManager == null || overlayView == null) return;
                if (enabled) {
                    textParams.flags &= ~WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE;
                } else {
                    textParams.flags |= WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE;
                }
                try {
                    windowManager.updateViewLayout(overlayView, textParams);
                } catch (Exception e) {
                    Log.e(TAG, "Error updating text overlay layout", e);
                }
            }
        });
    }

    public void showLogo(final int x, final int y) {
        new android.os.Handler(android.os.Looper.getMainLooper()).post(new Runnable() {
            @Override
            public void run() {
                if (logoView != null && windowManager != null) {
                    logoParams.x = x;
                    logoParams.y = y;
                    try {
                        windowManager.updateViewLayout(logoView, logoParams);
                        logoView.setVisibility(View.VISIBLE);
                    } catch (Exception e) {
                        Log.e(TAG, "Error showing logo", e);
                    }
                }
            }
        });
    }

    public void hideLogo() {
        new android.os.Handler(android.os.Looper.getMainLooper()).post(new Runnable() {
            @Override
            public void run() {
                if (logoView != null) {
                    logoView.setVisibility(View.GONE);
                }
            }
        });
    }

    private int dpToPx(int dp) {
        return (int) (dp * Resources.getSystem().getDisplayMetrics().density);
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
        if (pendingBlocksJson != null && overlayView != null) {
            overlayView.updateBlocks(pendingBlocksJson);
            pendingBlocksJson = null;
        }
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
        instance = null;
        if (overlayView != null) {
            windowManager.removeView(overlayView);
            overlayView = null;
        }
        Log.d(TAG, "Overlay Service Destroyed");
    }
}
