package com.aito.overlay;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.RectF;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.text.TextPaint;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.content.pm.ServiceInfo;
import androidx.core.app.NotificationCompat;
import com.aito.R;

/**
 * OverlayService - Manages the main floating logo, navbar, and translation overlay.
 * Selection functionality has been moved to SelectionModeService.
 */
public class OverlayService extends Service {
    private static final String TAG = "OverlayService";
    private static final String CHANNEL_ID = "overlay_channel";
    private static final int NOTIFICATION_ID = 2001;
    
    private WindowManager windowManager;
    private View logoView;
    private View navbarView;
    private OverlayView translationView;
    
    private WindowManager.LayoutParams logoParams;
    private WindowManager.LayoutParams navbarParams;
    private WindowManager.LayoutParams translationParams;
    
    // Dimensions
    private int logoSizePx;
    private int logoMarginPx;
    private int navbarHeightPx;
    private int navbarTopMarginPx;
    private int navbarHorizontalMarginPx;
    private int screenWidth;
    private int screenHeight;
    
    // State
    private boolean isNavbarVisible = false;
    private String currentMode = "REALTIME";
    private String sourceLanguage = "Auto";
    private String targetLanguage = "VN";
    private Bitmap logoBitmap;
    
    // Static reference for communication
    public static OverlayService instance = null;
    public static String pendingBlocksJson = null;

    // Listeners
    private OnLogoClickListener jsLogoListener;
    private OnNavbarEventListener jsNavbarListener;

    public interface OnLogoClickListener {
        void onClick();
    }
    
    public interface OnNavbarEventListener {
        void onSourceLangClick();
        void onTargetLangClick();
    }

    public void setOnLogoClickListener(OnLogoClickListener listener) {
        this.jsLogoListener = listener;
    }
    
    public void setOnNavbarEventListener(OnNavbarEventListener listener) {
        this.jsNavbarListener = listener;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        Log.d(TAG, "Overlay Service Created");

        createNotificationChannel();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, createNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIFICATION_ID, createNotification());
        }

        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        
        // Get screen dimensions
        DisplayMetrics dm = getResources().getDisplayMetrics();
        float density = dm.density;
        screenWidth = dm.widthPixels;
        screenHeight = dm.heightPixels;
        
        logoSizePx = (int) (28 * density);
        logoMarginPx = (int) (16 * density);
        navbarHeightPx = (int) (48 * density);
        navbarTopMarginPx = (int) (60 * density);
        navbarHorizontalMarginPx = (int) (16 * density);
        
        try {
            logoBitmap = BitmapFactory.decodeResource(getResources(), R.drawable.ai_translate);
        } catch (Exception e) {
            Log.e(TAG, "Failed to load logo", e);
        }
        
        createLogoView();
        createNavbarView();
        createTranslationView();
    }
    
    private void createLogoView() {
        logoView = new View(this) {
            @Override
            protected void onDraw(Canvas canvas) {
                super.onDraw(canvas);
                drawLogo(canvas);
            }
        };
        
        logoView.setOnClickListener(v -> {
            if (jsLogoListener != null) jsLogoListener.onClick();
        });

        int layoutFlag = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? 
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : 
            WindowManager.LayoutParams.TYPE_PHONE;

        logoParams = new WindowManager.LayoutParams(
                logoSizePx,
                logoSizePx,
                layoutFlag,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT);

        logoParams.gravity = Gravity.BOTTOM | Gravity.END;
        logoParams.x = logoMarginPx;
        logoParams.y = logoMarginPx + 100;
    }
    
    private void createNavbarView() {
        int navbarWidth = screenWidth - (navbarHorizontalMarginPx * 2);
        
        navbarView = new View(this) {
            private RectF sourceLangBtn = new RectF();
            private RectF targetLangBtn = new RectF();
            
            @Override
            protected void onDraw(Canvas canvas) {
                super.onDraw(canvas);
                drawNavbar(canvas, getWidth(), getHeight(), sourceLangBtn, targetLangBtn);
            }
            
            @Override
            public boolean onTouchEvent(MotionEvent event) {
                if (event.getAction() == MotionEvent.ACTION_DOWN) {
                    float x = event.getX();
                    float y = event.getY();
                    
                    if (sourceLangBtn.contains(x, y)) {
                        if (jsNavbarListener != null) jsNavbarListener.onSourceLangClick();
                        return true;
                    }
                    if (targetLangBtn.contains(x, y)) {
                        if (jsNavbarListener != null) jsNavbarListener.onTargetLangClick();
                        return true;
                    }
                }
                return true;
            }
        };

        int layoutFlag = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? 
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : 
            WindowManager.LayoutParams.TYPE_PHONE;

        navbarParams = new WindowManager.LayoutParams(
                navbarWidth,
                navbarHeightPx,
                layoutFlag,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT);

        navbarParams.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        navbarParams.y = navbarTopMarginPx;
    }
    
    private void createTranslationView() {
        translationView = new OverlayView(this);

        int layoutFlag = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? 
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : 
            WindowManager.LayoutParams.TYPE_PHONE;

        translationParams = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                layoutFlag,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
                WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE |
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT);

        translationParams.gravity = Gravity.TOP | Gravity.START;
    }
    
    public void showTranslation() {
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                if (translationView.getParent() == null) {
                    windowManager.addView(translationView, translationParams);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error showing translation overlay", e);
            }
        });
    }
    
    public void hideTranslation() {
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                if (translationView != null && translationView.getParent() != null) {
                    windowManager.removeView(translationView);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error hiding translation overlay", e);
            }
        });
    }
    
    public void updateTranslationBlocks(final String jsonBlocks) {
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                if (translationView != null) {
                    if (translationView.getParent() == null) {
                        windowManager.addView(translationView, translationParams);
                    }
                    translationView.updateBlocks(jsonBlocks);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error updating translation blocks", e);
            }
        });
    }
    
    private void drawLogo(Canvas canvas) {
        int size = canvas.getWidth();
        float cornerRadius = size * 0.2f;
        float padding = 2f;
        RectF rect = new RectF(padding, padding, size - padding, size - padding);
        
        Paint shadowPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        shadowPaint.setColor(Color.argb(40, 0, 0, 0));
        RectF shadowRect = new RectF(padding + 2, padding + 2, size - padding + 2, size - padding + 2);
        canvas.drawRoundRect(shadowRect, cornerRadius, cornerRadius, shadowPaint);
        
        if (logoBitmap != null) {
            Path clipPath = new Path();
            clipPath.addRoundRect(rect, cornerRadius, cornerRadius, Path.Direction.CW);
            canvas.save();
            canvas.clipPath(clipPath);
            canvas.drawBitmap(logoBitmap, null, rect, null);
            canvas.restore();
            
            Paint borderPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            borderPaint.setColor(Color.BLACK);
            borderPaint.setStyle(Paint.Style.STROKE);
            borderPaint.setStrokeWidth(1.5f);
            canvas.drawRoundRect(rect, cornerRadius, cornerRadius, borderPaint);
        }
    }
    
    private void drawNavbar(Canvas canvas, int width, int height, RectF sourceLangBtn, RectF targetLangBtn) {
        float density = getResources().getDisplayMetrics().density;
        float cornerRadius = height / 2f;
        
        Paint bgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        bgPaint.setColor(Color.WHITE);
        bgPaint.setShadowLayer(8 * density, 0, 2 * density, Color.argb(40, 0, 0, 0));
        canvas.drawRoundRect(0, 0, width, height, cornerRadius, cornerRadius, bgPaint);
        
        TextPaint textPaint = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        textPaint.setColor(Color.parseColor("#333333"));
        textPaint.setTextSize(13 * density);
        textPaint.setFakeBoldText(true);
        
        float centerY = height / 2f;
        Paint.FontMetrics fm = textPaint.getFontMetrics();
        float textY = centerY - (fm.ascent + fm.descent) / 2;
        
        canvas.drawText(getModeIcon(currentMode) + " " + currentMode, 16 * density, textY, textPaint);
        
        float sectionWidth = width / 3f;
        float btnHeight = height - 16 * density;
        float btnY = (height - btnHeight) / 2f;
        
        textPaint.setColor(Color.parseColor("#4285F4"));
        sourceLangBtn.set(sectionWidth, btnY, sectionWidth * 2 - 8 * density, btnY + btnHeight);
        float srcWidth = textPaint.measureText("🌐 " + sourceLanguage);
        canvas.drawText("🌐 " + sourceLanguage, sourceLangBtn.centerX() - srcWidth / 2, textY, textPaint);
        
        targetLangBtn.set(sectionWidth * 2 + 8 * density, btnY, width - 12 * density, btnY + btnHeight);
        float tgtWidth = textPaint.measureText("🎯 " + targetLanguage);
        canvas.drawText("🎯 " + targetLanguage, targetLangBtn.centerX() - tgtWidth / 2, textY, textPaint);
    }
    
    private String getModeIcon(String mode) {
        switch (mode) {
            case "REALTIME": return "⚡";
            case "SELECTION": return "🖐️";
            case "CAMERA": return "📷";
            default: return "🔄";
        }
    }

    public void showLogo() {
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                if (logoView.getParent() == null) {
                    windowManager.addView(logoView, logoParams);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error showing logo", e);
            }
        });
    }

    public void hideLogo() {
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                if (logoView.getParent() != null) {
                    windowManager.removeView(logoView);
                }
                hideNavbar();
            } catch (Exception e) {
                Log.e(TAG, "Error hiding logo", e);
            }
        });
    }
    
    public void toggleNavbar() {
        new Handler(Looper.getMainLooper()).post(() -> {
            if (isNavbarVisible) hideNavbar();
            else showNavbar();
        });
    }
    
    private void showNavbar() {
        try {
            if (navbarView.getParent() == null) {
                windowManager.addView(navbarView, navbarParams);
                isNavbarVisible = true;
            }
        } catch (Exception e) {
            Log.e(TAG, "Error showing navbar", e);
        }
    }
    
    private void hideNavbar() {
        try {
            if (navbarView.getParent() != null) {
                windowManager.removeView(navbarView);
                isNavbarVisible = false;
            }
        } catch (Exception e) {
            Log.e(TAG, "Error hiding navbar", e);
        }
    }
    
    public void setNavbarConfig(String mode, String sourceLang, String targetLang) {
        new Handler(Looper.getMainLooper()).post(() -> {
            this.currentMode = mode != null ? mode : "REALTIME";
            this.sourceLanguage = sourceLang != null ? sourceLang : "Auto";
            this.targetLanguage = targetLang != null ? targetLang : "VN";
            if (navbarView != null) navbarView.invalidate();
        });
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "AITO Overlay", NotificationManager.IMPORTANCE_LOW);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    private Notification createNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("AITO is active")
                .setSmallIcon(android.R.drawable.ic_menu_view)
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
            if (logoView != null && logoView.getParent() != null) windowManager.removeView(logoView);
            if (navbarView != null && navbarView.getParent() != null) windowManager.removeView(navbarView);
            if (translationView != null && translationView.getParent() != null) windowManager.removeView(translationView);
        } catch (Exception e) {
            Log.e(TAG, "Error in onDestroy", e);
        }
    }
}
