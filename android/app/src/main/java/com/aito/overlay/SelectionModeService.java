package com.aito.overlay;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Gravity;
import android.view.WindowManager;
import android.content.pm.ServiceInfo;
import androidx.core.app.NotificationCompat;

/**
 * SelectionModeService - Independent foreground service for text selection
 * 
 * Features:
 * - Independent toggle mechanism for selection overlay
 * - Handles WORD and PARAGRAPH selection modes
 * - Manages SelectionOverlayView and ResultPopupView
 * - Completely separate from OverlayService
 */
public class SelectionModeService extends Service {
    private static final String TAG = "SelectionModeService";
    private static final String CHANNEL_ID = "selection_mode_channel";
    private static final int NOTIFICATION_ID = 2002;
    
    // Static instance for communication
    public static SelectionModeService instance = null;
    
    // Window Manager
    private WindowManager windowManager;
    
    // Views
    private SelectionOverlayView selectionView;
    private ResultPopupView resultPopupView;
    
    // Layout Params
    private WindowManager.LayoutParams selectionParams;
    private WindowManager.LayoutParams resultPopupParams;
    
    // State
    private boolean isOverlayVisible = false;
    private String selectionType = "PARAGRAPH"; // "WORD" or "PARAGRAPH"
    
    // Screen dimensions
    private int screenWidth;
    private int screenHeight;
    
    // Listener
    private OnSelectionEventListener listener;
    
    public interface OnSelectionEventListener {
        void onWordTapped(int x, int y);
        void onParagraphSelected(int x, int y, int width, int height);
        void onSelectionCancelled();
        void onResultPopupDismissed();
        void onOverlayToggled(boolean isVisible);
    }
    
    public void setOnSelectionEventListener(OnSelectionEventListener l) {
        this.listener = l;
    }
    
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
    
    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        Log.d(TAG, "SelectionModeService Created");
        
        createNotificationChannel();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, createNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIFICATION_ID, createNotification());
        }
        
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        
        // Get screen dimensions
        DisplayMetrics dm = getResources().getDisplayMetrics();
        screenWidth = dm.widthPixels;
        screenHeight = dm.heightPixels;
        
        createSelectionView();
        createResultPopupView();
    }
    
    private void createSelectionView() {
        selectionView = new SelectionOverlayView(this);
        selectionView.setOnSelectionListener(new SelectionOverlayView.OnSelectionListener() {
            @Override
            public void onWordTapped(int x, int y) {
                Log.d(TAG, "Word tapped at " + x + ", " + y);
                if (listener != null) {
                    listener.onWordTapped(x, y);
                }
            }
            
            @Override
            public void onParagraphSelected(int x, int y, int width, int height) {
                Log.d(TAG, "Paragraph selected: " + x + "," + y + " " + width + "x" + height);
                if (listener != null) {
                    listener.onParagraphSelected(x, y, width, height);
                }
            }
            
            @Override
            public void onSelectionCancelled() {
                Log.d(TAG, "Selection cancelled");
                if (listener != null) {
                    listener.onSelectionCancelled();
                }
            }
        });
        
        int layoutFlag = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? 
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : 
            WindowManager.LayoutParams.TYPE_PHONE;
        
        selectionParams = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                layoutFlag,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT);
        
        selectionParams.gravity = Gravity.TOP | Gravity.START;
    }
    
    private void createResultPopupView() {
        resultPopupView = new ResultPopupView(this);
        resultPopupView.setOnPopupEventListener(new ResultPopupView.OnPopupEventListener() {
            @Override
            public void onCloseClick() {
                Log.d(TAG, "Result popup: Close clicked");
                hideResultPopup();
                if (listener != null) {
                    listener.onResultPopupDismissed();
                }
            }
            
            @Override
            public void onOutsideTap() {
                Log.d(TAG, "Result popup: Outside tap");
                hideResultPopup();
                if (listener != null) {
                    listener.onResultPopupDismissed();
                }
            }
        });
        
        int layoutFlag = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? 
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : 
            WindowManager.LayoutParams.TYPE_PHONE;
        
        resultPopupParams = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                layoutFlag,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT);
        
        resultPopupParams.gravity = Gravity.TOP | Gravity.START;
    }
    
    // ==================== PUBLIC API ====================
    
    /**
     * Set selection type (WORD or PARAGRAPH)
     */
    public void setSelectionType(final String type) {
        new Handler(Looper.getMainLooper()).post(() -> {
            this.selectionType = type != null ? type : "PARAGRAPH";
            if (selectionView != null) {
                selectionView.setMode(selectionType);
            }
            Log.d(TAG, "Selection type set to: " + selectionType);
        });
    }
    
    /**
     * Toggle selection overlay visibility
     */
    public void toggleOverlay() {
        new Handler(Looper.getMainLooper()).post(() -> {
            if (isOverlayVisible) {
                hideOverlay();
            } else {
                showOverlay();
            }
        });
    }
    
    /**
     * Show selection overlay
     */
    public void showOverlay() {
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                if (selectionView == null) return;
                
                if (selectionView.getParent() == null) {
                    windowManager.addView(selectionView, selectionParams);
                }
                selectionView.setMode(selectionType);
                selectionView.setActive(true);
                isOverlayVisible = true;
                
                Log.d(TAG, "Selection overlay SHOWN (type: " + selectionType + ")");
                
                if (listener != null) {
                    listener.onOverlayToggled(true);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error showing overlay", e);
            }
        });
    }
    
    /**
     * Hide selection overlay
     */
    public void hideOverlay() {
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                if (selectionView != null) {
                    selectionView.setActive(false);
                    if (selectionView.getParent() != null) {
                        windowManager.removeView(selectionView);
                    }
                }
                isOverlayVisible = false;
                
                Log.d(TAG, "Selection overlay HIDDEN");
                
                if (listener != null) {
                    listener.onOverlayToggled(false);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error hiding overlay", e);
            }
        });
    }
    
    /**
     * Check if overlay is currently visible
     */
    public boolean isOverlayVisible() {
        return isOverlayVisible;
    }
    
    /**
     * Show result popup with translation
     */
    public void showResultPopup(final String originalText, final String translatedText, final int hintX, final int hintY) {
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                // Hide selection overlay while showing popup
                if (selectionView != null) {
                    selectionView.setActive(false);
                }
                
                // Show result popup
                if (resultPopupView.getParent() == null) {
                    windowManager.addView(resultPopupView, resultPopupParams);
                }
                resultPopupView.show(originalText, translatedText, hintX, hintY);
                
                Log.d(TAG, "Result popup shown");
            } catch (Exception e) {
                Log.e(TAG, "Error showing result popup", e);
            }
        });
    }
    
    /**
     * Hide result popup
     */
    public void hideResultPopup() {
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                if (resultPopupView != null) {
                    resultPopupView.hide();
                    if (resultPopupView.getParent() != null) {
                        windowManager.removeView(resultPopupView);
                    }
                }
                
                // Re-enable selection overlay if it was visible
                if (isOverlayVisible && selectionView != null) {
                    if (selectionView.getParent() == null) {
                        windowManager.addView(selectionView, selectionParams);
                    }
                    selectionView.setActive(true);
                }
                
                Log.d(TAG, "Result popup hidden");
            } catch (Exception e) {
                Log.e(TAG, "Error hiding result popup", e);
            }
        });
    }
    
    // ==================== NOTIFICATION ====================
    
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Selection Mode",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Selection mode for text translation");
            channel.setShowBadge(false);
            
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }
    
    private Notification createNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Selection Mode Active")
                .setContentText("Tap logo to toggle selection overlay")
                .setSmallIcon(android.R.drawable.ic_menu_edit)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .build();
    }
    
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }
    
    @Override
    public void onDestroy() {
        super.onDestroy();
        instance = null;
        
        try {
            if (selectionView != null && selectionView.getParent() != null) {
                windowManager.removeView(selectionView);
            }
            if (resultPopupView != null && resultPopupView.getParent() != null) {
                windowManager.removeView(resultPopupView);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error in onDestroy", e);
        }
        
        Log.d(TAG, "SelectionModeService Destroyed");
    }
}
