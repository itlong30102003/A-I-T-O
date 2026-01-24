package com.aito.overlay;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PointF;
import android.graphics.Rect;
import android.graphics.RectF;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.MotionEvent;
import android.view.View;

/**
 * ResultPopupView - Draggable popup to display translation results
 * 
 * Features:
 * - Draggable (can be moved around)
 * - No auto-dismiss (manual close only)
 * - Close button (X)
 * - Dismiss when tapped outside
 * - Scrollable text content for long translations
 */
public class ResultPopupView extends View {
    private static final String TAG = "ResultPopupView";
    
    // Content
    private String originalText = "";
    private String translatedText = "";
    
    // Popup geometry
    private RectF popupRect = new RectF();
    private RectF closeButtonRect = new RectF();
    private RectF headerRect = new RectF();
    
    // Position (can be dragged)
    private float popupX;
    private float popupY;
    private int popupWidth;
    private int popupHeight;
    
    // Drag state
    private boolean isDragging = false;
    private PointF dragStartPoint = new PointF();
    private PointF popupStartPos = new PointF();
    
    // Dimensions
    private float density;
    private int screenWidth;
    private int screenHeight;
    private static final int POPUP_WIDTH_DP = 300;
    private static final int POPUP_MIN_HEIGHT_DP = 150;
    private static final int POPUP_MAX_HEIGHT_DP = 400;
    private static final int HEADER_HEIGHT_DP = 44;
    private static final int CLOSE_BTN_SIZE_DP = 32;
    private static final int CORNER_RADIUS_DP = 16;
    private static final int PADDING_DP = 16;
    
    // Paints
    private Paint shadowPaint;
    private Paint bgPaint;
    private Paint headerPaint;
    private Paint closeBtnPaint;
    private Paint closeBtnIconPaint;
    private TextPaint headerTextPaint;
    private TextPaint originalTextPaint;
    private TextPaint translatedTextPaint;
    private Paint dividerPaint;
    
    // Listener
    private OnPopupEventListener listener;
    
    // Visibility
    private boolean isVisible = false;
    
    public interface OnPopupEventListener {
        void onCloseClick();
        void onOutsideTap();
    }
    
    public void setOnPopupEventListener(OnPopupEventListener listener) {
        this.listener = listener;
    }
    
    public ResultPopupView(Context context) {
        super(context);
        
        DisplayMetrics dm = context.getResources().getDisplayMetrics();
        density = dm.density;
        screenWidth = dm.widthPixels;
        screenHeight = dm.heightPixels;
        
        // Calculate popup dimensions
        popupWidth = (int) (POPUP_WIDTH_DP * density);
        popupHeight = (int) (POPUP_MIN_HEIGHT_DP * density);
        
        // Initial position (center of screen)
        popupX = (screenWidth - popupWidth) / 2f;
        popupY = (screenHeight - popupHeight) / 2f;
        
        initPaints();
        updatePopupRect();
    }
    
    private void initPaints() {
        // Shadow
        shadowPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        shadowPaint.setColor(Color.argb(60, 0, 0, 0));
        shadowPaint.setShadowLayer(16 * density, 0, 4 * density, Color.argb(80, 0, 0, 0));
        
        // Background
        bgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        bgPaint.setColor(Color.WHITE);
        
        // Header background
        headerPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        headerPaint.setColor(Color.parseColor("#4285F4")); // Blue header
        
        // Close button background
        closeBtnPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        closeBtnPaint.setColor(Color.parseColor("#E8F0FE"));
        
        // Close button icon (X)
        closeBtnIconPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        closeBtnIconPaint.setColor(Color.parseColor("#4285F4"));
        closeBtnIconPaint.setStrokeWidth(2.5f * density);
        closeBtnIconPaint.setStrokeCap(Paint.Cap.ROUND);
        closeBtnIconPaint.setStyle(Paint.Style.STROKE);
        
        // Header text
        headerTextPaint = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        headerTextPaint.setColor(Color.WHITE);
        headerTextPaint.setTextSize(16 * density);
        headerTextPaint.setFakeBoldText(true);
        
        // Original text (smaller, gray)
        originalTextPaint = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        originalTextPaint.setColor(Color.parseColor("#666666"));
        originalTextPaint.setTextSize(13 * density);
        
        // Translated text (larger, black)
        translatedTextPaint = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        translatedTextPaint.setColor(Color.parseColor("#1A1A1A"));
        translatedTextPaint.setTextSize(16 * density);
        
        // Divider
        dividerPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        dividerPaint.setColor(Color.parseColor("#E0E0E0"));
        dividerPaint.setStrokeWidth(1 * density);
    }
    
    private void updatePopupRect() {
        popupRect.set(popupX, popupY, popupX + popupWidth, popupY + popupHeight);
        
        float headerHeight = HEADER_HEIGHT_DP * density;
        headerRect.set(popupX, popupY, popupX + popupWidth, popupY + headerHeight);
        
        float closeBtnSize = CLOSE_BTN_SIZE_DP * density;
        float closeBtnMargin = (headerHeight - closeBtnSize) / 2;
        closeButtonRect.set(
            popupX + popupWidth - closeBtnSize - closeBtnMargin,
            popupY + closeBtnMargin,
            popupX + popupWidth - closeBtnMargin,
            popupY + closeBtnMargin + closeBtnSize
        );
    }
    
    public void show(String original, String translated, int hintX, int hintY) {
        this.originalText = original != null ? original : "";
        this.translatedText = translated != null ? translated : "";
        this.isVisible = true;
        
        // Calculate required height based on text content
        calculatePopupHeight();
        
        // Position popup near the hint position, but ensure it stays on screen
        positionPopup(hintX, hintY);
        
        updatePopupRect();
        invalidate();
        
        Log.d(TAG, "Popup shown: " + translatedText.substring(0, Math.min(50, translatedText.length())));
    }
    
    public void hide() {
        this.isVisible = false;
        invalidate();
        Log.d(TAG, "Popup hidden");
    }
    
    public boolean isPopupVisible() {
        return isVisible;
    }
    
    private void calculatePopupHeight() {
        float padding = PADDING_DP * density;
        float headerHeight = HEADER_HEIGHT_DP * density;
        int textWidth = (int) (popupWidth - padding * 2);
        
        // Calculate original text height
        StaticLayout originalLayout = StaticLayout.Builder
            .obtain(originalText, 0, originalText.length(), originalTextPaint, textWidth)
            .setAlignment(Layout.Alignment.ALIGN_NORMAL)
            .build();
        
        // Calculate translated text height
        StaticLayout translatedLayout = StaticLayout.Builder
            .obtain(translatedText, 0, translatedText.length(), translatedTextPaint, textWidth)
            .setAlignment(Layout.Alignment.ALIGN_NORMAL)
            .build();
        
        // Total height = header + original + divider + translated + padding
        float contentHeight = originalLayout.getHeight() + 
                             16 * density + // gap 
                             translatedLayout.getHeight();
        
        float totalHeight = headerHeight + padding * 2 + contentHeight;
        
        // Clamp to min/max
        popupHeight = (int) Math.max(POPUP_MIN_HEIGHT_DP * density, 
                        Math.min(POPUP_MAX_HEIGHT_DP * density, totalHeight));
    }
    
    private void positionPopup(int hintX, int hintY) {
        // Try to position popup below the hint point
        float margin = 20 * density;
        
        popupX = hintX - popupWidth / 2f;
        popupY = hintY + margin;
        
        // Keep within screen bounds
        if (popupX < margin) popupX = margin;
        if (popupX + popupWidth > screenWidth - margin) popupX = screenWidth - margin - popupWidth;
        
        if (popupY + popupHeight > screenHeight - margin) {
            // Show above the hint point instead
            popupY = hintY - popupHeight - margin;
        }
        if (popupY < margin) popupY = margin;
    }
    
    @Override
    public boolean dispatchTouchEvent(MotionEvent event) {
        if (!isVisible) {
            return false; // Pass through when not visible
        }
        
        float x = event.getX();
        float y = event.getY();
        
        switch (event.getAction()) {
            case MotionEvent.ACTION_DOWN:
                // Check close button
                if (closeButtonRect.contains(x, y)) {
                    if (listener != null) {
                        listener.onCloseClick();
                    }
                    return true;
                }
                
                // Check if on header (start drag)
                if (headerRect.contains(x, y)) {
                    isDragging = true;
                    dragStartPoint.set(x, y);
                    popupStartPos.set(popupX, popupY);
                    return true;
                }
                
                // Check if on popup body (consume touch)
                if (popupRect.contains(x, y)) {
                    return true;
                }
                
                // Outside popup - notify and pass through
                if (listener != null) {
                    listener.onOutsideTap();
                }
                return false;
                
            case MotionEvent.ACTION_MOVE:
                if (isDragging) {
                    float dx = x - dragStartPoint.x;
                    float dy = y - dragStartPoint.y;
                    
                    popupX = popupStartPos.x + dx;
                    popupY = popupStartPos.y + dy;
                    
                    // Keep within bounds
                    float margin = 10 * density;
                    popupX = Math.max(margin, Math.min(screenWidth - popupWidth - margin, popupX));
                    popupY = Math.max(margin, Math.min(screenHeight - popupHeight - margin, popupY));
                    
                    updatePopupRect();
                    invalidate();
                    return true;
                }
                break;
                
            case MotionEvent.ACTION_UP:
            case MotionEvent.ACTION_CANCEL:
                if (isDragging) {
                    isDragging = false;
                    return true;
                }
                break;
        }
        
        return popupRect.contains(x, y);
    }
    
    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        
        if (!isVisible) return;
        
        // Enable software layer for shadow
        setLayerType(LAYER_TYPE_SOFTWARE, null);
        
        float cornerRadius = CORNER_RADIUS_DP * density;
        float padding = PADDING_DP * density;
        float headerHeight = HEADER_HEIGHT_DP * density;
        
        // Draw shadow
        RectF shadowRect = new RectF(popupRect);
        shadowRect.offset(0, 4 * density);
        canvas.drawRoundRect(shadowRect, cornerRadius, cornerRadius, shadowPaint);
        
        // Draw popup background
        canvas.drawRoundRect(popupRect, cornerRadius, cornerRadius, bgPaint);
        
        // Draw header with top rounded corners
        Path headerPath = new Path();
        headerPath.addRoundRect(headerRect, 
            new float[]{cornerRadius, cornerRadius, cornerRadius, cornerRadius, 0, 0, 0, 0},
            Path.Direction.CW);
        canvas.drawPath(headerPath, headerPaint);
        
        // Draw header title
        String title = "📝 Kết quả dịch";
        Paint.FontMetrics fm = headerTextPaint.getFontMetrics();
        float textY = headerRect.centerY() - (fm.ascent + fm.descent) / 2;
        canvas.drawText(title, popupX + padding, textY, headerTextPaint);
        
        // Draw close button
        canvas.drawOval(closeButtonRect, closeBtnPaint);
        drawCloseIcon(canvas);
        
        // Draw content area
        float contentTop = popupY + headerHeight + padding;
        int textWidth = (int) (popupWidth - padding * 2);
        
        // Draw original text (with label)
        canvas.save();
        canvas.translate(popupX + padding, contentTop);
        
        String originalLabel = "📖 Gốc: ";
        canvas.drawText(originalLabel, 0, -originalTextPaint.getFontMetrics().ascent, originalTextPaint);
        
        float labelWidth = originalTextPaint.measureText(originalLabel);
        StaticLayout originalLayout = StaticLayout.Builder
            .obtain(originalText, 0, originalText.length(), originalTextPaint, (int)(textWidth - labelWidth))
            .setAlignment(Layout.Alignment.ALIGN_NORMAL)
            .build();
        
        canvas.translate(labelWidth, 0);
        originalLayout.draw(canvas);
        canvas.restore();
        
        // Draw divider
        float dividerY = contentTop + originalLayout.getHeight() + 8 * density;
        canvas.drawLine(popupX + padding, dividerY, popupX + popupWidth - padding, dividerY, dividerPaint);
        
        // Draw translated text
        float translatedTop = dividerY + 8 * density;
        canvas.save();
        canvas.translate(popupX + padding, translatedTop);
        
        String translatedLabel = "🌐 Dịch: ";
        canvas.drawText(translatedLabel, 0, -translatedTextPaint.getFontMetrics().ascent, translatedTextPaint);
        
        float transLabelWidth = translatedTextPaint.measureText(translatedLabel);
        StaticLayout translatedLayout = StaticLayout.Builder
            .obtain(translatedText, 0, translatedText.length(), translatedTextPaint, (int)(textWidth - transLabelWidth))
            .setAlignment(Layout.Alignment.ALIGN_NORMAL)
            .build();
        
        canvas.translate(transLabelWidth, 0);
        translatedLayout.draw(canvas);
        canvas.restore();
    }
    
    private void drawCloseIcon(Canvas canvas) {
        float cx = closeButtonRect.centerX();
        float cy = closeButtonRect.centerY();
        float size = 8 * density;
        
        canvas.drawLine(cx - size, cy - size, cx + size, cy + size, closeBtnIconPaint);
        canvas.drawLine(cx + size, cy - size, cx - size, cy + size, closeBtnIconPaint);
    }
}
