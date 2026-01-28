package com.aito.overlay;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.graphics.RectF;
import java.util.List;
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
    private LoadingIndicatorView loadingView;
    private TextHighlightView highlightView;
    
    // Layout Params
    private WindowManager.LayoutParams selectionParams;
    private WindowManager.LayoutParams resultPopupParams;
    private WindowManager.LayoutParams loadingParams;
    private WindowManager.LayoutParams highlightParams;
    
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
        void onSelectionStarted(); // New: fired when user starts drawing new selection
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
        createLoadingView();
        createHighlightView();
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
            
            @Override
            public void onSelectionStarted() {
                Log.d(TAG, "Selection started");
                if (listener != null) {
                    listener.onSelectionStarted();
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
    
    private void createLoadingView() {
        loadingView = new LoadingIndicatorView(this);
        
        int layoutFlag = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? 
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : 
            WindowManager.LayoutParams.TYPE_PHONE;
        
        loadingParams = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                layoutFlag,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
                WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE |
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT);
        
        loadingParams.gravity = Gravity.TOP | Gravity.START;
    }
    
    private void createHighlightView() {
        highlightView = new TextHighlightView(this);
        
        int layoutFlag = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? 
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : 
            WindowManager.LayoutParams.TYPE_PHONE;
        
        highlightParams = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                layoutFlag,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
                WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE |
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT);
        
        highlightParams.gravity = Gravity.TOP | Gravity.START;
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
     * Update detected text bounding boxes for pre-scan WORD mode
     * @param boxes List of RectF representing text element bounding boxes
     */
    public void updateDetectedBoxes(final List<RectF> boxes) {
        new Handler(Looper.getMainLooper()).post(() -> {
            if (selectionView != null) {
                selectionView.setDetectedBoxes(boxes);
            }
            Log.d(TAG, "Updated detected boxes: " + (boxes != null ? boxes.size() : 0) + " boxes");
        });
    }
    
    /**
     * Clear all detected boxes
     */
    public void clearDetectedBoxes() {
        new Handler(Looper.getMainLooper()).post(() -> {
            if (selectionView != null) {
                selectionView.clearDetectedBoxes();
            }
            Log.d(TAG, "Cleared detected boxes");
        });
    }
    
    /**
     * Update the persistent selection highlight (for PARAGRAPH mode smart snap)
     * @param x Left coordinate (bitmap coordinates)
     * @param y Top coordinate (bitmap coordinates)
     * @param width Width of highlight
     * @param height Height of highlight
     */
    public void updateSelectionHighlight(final int x, final int y, final int width, final int height) {
        new Handler(Looper.getMainLooper()).post(() -> {
            if (selectionView != null) {
                selectionView.updateHighlightBox(x, y, width, height);
            }
            Log.d(TAG, "Updated selection highlight: (" + x + "," + y + ") " + width + "x" + height);
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
     * Show loading indicator at position
     */
    public void showLoadingAt(final int x, final int y) {
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                if (loadingView == null) return;
                
                if (loadingView.getParent() == null) {
                    windowManager.addView(loadingView, loadingParams);
                }
                loadingView.showAt(x, y);
                
                Log.d(TAG, "Loading indicator shown at " + x + ", " + y);
            } catch (Exception e) {
                Log.e(TAG, "Error showing loading", e);
            }
        });
    }
    
    /**
     * Hide loading indicator
     */
    public void hideLoading() {
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                if (loadingView != null) {
                    loadingView.hide();
                    if (loadingView.getParent() != null) {
                        windowManager.removeView(loadingView);
                    }
                }
                Log.d(TAG, "Loading indicator hidden");
            } catch (Exception e) {
                Log.e(TAG, "Error hiding loading", e);
            }
        });
    }
    
    /**
     * Show text highlight at bounding box
     */
    public void showTextHighlight(final int x, final int y, final int width, final int height) {
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                if (highlightView == null) return;
                
                if (highlightView.getParent() == null) {
                    windowManager.addView(highlightView, highlightParams);
                }
                highlightView.showHighlight(x, y, width, height);
                
                Log.d(TAG, "Text highlight shown at " + x + "," + y + " " + width + "x" + height);
            } catch (Exception e) {
                Log.e(TAG, "Error showing highlight", e);
            }
        });
    }
    
    /**
     * Hide text highlight
     */
    public void hideTextHighlight() {
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                if (highlightView != null) {
                    highlightView.hide();
                    if (highlightView.getParent() != null) {
                        windowManager.removeView(highlightView);
                    }
                }
                Log.d(TAG, "Text highlight hidden");
            } catch (Exception e) {
                Log.e(TAG, "Error hiding highlight", e);
            }
        });
    }
    
    /**
     * Show result popup with translation
     */
    public void showResultPopup(final String originalText, final String translatedText, final int hintX, final int hintY) {
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                // Keep selection overlay visible when showing popup
                // (Previously it was hidden here, which caused the highlight box to disappear)
                
                // Show result popup
                if (resultPopupView.getParent() == null) {
                    windowManager.addView(resultPopupView, resultPopupParams);
                }
                resultPopupView.show(originalText, translatedText, hintX, hintY);
                
                Log.d(TAG, "Result popup shown, overlay remains visible");
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
                
                // DO NOT re-enable selection overlay automatically
                // User must tap logo again to start new selection
                // This prevents accidental re-drawing and ensures clean state
                
                Log.d(TAG, "Result popup hidden, waiting for user to tap logo for new selection");
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
            if (loadingView != null && loadingView.getParent() != null) {
                windowManager.removeView(loadingView);
            }
            if (highlightView != null && highlightView.getParent() != null) {
                windowManager.removeView(highlightView);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error in onDestroy", e);
        }
        
        Log.d(TAG, "SelectionModeService Destroyed");
    }
}
