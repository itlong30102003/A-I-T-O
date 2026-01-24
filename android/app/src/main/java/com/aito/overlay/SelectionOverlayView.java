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
    
    // Visual styling
    private Paint selectionPaint;
    private Paint selectionBorderPaint;
    private Paint instructionPaint;
    private Paint instructionBgPaint;
    
    // Dimensions
    private int screenWidth;
    private int screenHeight;
    private float density;
    
    // Listener
    private OnSelectionListener listener;
    
    public interface OnSelectionListener {
        void onWordTapped(int x, int y);
        void onParagraphSelected(int x, int y, int width, int height);
        void onSelectionCancelled();
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
        
        initPaints();
    }
    
    private void initPaints() {
        // Selection area fill (semi-transparent blue)
        selectionPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        selectionPaint.setColor(Color.argb(60, 33, 150, 243)); // Light blue
        selectionPaint.setStyle(Paint.Style.FILL);
        
        // Selection border
        selectionBorderPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        selectionBorderPaint.setColor(Color.parseColor("#2196F3")); // Blue
        selectionBorderPaint.setStyle(Paint.Style.STROKE);
        selectionBorderPaint.setStrokeWidth(3 * density);
        
        // Instruction text
        instructionPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        instructionPaint.setColor(Color.WHITE);
        instructionPaint.setTextSize(14 * density);
        instructionPaint.setTextAlign(Paint.Align.CENTER);
        
        // Instruction background
        instructionBgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        instructionBgPaint.setColor(Color.argb(180, 0, 0, 0));
        instructionBgPaint.setStyle(Paint.Style.FILL);
    }
    
    public void setMode(String mode) {
        this.mode = mode != null ? mode : "WORD";
        invalidate();
    }
    
    public void setActive(boolean active) {
        this.isActive = active;
        if (!active) {
            isDrawingSelection = false;
            selectionRect.setEmpty();
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
        
        if ("WORD".equals(mode)) {
            return handleWordModeTouchEvent(event, x, y);
        } else if ("PARAGRAPH".equals(mode)) {
            return handleParagraphModeTouchEvent(event, x, y);
        }
        
        return false;
    }
    
    private boolean handleWordModeTouchEvent(MotionEvent event, float x, float y) {
        if (event.getAction() == MotionEvent.ACTION_DOWN) {
            Log.d(TAG, "Word tapped at: " + (int)x + ", " + (int)y);
            if (listener != null) {
                listener.onWordTapped((int)x, (int)y);
            }
            return true;
        }
        return true; // Consume all touches in word mode
    }
    
    private boolean handleParagraphModeTouchEvent(MotionEvent event, float x, float y) {
        switch (event.getAction()) {
            case MotionEvent.ACTION_DOWN:
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
                        Log.d(TAG, "Paragraph selected: " + selectionRect);
                        if (listener != null) {
                            listener.onParagraphSelected(
                                (int) selectionRect.left,
                                (int) selectionRect.top,
                                (int) selectionRect.width(),
                                (int) selectionRect.height()
                            );
                        }
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
        
        // Draw selection rectangle (for PARAGRAPH mode)
        if ("PARAGRAPH".equals(mode) && !selectionRect.isEmpty()) {
            canvas.drawRect(selectionRect, selectionPaint);
            canvas.drawRect(selectionRect, selectionBorderPaint);
            
            // Draw corner handles
            drawCornerHandles(canvas);
        }
        
        // Draw crosshair for WORD mode
        if ("WORD".equals(mode)) {
            drawCenterIndicator(canvas);
        }
    }
    
    private void drawInstructionBanner(Canvas canvas) {
        String instruction;
        if ("WORD".equals(mode)) {
            instruction = "👆 Chạm vào từ bạn muốn dịch";
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
    
    private void drawCornerHandles(Canvas canvas) {
        float handleRadius = 8 * density;
        Paint handlePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        handlePaint.setColor(Color.parseColor("#2196F3"));
        handlePaint.setStyle(Paint.Style.FILL);
        
        // Four corners
        canvas.drawCircle(selectionRect.left, selectionRect.top, handleRadius, handlePaint);
        canvas.drawCircle(selectionRect.right, selectionRect.top, handleRadius, handlePaint);
        canvas.drawCircle(selectionRect.left, selectionRect.bottom, handleRadius, handlePaint);
        canvas.drawCircle(selectionRect.right, selectionRect.bottom, handleRadius, handlePaint);
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
