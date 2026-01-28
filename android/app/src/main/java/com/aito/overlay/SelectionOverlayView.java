package com.aito.overlay;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.PointF;
import android.graphics.RectF;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.MotionEvent;
import android.view.View;

import java.util.ArrayList;
import java.util.List;

/**
 * SelectionOverlayView - Interactive overlay for word/paragraph selection
 * 
 * Modes:
 * - WORD: Single tap to select a word at that position
 * - PARAGRAPH: Draw rectangle to select a region
 */
public class SelectionOverlayView extends View {
    private static final String TAG = "SelectionOverlayView";
    
    // Selection mode
    private String mode = "WORD"; // "WORD" or "PARAGRAPH"
    private boolean isActive = false;
    
    // For PARAGRAPH mode: rectangle selection
    private RectF selectionRect = new RectF();
    private boolean isDrawingSelection = false;
    private PointF startPoint = new PointF();
    
    // For PARAGRAPH mode: persistent highlight (after smart snap)
    private RectF highlightRect = new RectF();
    private Paint highlightPaint;
    private Paint highlightBorderPaint;
    
    // Visual styling
    private Paint selectionPaint;
    private Paint selectionBorderPaint;
    private Paint instructionPaint;
    private Paint instructionBgPaint;
    
    // Pre-scan detected boxes (for WORD mode)
    private List<RectF> detectedBoxes = new ArrayList<>();
    private Paint detectedBoxPaint;
    private Paint detectedBoxFillPaint;
    
    // Dimensions
    private int screenWidth;
    private int screenHeight;
    private float density;
    private int statusBarHeight = 0;
    
    // Listener
    private OnSelectionListener listener;
    
    public interface OnSelectionListener {
        void onWordTapped(int x, int y);
        void onParagraphSelected(int x, int y, int width, int height);
        void onSelectionCancelled();
        void onSelectionStarted(); // New: fired when user starts drawing new selection
    }
    
    public void setOnSelectionListener(OnSelectionListener listener) {
        this.listener = listener;
    }
    
    public SelectionOverlayView(Context context) {
        super(context);
        
        DisplayMetrics dm = context.getResources().getDisplayMetrics();
        density = dm.density;
        screenWidth = dm.widthPixels;
        screenHeight = dm.heightPixels;
        
        // Get status bar height for coordinate adjustment
        int resourceId = context.getResources().getIdentifier("status_bar_height", "dimen", "android");
        if (resourceId > 0) {
            statusBarHeight = context.getResources().getDimensionPixelSize(resourceId);
        }
        Log.d(TAG, "Status bar height: " + statusBarHeight + "px");
        
        // Enable fullscreen layout that covers status bar
        setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        );
        
        initPaints();
    }
    
    private void initPaints() {
        // Selection area fill (semi-transparent blue) - for user drawing
        selectionPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        selectionPaint.setColor(Color.argb(60, 33, 150, 243)); // Light blue
        selectionPaint.setStyle(Paint.Style.FILL);
        
        // Selection border - for user drawing
        selectionBorderPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        selectionBorderPaint.setColor(Color.parseColor("#2196F3")); // Blue
        selectionBorderPaint.setStyle(Paint.Style.STROKE);
        selectionBorderPaint.setStrokeWidth(3 * density);
        
        // Highlight fill (semi-transparent green) - for smart-snapped result
        highlightPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        highlightPaint.setColor(Color.argb(60, 76, 175, 80)); // Light green
        highlightPaint.setStyle(Paint.Style.FILL);
        
        // Highlight border - for smart-snapped result
        highlightBorderPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        highlightBorderPaint.setColor(Color.parseColor("#4CAF50")); // Green
        highlightBorderPaint.setStyle(Paint.Style.STROKE);
        highlightBorderPaint.setStrokeWidth(4 * density);
        
        // Instruction text
        instructionPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        instructionPaint.setColor(Color.WHITE);
        instructionPaint.setTextSize(14 * density);
        instructionPaint.setTextAlign(Paint.Align.CENTER);
        
        // Instruction background
        instructionBgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        instructionBgPaint.setColor(Color.argb(180, 0, 0, 0));
        instructionBgPaint.setStyle(Paint.Style.FILL);
        
        // Detected boxes stroke (cyan)
        detectedBoxPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        detectedBoxPaint.setColor(Color.parseColor("#00BCD4")); // Cyan
        detectedBoxPaint.setStyle(Paint.Style.STROKE);
        detectedBoxPaint.setStrokeWidth(2.5f * density);
        
        // Detected boxes fill (very subtle)
        detectedBoxFillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        detectedBoxFillPaint.setColor(Color.argb(25, 0, 188, 212)); // Light cyan
        detectedBoxFillPaint.setStyle(Paint.Style.FILL);
    }
    
    public void setMode(String mode) {
        this.mode = mode != null ? mode : "WORD";
        // Clear detected boxes when switching modes
        if (!"WORD".equals(this.mode)) {
            detectedBoxes.clear();
        }
        invalidate();
    }
    
    /**
     * Set detected text bounding boxes for WORD mode pre-scan
     * @param boxes List of RectF representing text element bounding boxes
     */
    public void setDetectedBoxes(List<RectF> boxes) {
        this.detectedBoxes.clear();
        if (boxes != null) {
            this.detectedBoxes.addAll(boxes);
        }
        Log.d(TAG, "Set " + this.detectedBoxes.size() + " detected boxes");
        invalidate();
    }
    
    /**
     * Clear all detected boxes
     */
    public void clearDetectedBoxes() {
        this.detectedBoxes.clear();
        invalidate();
    }
    
    /**
     * Check if there are detected boxes available
     */
    public boolean hasDetectedBoxes() {
        return !detectedBoxes.isEmpty();
    }
    
    /**
     * Update the persistent highlight box (for PARAGRAPH mode smart snap)
     * Called from JS after smart snap calculation
     * @param x Left coordinate (bitmap coordinates)
     * @param y Top coordinate (bitmap coordinates)
     * @param width Width of highlight
     * @param height Height of highlight
     */
    public void updateHighlightBox(float x, float y, float width, float height) {
        // Clear drawing rect when highlight arrives
        selectionRect.setEmpty();
        
        // Convert bitmap Y to screen Y by subtracting statusBarHeight
        float screenY = y - statusBarHeight;
        highlightRect.set(x, screenY, x + width, screenY + height);
        Log.d(TAG, "Highlight updated: bitmap(" + x + "," + y + ") -> screen(" + x + "," + screenY + ") " + width + "x" + height);
        invalidate();
    }
    
    /**
     * Clear the persistent highlight box
     */
    public void clearHighlightBox() {
        highlightRect.setEmpty();
        invalidate();
    }
    
    public void setActive(boolean active) {
        this.isActive = active;
        if (!active) {
            isDrawingSelection = false;
            selectionRect.setEmpty();
            highlightRect.setEmpty();
        }
        invalidate();
    }
    
    public boolean isActive() {
        return isActive;
    }
    
    @Override
    public boolean onTouchEvent(MotionEvent event) {
        if (!isActive) {
            return false; // Pass through when not active
        }
        
        float x = event.getX();
        float y = event.getY();
        
        // Logo exclusion zone: bottom-right corner where the logo is positioned
        // Logo size is 28dp, margin is 16dp, and y offset is 100px from bottom
        // We create a generous exclusion zone to ensure logo is always tappable
        float logoExclusionWidth = 96 * density;  // ~96dp from right edge
        float logoExclusionHeight = 180 * density; // ~180dp from bottom edge
        
        boolean isInLogoZone = x > (screenWidth - logoExclusionWidth) && 
                               y > (screenHeight - logoExclusionHeight);
        
        if (isInLogoZone) {
            Log.d(TAG, "Touch in logo exclusion zone, passing through");
            return false; // Pass through to allow logo click
        }
        
        if ("WORD".equals(mode)) {
            return handleWordModeTouchEvent(event, x, y);
        } else if ("PARAGRAPH".equals(mode)) {
            return handleParagraphModeTouchEvent(event, x, y);
        }
        
        return false;
    }
    
    private boolean handleWordModeTouchEvent(MotionEvent event, float x, float y) {
        if (event.getAction() == MotionEvent.ACTION_DOWN) {
            // Convert screen Y back to bitmap Y by adding statusBarHeight
            // This is needed because cached OCR blocks use bitmap coordinates
            int bitmapY = (int)y + statusBarHeight;
            Log.d(TAG, "Word tapped at screen: " + (int)x + ", " + (int)y + " -> bitmap: " + (int)x + ", " + bitmapY);
            if (listener != null) {
                listener.onWordTapped((int)x, bitmapY);
            }
            return true;
        }
        return true; // Consume all touches in word mode
    }
    
    private boolean handleParagraphModeTouchEvent(MotionEvent event, float x, float y) {
        switch (event.getAction()) {
            case MotionEvent.ACTION_DOWN:
                // Redraw mechanism: Clear old highlight and notify JS to hide popup
                clearHighlightBox();
                if (listener != null) {
                    listener.onSelectionStarted();
                }
                
                // Start new selection
                startPoint.set(x, y);
                selectionRect.set(x, y, x, y);
                isDrawingSelection = true;
                invalidate();
                return true;
                
            case MotionEvent.ACTION_MOVE:
                if (isDrawingSelection) {
                    updateSelectionRect(x, y);
                    invalidate();
                }
                return true;
                
            case MotionEvent.ACTION_UP:
                if (isDrawingSelection) {
                    updateSelectionRect(x, y);
                    isDrawingSelection = false;
                    
                    // Only trigger if selection has meaningful size
                    if (selectionRect.width() > 20 && selectionRect.height() > 20) {
                        // Convert screen Y to bitmap Y by adding statusBarHeight
                        // This is needed because OCR blocks use bitmap coordinates which include status bar area
                        int bitmapTop = (int) selectionRect.top + statusBarHeight;
                        Log.d(TAG, "Paragraph selected: screen=" + selectionRect + " -> bitmapTop=" + bitmapTop);
                        if (listener != null) {
                            listener.onParagraphSelected(
                                (int) selectionRect.left,
                                bitmapTop,
                                (int) selectionRect.width(),
                                (int) selectionRect.height()
                            );
                        }
                        // Clear selectionRect after triggering event to follow user request
                        selectionRect.setEmpty();
                    } else {
                        // Too small, treat as cancelled
                        selectionRect.setEmpty();
                        if (listener != null) {
                            listener.onSelectionCancelled();
                        }
                    }
                    invalidate();
                }
                return true;
                
            case MotionEvent.ACTION_CANCEL:
                isDrawingSelection = false;
                selectionRect.setEmpty();
                if (listener != null) {
                    listener.onSelectionCancelled();
                }
                invalidate();
                return true;
        }
        return false;
    }
    
    private void updateSelectionRect(float currentX, float currentY) {
        float left = Math.min(startPoint.x, currentX);
        float top = Math.min(startPoint.y, currentY);
        float right = Math.max(startPoint.x, currentX);
        float bottom = Math.max(startPoint.y, currentY);
        selectionRect.set(left, top, right, bottom);
    }
    
    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        
        if (!isActive) return;
        
        // Draw instruction banner at top
        drawInstructionBanner(canvas);
        
        // Draw user selection rectangle (blue) while drawing (for PARAGRAPH mode)
        if ("PARAGRAPH".equals(mode) && !selectionRect.isEmpty()) {
            canvas.drawRect(selectionRect, selectionPaint);
            canvas.drawRect(selectionRect, selectionBorderPaint);
            
            // Draw corner handles
            drawCornerHandles(canvas, selectionRect, selectionBorderPaint);
        }
        
        // Draw persistent highlight box (green) after smart snap (for PARAGRAPH mode)
        if ("PARAGRAPH".equals(mode) && !highlightRect.isEmpty()) {
            canvas.drawRect(highlightRect, highlightPaint);
            canvas.drawRect(highlightRect, highlightBorderPaint);
            
            // Draw corner handles for highlight
            drawCornerHandles(canvas, highlightRect, highlightBorderPaint);
        }
        
        // Draw detected boxes for WORD mode (pre-scan)
        if ("WORD".equals(mode) && !detectedBoxes.isEmpty()) {
            drawDetectedBoxes(canvas);
        } else if ("WORD".equals(mode)) {
            // Fallback: show center indicator if no boxes detected yet
            drawCenterIndicator(canvas);
        }
    }
    
    /**
     * Draw pre-scanned detected text bounding boxes
     * Note: Subtract statusBarHeight from Y because OCR coordinates are from bitmap
     * which includes status bar area, but overlay draws from top of screen
     */
    private void drawDetectedBoxes(Canvas canvas) {
        for (RectF box : detectedBoxes) {
            // Adjust Y coordinate by subtracting status bar height
            RectF adjustedBox = new RectF(
                box.left,
                box.top - statusBarHeight,
                box.right,
                box.bottom - statusBarHeight
            );
            // Draw subtle fill
            canvas.drawRect(adjustedBox, detectedBoxFillPaint);
            // Draw border
            canvas.drawRect(adjustedBox, detectedBoxPaint);
        }
    }
    
    private void drawInstructionBanner(Canvas canvas) {
        String instruction;
        if ("WORD".equals(mode)) {
            if (!detectedBoxes.isEmpty()) {
                instruction = "👆 Chạm vào khung để dịch (" + detectedBoxes.size() + " từ)";
            } else {
                instruction = "⏳ Đang quét văn bản...";
            }
        } else {
            instruction = "✋ Kéo để chọn vùng văn bản";
        }
        
        // Banner dimensions
        float bannerHeight = 48 * density;
        float bannerTop = 80 * density; // Below status bar
        RectF bannerRect = new RectF(16 * density, bannerTop, screenWidth - 16 * density, bannerTop + bannerHeight);
        
        // Draw banner background
        float radius = 12 * density;
        canvas.drawRoundRect(bannerRect, radius, radius, instructionBgPaint);
        
        // Draw text
        Paint.FontMetrics fm = instructionPaint.getFontMetrics();
        float textY = bannerRect.centerY() - (fm.ascent + fm.descent) / 2;
        canvas.drawText(instruction, bannerRect.centerX(), textY, instructionPaint);
    }
    
    private void drawCornerHandles(Canvas canvas, RectF rect, Paint borderPaint) {
        float handleRadius = 8 * density;
        Paint handlePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        handlePaint.setColor(borderPaint.getColor());
        handlePaint.setStyle(Paint.Style.FILL);
        
        // Four corners
        canvas.drawCircle(rect.left, rect.top, handleRadius, handlePaint);
        canvas.drawCircle(rect.right, rect.top, handleRadius, handlePaint);
        canvas.drawCircle(rect.left, rect.bottom, handleRadius, handlePaint);
        canvas.drawCircle(rect.right, rect.bottom, handleRadius, handlePaint);
    }
    
    private void drawCenterIndicator(Canvas canvas) {
        // Draw a subtle hint in center
        Paint hintPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        hintPaint.setColor(Color.argb(100, 255, 255, 255));
        hintPaint.setTextSize(16 * density);
        hintPaint.setTextAlign(Paint.Align.CENTER);
        
        // Finger pointer emoji
        canvas.drawText("👆", screenWidth / 2f, screenHeight / 2f, hintPaint);
    }
}
