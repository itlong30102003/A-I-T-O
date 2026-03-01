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
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.graphics.drawable.GradientDrawable;

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
    private View navbarView;
    private OverlayView translationView;
    private View languageMenuView;
    
    private WindowManager.LayoutParams navbarParams;
    private WindowManager.LayoutParams translationParams;
    private WindowManager.LayoutParams menuParams;

    private final String[] sourceLangCodes = {"auto", "en", "zh", "ja", "ko", "vi"};
    private final String[] sourceLangLabels = {"✨ Auto Detect", "🇺🇸 English", "🇨🇳 Chinese", "🇯🇵 Japanese", "🇰🇷 Korean", "🇻🇳 Vietnamese"};
    private final String[] targetLangCodes = {"vi", "en"};
    private final String[] targetLangLabels = {"🇻🇳 Vietnamese", "🇺🇸 English"};
    
    // Dimensions
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
    private boolean isAutoMode = true;
    private boolean isTranslating = false;
    
    // Static reference for communication
    public static OverlayService instance = null;
    public static String pendingBlocksJson = null;

    // Listeners
    private OnNavbarEventListener jsNavbarListener;
    
    public interface OnNavbarEventListener {
        void onLanguageSelected(boolean isSource, String code);
        void onTranslateClick();
        void onAutoModeClick();
        void onCloseClick();
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
        Log.d(TAG, "Overlay Service Created");

        createNotificationChannel();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, createNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIFICATION_ID, createNotification());
        }

        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        
        // Get screen dimensions from WindowManager for reliable values in Services
        DisplayMetrics dm = new DisplayMetrics();
        windowManager.getDefaultDisplay().getRealMetrics(dm);
        float density = getResources().getDisplayMetrics().density; // Density usually fine
        screenWidth = dm.widthPixels;
        screenHeight = dm.heightPixels;
        
        // Failsafe in case dm.widthPixels is still 0
        if (screenWidth <= 0) screenWidth = 1080;
        if (screenHeight <= 0) screenHeight = 2400;
        
        navbarHeightPx = (int) (60 * density);
        navbarTopMarginPx = (int) (16 * density);
        navbarHorizontalMarginPx = (int) (16 * density);
        
        createNavbarView();
        createTranslationView();
        
        instance = this;
    }
    
    private void createNavbarView() {
        int navbarWidth = screenWidth - (navbarHorizontalMarginPx * 2);
        
        navbarView = new View(this) {
            private RectF closeBtn = new RectF();
            private RectF sourceLangBtn = new RectF();
            private RectF targetLangBtn = new RectF();
            private RectF autoModeBtn = new RectF();
            private RectF translateBtn = new RectF();
            
            @Override
            protected void onDraw(Canvas canvas) {
                super.onDraw(canvas);
                drawNavbar(canvas, getWidth(), getHeight(), closeBtn, sourceLangBtn, targetLangBtn, autoModeBtn, translateBtn);
            }
            
            @Override
            public boolean onTouchEvent(MotionEvent event) {
                if (event.getAction() == MotionEvent.ACTION_DOWN) {
                    float x = event.getX();
                    float y = event.getY();
                    
                    if (closeBtn.contains(x, y)) {
                        if (jsNavbarListener != null) jsNavbarListener.onCloseClick();
                        return true;
                    }
                    if (sourceLangBtn.contains(x, y)) {
                        showLanguageMenu(true);
                        return true;
                    }
                    if (targetLangBtn.contains(x, y)) {
                        showLanguageMenu(false);
                        return true;
                    }
                    if (autoModeBtn.contains(x, y)) {
                        isAutoMode = !isAutoMode;
                        invalidate();
                        if (jsNavbarListener != null) jsNavbarListener.onAutoModeClick();
                        return true;
                    }
                    if (translateBtn.contains(x, y)) {
                        if (jsNavbarListener != null) jsNavbarListener.onTranslateClick();
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

        navbarParams.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
        navbarParams.y = (int) (80 * getResources().getDisplayMetrics().density);
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
    
    private void showLanguageMenu(boolean isSource) {
        new Handler(Looper.getMainLooper()).post(() -> {
            if (languageMenuView != null && languageMenuView.getParent() != null) {
                windowManager.removeView(languageMenuView);
            }
            languageMenuView = createLanguageMenuView(isSource);
            int layoutFlag = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? 
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : 
                WindowManager.LayoutParams.TYPE_PHONE;
            menuParams = new WindowManager.LayoutParams(
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    layoutFlag,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                    PixelFormat.TRANSLUCENT);
            menuParams.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
            menuParams.y = navbarHeightPx + navbarTopMarginPx + 150; // Show above the navbar
            windowManager.addView(languageMenuView, menuParams);
        });
    }
    
    private View createLanguageMenuView(boolean isSource) {
        float density = getResources().getDisplayMetrics().density;
        LinearLayout container = new LinearLayout(this);
        container.setOrientation(LinearLayout.VERTICAL);
        
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.WHITE);
        bg.setCornerRadius(16 * density);
        bg.setStroke((int)(1 * density), Color.parseColor("#E0E0E0"));
        container.setBackground(bg);
        container.setPadding((int)(20*density), (int)(20*density), (int)(20*density), (int)(20*density));
        
        TextView title = new TextView(this);
        title.setText(isSource ? "Chọn ngôn ngữ nguồn" : "Chọn ngôn ngữ đích");
        title.setTextSize(18);
        title.setTextColor(Color.parseColor("#333333"));
        title.setPadding(0, 0, 0, (int)(16*density));
        title.setGravity(Gravity.CENTER);
        title.getPaint().setFakeBoldText(true);
        container.addView(title);
        
        ScrollView scroll = new ScrollView(this);
        LinearLayout list = new LinearLayout(this);
        list.setOrientation(LinearLayout.VERTICAL);
        
        String[] codes = isSource ? sourceLangCodes : targetLangCodes;
        String[] labels = isSource ? sourceLangLabels : targetLangLabels;
        
        for (int i = 0; i < codes.length; i++) {
            final String code = codes[i];
            final String label = labels[i];
            
            TextView item = new TextView(this);
            item.setText(label);
            item.setTextSize(16);
            item.setTextColor(Color.parseColor("#333333"));
            item.setPadding(0, (int)(12*density), 0, (int)(12*density));
            item.setOnClickListener(v -> {
                if (languageMenuView != null && languageMenuView.getParent() != null) {
                    windowManager.removeView(languageMenuView);
                }
                if (isSource) {
                    sourceLanguage = label;
                } else {
                    targetLanguage = label;
                }
                if (navbarView != null) navbarView.invalidate();
                if (jsNavbarListener != null) {
                    jsNavbarListener.onLanguageSelected(isSource, code);
                }
            });
            list.addView(item);
            
            if (i < codes.length - 1) {
                View divider = new View(this);
                divider.setBackgroundColor(Color.parseColor("#EEEEEE"));
                divider.setLayoutParams(new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT, (int)(1 * density)));
                list.addView(divider);
            }
        }
        scroll.addView(list);
        container.addView(scroll);
        
        // Add close button
        TextView closeBtn = new TextView(this);
        closeBtn.setText("Đóng");
        closeBtn.setTextSize(16);
        closeBtn.setTextColor(Color.parseColor("#666666"));
        closeBtn.setGravity(Gravity.CENTER);
        
        GradientDrawable closeBg = new GradientDrawable();
        closeBg.setColor(Color.parseColor("#F5F5F5"));
        closeBg.setCornerRadius(8 * density);
        closeBtn.setBackground(closeBg);
        
        LinearLayout.LayoutParams closeParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        closeParams.setMargins(0, (int)(16*density), 0, 0);
        closeBtn.setLayoutParams(closeParams);
        closeBtn.setPadding(0, (int)(12*density), 0, (int)(12*density));
        
        closeBtn.setOnClickListener(v -> {
            if (languageMenuView != null && languageMenuView.getParent() != null) {
                windowManager.removeView(languageMenuView);
            }
        });
        container.addView(closeBtn);
        
        return container;
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
    
    private void drawNavbar(Canvas canvas, int width, int height, RectF closeBtn, RectF sourceLangBtn, RectF targetLangBtn, RectF autoModeBtn, RectF translateBtn) {
        float density = getResources().getDisplayMetrics().density;
        float cornerRadius = height / 2f;
        
        // Background
        Paint bgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        bgPaint.setColor(Color.WHITE);
        bgPaint.setShadowLayer(8 * density, 0, 2 * density, Color.argb(40, 0, 0, 0));
        canvas.drawRoundRect(0, 0, width, height, cornerRadius, cornerRadius, bgPaint);
        
        TextPaint textPaint = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        textPaint.setTextSize(12 * density);
        textPaint.setFakeBoldText(true);
        
        float centerY = height / 2f;
        Paint.FontMetrics fm = textPaint.getFontMetrics();
        float textY = centerY - (fm.ascent + fm.descent) / 2;
        
        float btnHeight = height - 12 * density;
        float btnY = (height - btnHeight) / 2f;
        float btnRadius = btnHeight / 2f;
        float gap = 4 * density;
        
        Paint btnPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        btnPaint.setStyle(Paint.Style.FILL);
        
        // Layout: [X:10%] [Src:22%] [Tgt:22%] [Auto:23%] [Dịch:23%]
        float closeW = width * 0.10f;
        float srcW = width * 0.22f;
        float tgtW = width * 0.22f;
        float autoW = width * 0.23f;
        float transW = width * 0.23f;
        
        float x = 0;
        
        // 1. Close button (✕)
        closeBtn.set(x + gap, btnY, x + closeW - gap, btnY + btnHeight);
        btnPaint.setColor(Color.parseColor("#FFEBEE"));
        canvas.drawRoundRect(closeBtn, btnRadius, btnRadius, btnPaint);
        textPaint.setColor(Color.parseColor("#D32F2F"));
        float closeTextW = textPaint.measureText("✕");
        canvas.drawText("✕", closeBtn.centerX() - closeTextW / 2, textY, textPaint);
        x += closeW;
        
        // 2. Source language
        sourceLangBtn.set(x + gap, btnY, x + srcW - gap, btnY + btnHeight);
        btnPaint.setColor(Color.parseColor("#F0F4FF"));
        canvas.drawRoundRect(sourceLangBtn, btnRadius, btnRadius, btnPaint);
        textPaint.setColor(Color.parseColor("#4285F4"));
        String srcText = sourceLanguage;
        float srcTextW = textPaint.measureText(srcText);
        canvas.drawText(srcText, sourceLangBtn.centerX() - srcTextW / 2, textY, textPaint);
        x += srcW;
        
        // 3. Target language
        targetLangBtn.set(x + gap, btnY, x + tgtW - gap, btnY + btnHeight);
        canvas.drawRoundRect(targetLangBtn, btnRadius, btnRadius, btnPaint);
        String tgtText = targetLanguage;
        float tgtTextW = textPaint.measureText(tgtText);
        canvas.drawText(tgtText, targetLangBtn.centerX() - tgtTextW / 2, textY, textPaint);
        x += tgtW;
        
        // 4. Auto/Manual toggle (or Word/Paragraph for Selection)
        autoModeBtn.set(x + gap, btnY, x + autoW - gap, btnY + btnHeight);
        if ("SELECTION".equals(currentMode)) {
            if (isAutoMode) {
                // Word mode
                btnPaint.setColor(Color.parseColor("#E8F5E9"));
                canvas.drawRoundRect(autoModeBtn, btnRadius, btnRadius, btnPaint);
                textPaint.setColor(Color.parseColor("#2E7D32"));
                String wordText = "Từ";
                float wordTextW = textPaint.measureText(wordText);
                canvas.drawText(wordText, autoModeBtn.centerX() - wordTextW / 2, textY, textPaint);
            } else {
                // Paragraph mode
                btnPaint.setColor(Color.parseColor("#FFF3E0"));
                canvas.drawRoundRect(autoModeBtn, btnRadius, btnRadius, btnPaint);
                textPaint.setColor(Color.parseColor("#E65100"));
                String paragraphText = "Đoạn";
                float paragraphTextW = textPaint.measureText(paragraphText);
                canvas.drawText(paragraphText, autoModeBtn.centerX() - paragraphTextW / 2, textY, textPaint);
            }
        } else {
            if (isAutoMode) {
                btnPaint.setColor(Color.parseColor("#E8F5E9"));
                canvas.drawRoundRect(autoModeBtn, btnRadius, btnRadius, btnPaint);
                textPaint.setColor(Color.parseColor("#2E7D32"));
                String autoText = "⚡Auto";
                float autoTextW = textPaint.measureText(autoText);
                canvas.drawText(autoText, autoModeBtn.centerX() - autoTextW / 2, textY, textPaint);
            } else {
                btnPaint.setColor(Color.parseColor("#FFF3E0"));
                canvas.drawRoundRect(autoModeBtn, btnRadius, btnRadius, btnPaint);
                textPaint.setColor(Color.parseColor("#E65100"));
                String manualText = "✋Manual";
                float manualTextW = textPaint.measureText(manualText);
                canvas.drawText(manualText, autoModeBtn.centerX() - manualTextW / 2, textY, textPaint);
            }
        }
        x += autoW;
        
        // 5. Translate / Start / Stop / Selection button
        translateBtn.set(x + gap, btnY, x + transW - gap, btnY + btnHeight);
        if ("SELECTION".equals(currentMode)) {
            // Selection mode: Selection trigger button
            btnPaint.setColor(Color.parseColor("#FFF3E0"));
            canvas.drawRoundRect(translateBtn, btnRadius, btnRadius, btnPaint);
            textPaint.setColor(Color.parseColor("#E65100"));
            String selectionText = "Selection";
            float selectionTextW = textPaint.measureText(selectionText);
            canvas.drawText(selectionText, translateBtn.centerX() - selectionTextW / 2, textY, textPaint);
        } else {
            if (isAutoMode) {
                if (isTranslating) {
                    // Stop button (red)
                    btnPaint.setColor(Color.parseColor("#FFEBEE"));
                    canvas.drawRoundRect(translateBtn, btnRadius, btnRadius, btnPaint);
                    textPaint.setColor(Color.parseColor("#D32F2F"));
                    String stopText = "⏹ Stop";
                    float stopTextW = textPaint.measureText(stopText);
                    canvas.drawText(stopText, translateBtn.centerX() - stopTextW / 2, textY, textPaint);
                } else {
                    // Start button (green)
                    btnPaint.setColor(Color.parseColor("#E8F5E9"));
                    canvas.drawRoundRect(translateBtn, btnRadius, btnRadius, btnPaint);
                    textPaint.setColor(Color.parseColor("#2E7D32"));
                    String startText = "▶ Start";
                    float startTextW = textPaint.measureText(startText);
                    canvas.drawText(startText, translateBtn.centerX() - startTextW / 2, textY, textPaint);
                }
            } else {
                // Manual mode: Dịch button (blue)
                btnPaint.setColor(Color.parseColor("#4285F4"));
                canvas.drawRoundRect(translateBtn, btnRadius, btnRadius, btnPaint);
                textPaint.setColor(Color.WHITE);
                String transText = "Dịch";
                float transTextW = textPaint.measureText(transText);
                canvas.drawText(transText, translateBtn.centerX() - transTextW / 2, textY, textPaint);
            }
        }
    }
    
    private String getModeIcon(String mode) {
        switch (mode) {
            case "REALTIME": return "⚡";
            case "SELECTION": return "🖐️";
            case "CAMERA": return "📷";
            default: return "🔄";
        }
    }

    public void toggleNavbar() {
        if (isNavbarVisible) hideNavbar();
        else showNavbar();
    }
    
    public void showNavbar() {
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                if (navbarView.getParent() == null) {
                    windowManager.addView(navbarView, navbarParams);
                    isNavbarVisible = true;
                }
            } catch (Exception e) {
                Log.e(TAG, "Error showing navbar", e);
            }
        });
    }
    
    public void hideNavbar() {
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                if (navbarView.getParent() != null) {
                    windowManager.removeView(navbarView);
                    isNavbarVisible = false;
                }
            } catch (Exception e) {
                Log.e(TAG, "Error hiding navbar", e);
            }
        });
    }
    
    public void setNavbarConfig(String mode, String sourceLang, String targetLang) {
        new Handler(Looper.getMainLooper()).post(() -> {
            this.currentMode = mode != null ? mode : "REALTIME";
            this.sourceLanguage = sourceLang != null ? sourceLang : "Auto";
            this.targetLanguage = targetLang != null ? targetLang : "VN";
            if (navbarView != null) navbarView.invalidate();
        });
    }

    public void setTranslating(boolean translating) {
        new Handler(Looper.getMainLooper()).post(() -> {
            this.isTranslating = translating;
            if (navbarView != null) navbarView.invalidate();
        });
    }
    
    public void setAutoMode(boolean auto) {
        new Handler(Looper.getMainLooper()).post(() -> {
            this.isAutoMode = auto;
            if (navbarView != null) navbarView.invalidate();
        });
    }
    
    public void setOverlayStyle(String style) {
        new Handler(Looper.getMainLooper()).post(() -> {
            if (translationView != null) {
                translationView.setOverlayStyle(style);
            }
        });
    }
    
    public void setOverlayTextSize(float scale) {
        new Handler(Looper.getMainLooper()).post(() -> {
            if (translationView != null) {
                translationView.setTextSizeScale(scale);
            }
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
            if (navbarView != null && navbarView.getParent() != null) windowManager.removeView(navbarView);
            if (languageMenuView != null && languageMenuView.getParent() != null) windowManager.removeView(languageMenuView);
            if (translationView != null && translationView.getParent() != null) windowManager.removeView(translationView);
        } catch (Exception e) {
            Log.e(TAG, "Error in onDestroy", e);
        }
    }
}
