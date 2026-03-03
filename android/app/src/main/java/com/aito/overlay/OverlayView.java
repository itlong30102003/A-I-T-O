package com.aito.overlay;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Rect;
import android.graphics.RectF;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;
import android.text.TextUtils;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.MotionEvent;
import android.view.View;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;
import com.aito.R;

public class OverlayView extends View {
    private static final String TAG = "OverlayView";
    
    // Text overlay paints
    private final Paint paintBackground;
    private final TextPaint textPaint;
    private List<TextBlock> textBlocks = new ArrayList<>();
    private int statusBarHeight = 0;
    
    // Settings: overlay style & text size
    private String overlayStyleMode = "dark"; // "dark" = black bg white text, "light" = white bg black text
    private float textSizeScale = 1.0f;
    
    // Logo properties
    private RectF logoRect = new RectF();
    private boolean isLogoVisible = false;
    private Bitmap logoBitmap;
    private static final int LOGO_SIZE_DP = 48; // Smaller logo
    private static final int LOGO_MARGIN_DP = 16;
    private int logoSizePx;
    private int logoMarginPx;
    
    // Navbar properties
    private boolean isNavbarVisible = false;
    private RectF navbarRect = new RectF();
    private String currentMode = "REALTIME";
    private String sourceLanguage = "Auto";
    private String targetLanguage = "VN";
    
    // Navbar button regions
    private RectF sourceLangBtn = new RectF();
    private RectF targetLangBtn = new RectF();
    
    // Navbar dimensions
    private static final int NAVBAR_HEIGHT_DP = 44;
    private static final int NAVBAR_TOP_MARGIN_DP = 60; // Avoid notch
    private static final int NAVBAR_HORIZONTAL_MARGIN_DP = 16;
    private static final int NAVBAR_CORNER_RADIUS_DP = 22;
    
    private int navbarHeightPx;
    private int navbarTopMarginPx;
    private int navbarHorizontalMarginPx;
    private int navbarCornerRadiusPx;
    
    // Paints for navbar
    private Paint navbarPaint;
    private Paint navbarShadowPaint;
    private TextPaint navbarTextPaint;
    private TextPaint navbarButtonTextPaint;
    private Paint buttonPaint;
    
    // Listeners
    private OnLogoClickListener logoClickListener;
    private OnNavbarEventListener navbarEventListener;

    public static class TextBlock {
        String text;
        Rect rect;
        int fontSize;    // Estimated original font size (0 = auto)
        int bgColor;     // Background color (ARGB)
        int textColor;   // Calculated text color for readability

        public TextBlock(String text, Rect rect, int fontSize, int bgColor) {
            this.text = text;
            this.rect = rect;
            this.fontSize = fontSize;
            this.bgColor = bgColor;
            this.textColor = calculateTextColor(bgColor);
        }

        private static int calculateTextColor(int bgColor) {
            int r = Color.red(bgColor);
            int g = Color.green(bgColor);
            int b = Color.blue(bgColor);
            double luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
            return luminance > 0.5 ? Color.BLACK : Color.WHITE;
        }
    }

    public interface OnLogoClickListener {
        void onLogoClick();
    }
    
    public interface OnNavbarEventListener {
        void onSourceLangClick();
        void onTargetLangClick();
    }

    public void setOnLogoClickListener(OnLogoClickListener listener) {
        this.logoClickListener = listener;
    }
    
    public void setOnNavbarEventListener(OnNavbarEventListener listener) {
        this.navbarEventListener = listener;
    }
    
    public void setOverlayStyle(String style) {
        this.overlayStyleMode = style != null ? style : "dark";
        if ("light".equals(overlayStyleMode)) {
            paintBackground.setColor(Color.argb(230, 255, 255, 255));
            textPaint.setColor(Color.BLACK);
        } else {
            paintBackground.setColor(Color.argb(200, 0, 0, 0));
            textPaint.setColor(Color.WHITE);
        }
        invalidate();
    }
    
    public void setTextSizeScale(float scale) {
        this.textSizeScale = Math.max(0.5f, Math.min(2.0f, scale));
        invalidate();
    }

    public OverlayView(Context context) {
        super(context);
        
        DisplayMetrics dm = context.getResources().getDisplayMetrics();
        float density = dm.density;
        
        // Convert dp to px
        logoSizePx = (int) (LOGO_SIZE_DP * density);
        logoMarginPx = (int) (LOGO_MARGIN_DP * density);
        navbarHeightPx = (int) (NAVBAR_HEIGHT_DP * density);
        navbarTopMarginPx = (int) (NAVBAR_TOP_MARGIN_DP * density);
        navbarHorizontalMarginPx = (int) (NAVBAR_HORIZONTAL_MARGIN_DP * density);
        navbarCornerRadiusPx = (int) (NAVBAR_CORNER_RADIUS_DP * density);

        // Text overlay background
        paintBackground = new Paint();
        paintBackground.setColor(Color.argb(200, 0, 0, 0));
        paintBackground.setStyle(Paint.Style.FILL);

        // Text overlay paint
        textPaint = new TextPaint();
        textPaint.setColor(Color.WHITE);
        textPaint.setAntiAlias(true);

        // Calculate status bar height
        int resourceId = context.getResources().getIdentifier("status_bar_height", "dimen", "android");
        if (resourceId > 0) {
            statusBarHeight = context.getResources().getDimensionPixelSize(resourceId);
        }

        // Load logo bitmap
        try {
            logoBitmap = BitmapFactory.decodeResource(context.getResources(), R.drawable.ai_translate);
        } catch (Exception e) {
            Log.e(TAG, "Failed to load logo bitmap", e);
        }
        
        // Initialize navbar paints
        initNavbarPaints(density);
    }
    
    private void initNavbarPaints(float density) {
        // Navbar background (white with shadow)
        navbarPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        navbarPaint.setColor(Color.WHITE);
        navbarPaint.setStyle(Paint.Style.FILL);
        navbarPaint.setShadowLayer(8 * density, 0, 2 * density, Color.argb(60, 0, 0, 0));
        
        // Navbar text (mode label)
        navbarTextPaint = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        navbarTextPaint.setColor(Color.parseColor("#333333"));
        navbarTextPaint.setTextSize(13 * density);
        navbarTextPaint.setFakeBoldText(true);
        
        // Button text
        navbarButtonTextPaint = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        navbarButtonTextPaint.setColor(Color.parseColor("#4285F4"));
        navbarButtonTextPaint.setTextSize(13 * density);
        navbarButtonTextPaint.setFakeBoldText(true);
        
        // Button background
        buttonPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        buttonPaint.setColor(Color.parseColor("#F0F4FF"));
        buttonPaint.setStyle(Paint.Style.FILL);
    }

    public void showLogo() {
        isLogoVisible = true;
        // Position logo at bottom-right corner
        int screenWidth = getWidth();
        int screenHeight = getHeight();
        if (screenWidth > 0 && screenHeight > 0) {
            float left = screenWidth - logoSizePx - logoMarginPx;
            float top = screenHeight - logoSizePx - logoMarginPx - statusBarHeight;
            logoRect.set(left, top, left + logoSizePx, top + logoSizePx);
        }
        invalidate();
    }

    public void hideLogo() {
        isLogoVisible = false;
        isNavbarVisible = false;
        invalidate();
    }
    
    public void toggleNavbar() {
        isNavbarVisible = !isNavbarVisible;
        invalidate();
    }
    
    public void setNavbarConfig(String mode, String sourceLang, String targetLang) {
        this.currentMode = mode != null ? mode : "REALTIME";
        this.sourceLanguage = sourceLang != null ? sourceLang : "Auto";
        this.targetLanguage = targetLang != null ? targetLang : "VN";
        invalidate();
    }

    @Override
    protected void onSizeChanged(int w, int h, int oldw, int oldh) {
        super.onSizeChanged(w, h, oldw, oldh);
        // Update logo position when view size changes
        if (isLogoVisible) {
            float left = w - logoSizePx - logoMarginPx;
            float top = h - logoSizePx - logoMarginPx - statusBarHeight;
            logoRect.set(left, top, left + logoSizePx, top + logoSizePx);
        }
        // Update navbar rect
        updateNavbarRect(w);
    }
    
    private void updateNavbarRect(int screenWidth) {
        float left = navbarHorizontalMarginPx;
        float right = screenWidth - navbarHorizontalMarginPx;
        float top = navbarTopMarginPx;
        float bottom = top + navbarHeightPx;
        navbarRect.set(left, top, right, bottom);
        
        // Calculate button regions
        float buttonWidth = (right - left - 20) / 3; // 3 sections: mode, source, target
        float padding = 8;
        
        // Source lang button (middle section)
        float sourceLeft = left + buttonWidth + padding;
        sourceLangBtn.set(sourceLeft, top + padding, sourceLeft + buttonWidth - padding * 2, bottom - padding);
        
        // Target lang button (right section)
        float targetLeft = left + buttonWidth * 2 + padding;
        targetLangBtn.set(targetLeft, top + padding, right - padding, bottom - padding);
    }

    /**
     * Override dispatchTouchEvent to handle touch passthrough properly.
     * Only intercept touches on logo and navbar, everything else passes through.
     */
    @Override
    public boolean dispatchTouchEvent(MotionEvent event) {
        float x = event.getX();
        float y = event.getY();
        
        // Check if touch is on an interactive area
        boolean isOnLogo = isLogoVisible && logoRect.contains(x, y);
        boolean isOnNavbar = isNavbarVisible && navbarRect.contains(x, y);
        
        // If not on any interactive area, don't intercept - pass through
        if (!isOnLogo && !isOnNavbar) {
            return false;
        }
        
        // Handle ACTION_DOWN for clicks
        if (event.getAction() == MotionEvent.ACTION_DOWN) {
            if (isOnLogo) {
                toggleNavbar();
                if (logoClickListener != null) {
                    logoClickListener.onLogoClick();
                }
                return true;
            }
            
            if (isOnNavbar) {
                // Check specific buttons
                if (sourceLangBtn.contains(x, y)) {
                    if (navbarEventListener != null) {
                        navbarEventListener.onSourceLangClick();
                    }
                    return true;
                }
                if (targetLangBtn.contains(x, y)) {
                    if (navbarEventListener != null) {
                        navbarEventListener.onTargetLangClick();
                    }
                    return true;
                }
                // Touch is on navbar but not on buttons, consume it
                return true;
            }
        }
        
        // Consume touches on interactive areas for other actions (MOVE, UP, etc.)
        return true;
    }

    public void updateBlocks(String jsonString) {
        textBlocks.clear();
        try {
            JSONArray jsonArray = new JSONArray(jsonString);
            for (int i = 0; i < jsonArray.length(); i++) {
                JSONObject obj = jsonArray.getJSONObject(i);
                String text = obj.optString("text", "");
                int fontSize = obj.optInt("fontSize", 0);
                
                // Parse bgColor hex → ARGB with alpha 230
                String bgHex = obj.optString("bgColor", "");
                int bgColor;
                if (!bgHex.isEmpty()) {
                    try {
                        int parsed = Color.parseColor(bgHex);
                        bgColor = Color.argb(230, Color.red(parsed), Color.green(parsed), Color.blue(parsed));
                    } catch (Exception ignored) {
                        bgColor = "light".equals(overlayStyleMode)
                            ? Color.argb(230, 255, 255, 255)
                            : Color.argb(200, 0, 0, 0);
                    }
                } else {
                    bgColor = "light".equals(overlayStyleMode)
                        ? Color.argb(230, 255, 255, 255)
                        : Color.argb(200, 0, 0, 0);
                }
                
                JSONObject boundingBox = obj.optJSONObject("boundingBox");
                
                if (boundingBox != null) {
                    int x = boundingBox.optInt("x", 0);
                    int y = boundingBox.optInt("y", 0);
                    int w = boundingBox.optInt("width", 0);
                    int h = boundingBox.optInt("height", 0);
                    
                    int adjustedY = y - statusBarHeight;
                    
                    if (w > 0 && h > 0 && adjustedY + h > 0) {
                        // Expand rect slightly to fully cover original text
                        int expand = 4;
                        textBlocks.add(new TextBlock(text, new Rect(x - expand, adjustedY - expand, x + w + expand, adjustedY + h + expand), fontSize, bgColor));
                        Log.d(TAG, "Block: fontSize=" + fontSize + " rect=" + w + "x" + h + " text=" + text.substring(0, Math.min(20, text.length())));
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error parsing blocks JSON", e);
        }
        invalidate();
    }

    private float findOptimalTextSize(String text, int maxWidth, int maxHeight, float minSize, float maxSize) {
        float low = minSize;
        float high = maxSize;
        float optimalSize = minSize;
        
        while (high - low > 1f) {
            float mid = (low + high) / 2f;
            textPaint.setTextSize(mid);
            
            StaticLayout layout = StaticLayout.Builder
                .obtain(text, 0, text.length(), textPaint, maxWidth)
                .setAlignment(Layout.Alignment.ALIGN_NORMAL)
                .setLineSpacing(0f, 1f)
                .setIncludePad(false)
                .build();
            
            if (layout.getHeight() <= maxHeight) {
                optimalSize = mid;
                low = mid;
            } else {
                high = mid;
            }
        }
        
        return optimalSize;
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        
        // Enable layer for shadow
        setLayerType(LAYER_TYPE_SOFTWARE, null);

        // Draw text blocks with per-block style and 3-step overflow
        for (TextBlock block : textBlocks) {
            // Per-block background color
            paintBackground.setColor(block.bgColor);
            canvas.drawRect(block.rect, paintBackground);
            if (block.text == null || block.text.isEmpty()) continue;

            int boxWidth = block.rect.width();
            int boxHeight = block.rect.height();
            if (boxWidth <= 0 || boxHeight <= 0) continue;

            int padding = 4;
            int availableWidth = boxWidth - (padding * 2);
            int availableHeight = boxHeight - (padding * 2);
            if (availableWidth <= 0 || availableHeight <= 0) continue;

            // Per-block text color
            textPaint.setColor(block.textColor);

            // Step 1: Try original fontSize first (no shrinking)
            float targetSize;
            if (block.fontSize > 0) {
                targetSize = block.fontSize * 1.1f * textSizeScale;
                Log.d(TAG, "FontSize: using direct fontSize=" + block.fontSize + " targetSize=" + targetSize);
            } else {
                targetSize = findOptimalTextSize(block.text, availableWidth, availableHeight, 12f * textSizeScale, 100f * textSizeScale);
            }
            textPaint.setTextSize(targetSize);

            StaticLayout staticLayout = StaticLayout.Builder
                .obtain(block.text, 0, block.text.length(), textPaint, availableWidth)
                .setAlignment(Layout.Alignment.ALIGN_NORMAL)
                .setLineSpacing(0f, 1f)
                .setIncludePad(false)
                .build();

            // Step 2: Adaptive fit — shrink font (-5%) AND expand bbox (+10%) together
            int drawHeight = availableHeight;
            if (staticLayout.getHeight() > availableHeight && block.fontSize > 0) {
                float currentSize = targetSize;
                float minSize = targetSize * 0.80f;       // Don't shrink below 80%
                int maxHeight = boxHeight * 2;             // Don't expand beyond 2×
                int currentBoxHeight = boxHeight;

                while (staticLayout.getHeight() > (currentBoxHeight - padding * 2)) {
                    // Shrink font by 5%
                    float newSize = currentSize * 0.95f;
                    // Expand bbox by 10%
                    int newBoxHeight = currentBoxHeight + (int)(boxHeight * 0.1f);

                    // Check limits
                    boolean canShrink = newSize >= minSize;
                    boolean canExpand = newBoxHeight <= maxHeight;

                    if (!canShrink && !canExpand) break; // Both at limit

                    if (canShrink) currentSize = newSize;
                    if (canExpand) currentBoxHeight = newBoxHeight;

                    textPaint.setTextSize(currentSize);
                    staticLayout = StaticLayout.Builder
                        .obtain(block.text, 0, block.text.length(), textPaint, availableWidth)
                        .setAlignment(Layout.Alignment.ALIGN_NORMAL)
                        .setLineSpacing(0f, 1f)
                        .setIncludePad(false)
                        .build();
                }

                block.rect.bottom = block.rect.top + currentBoxHeight;
                drawHeight = currentBoxHeight - (padding * 2);
                float shrinkRatio = currentSize / targetSize * 100f;
                int expandRatio = currentBoxHeight * 100 / boxHeight;
                Log.d(TAG, "Adaptive: font=" + (int)shrinkRatio + "% bbox=" + expandRatio + "%");

                // Redraw expanded background
                canvas.drawRect(block.rect, paintBackground);

                // Step 3: If still overflows, truncate
                if (staticLayout.getHeight() > drawHeight) {
                    int maxLines = Math.max(1, drawHeight / (int)(currentSize * 1.2f));
                    staticLayout = StaticLayout.Builder
                        .obtain(block.text, 0, block.text.length(), textPaint, availableWidth)
                        .setAlignment(Layout.Alignment.ALIGN_NORMAL)
                        .setLineSpacing(0f, 1f)
                        .setIncludePad(false)
                        .setMaxLines(maxLines)
                        .setEllipsize(TextUtils.TruncateAt.END)
                        .build();
                }
            }

            canvas.save();
            canvas.translate(block.rect.left + padding, block.rect.top + padding);
            staticLayout.draw(canvas);
            canvas.restore();
        }

        // Draw Navbar if visible
        if (isNavbarVisible) {
            drawNavbar(canvas);
        }

        // Draw Logo if visible
        if (isLogoVisible) {
            drawLogo(canvas);
        }
    }
    
    private void drawNavbar(Canvas canvas) {
        // Draw navbar background (pill shape)
        canvas.drawRoundRect(navbarRect, navbarCornerRadiusPx, navbarCornerRadiusPx, navbarPaint);
        
        float centerY = navbarRect.centerY();
        float buttonHeight = navbarHeightPx - 16;
        float buttonRadius = buttonHeight / 2;
        
        // Calculate sections
        float sectionWidth = navbarRect.width() / 3;
        
        // Section 1: Mode indicator
        String modeIcon = getModeIcon(currentMode);
        float modeX = navbarRect.left + 16;
        Paint.FontMetrics fm = navbarTextPaint.getFontMetrics();
        float textY = centerY - (fm.ascent + fm.descent) / 2;
        canvas.drawText(modeIcon + " " + currentMode, modeX, textY, navbarTextPaint);
        
        // Section 2: Source language button
        float sourceBtnLeft = navbarRect.left + sectionWidth;
        RectF sourceRect = new RectF(sourceBtnLeft + 4, centerY - buttonHeight/2, 
                                      sourceBtnLeft + sectionWidth - 8, centerY + buttonHeight/2);
        canvas.drawRoundRect(sourceRect, buttonRadius, buttonRadius, buttonPaint);
        sourceLangBtn.set(sourceRect);
        
        String sourceText = "🌐 " + sourceLanguage;
        float sourceTextWidth = navbarButtonTextPaint.measureText(sourceText);
        canvas.drawText(sourceText, sourceRect.centerX() - sourceTextWidth/2, textY, navbarButtonTextPaint);
        
        // Arrow separator
        float arrowX = sourceBtnLeft + sectionWidth - 2;
        navbarTextPaint.setColor(Color.parseColor("#888888"));
        canvas.drawText("→", arrowX, textY, navbarTextPaint);
        navbarTextPaint.setColor(Color.parseColor("#333333"));
        
        // Section 3: Target language button
        float targetBtnLeft = navbarRect.left + sectionWidth * 2;
        RectF targetRect = new RectF(targetBtnLeft + 8, centerY - buttonHeight/2,
                                      navbarRect.right - 12, centerY + buttonHeight/2);
        canvas.drawRoundRect(targetRect, buttonRadius, buttonRadius, buttonPaint);
        targetLangBtn.set(targetRect);
        
        String targetText = "🎯 " + targetLanguage;
        float targetTextWidth = navbarButtonTextPaint.measureText(targetText);
        canvas.drawText(targetText, targetRect.centerX() - targetTextWidth/2, textY, navbarButtonTextPaint);
    }
    
    private String getModeIcon(String mode) {
        switch (mode) {
            case "REALTIME": return "⚡";
            case "SELECTION": return "🖐️";
            case "CAMERA": return "📷";
            default: return "🔄";
        }
    }
    
    private void drawLogo(Canvas canvas) {
        if (logoBitmap != null) {
            // Draw circular logo with clip path
            Path clipPath = new Path();
            float cx = logoRect.centerX();
            float cy = logoRect.centerY();
            float radius = logoSizePx / 2f;
            clipPath.addCircle(cx, cy, radius, Path.Direction.CW);
            
            canvas.save();
            canvas.clipPath(clipPath);
            canvas.drawBitmap(logoBitmap, null, logoRect, null);
            canvas.restore();
            
            // Draw subtle border
            Paint borderPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            borderPaint.setColor(Color.WHITE);
            borderPaint.setStyle(Paint.Style.STROKE);
            borderPaint.setStrokeWidth(3);
            canvas.drawCircle(cx, cy, radius, borderPaint);
        } else {
            // Fallback circle with text
            Paint fallbackPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            fallbackPaint.setColor(Color.parseColor("#4285F4"));
            canvas.drawOval(logoRect, fallbackPaint);
            
            TextPaint tp = new TextPaint(Paint.ANTI_ALIAS_FLAG);
            tp.setColor(Color.WHITE);
            tp.setTextSize(logoSizePx * 0.4f);
            tp.setTextAlign(Paint.Align.CENTER);
            Paint.FontMetrics fm = tp.getFontMetrics();
            float textY = logoRect.centerY() - (fm.ascent + fm.descent) / 2;
            canvas.drawText("Aあ", logoRect.centerX(), textY, tp);
        }
    }
}
