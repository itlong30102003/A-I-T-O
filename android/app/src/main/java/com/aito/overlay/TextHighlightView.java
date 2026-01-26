package com.aito.overlay;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.util.DisplayMetrics;
import android.view.View;

/**
 * TextHighlightView - Draws a semi-transparent blue highlight over detected text
 * 
 * Features:
 * - Semi-transparent blue rectangle over text bounding box
 * - Subtle border for visibility
 * - Pass-through touch events
 */
public class TextHighlightView extends View {
    private static final String TAG = "TextHighlightView";
    
    // Highlight rectangle (in screen coordinates)
    private RectF highlightRect = new RectF();
    private boolean isVisible = false;
    
    // Dimensions
    private float density;
    
    // Paints
    private Paint fillPaint;
    private Paint borderPaint;
    private int statusBarHeight = 0;
    
    public TextHighlightView(Context context) {
        super(context);
        
        DisplayMetrics dm = context.getResources().getDisplayMetrics();
        density = dm.density;
        
        // Get status bar height for coordinate adjustment
        int resourceId = context.getResources().getIdentifier("status_bar_height", "dimen", "android");
        if (resourceId > 0) {
            statusBarHeight = context.getResources().getDimensionPixelSize(resourceId);
        }
        
        // Enable fullscreen layout that covers status bar
        setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        );
        
        initPaints();
    }
    
    private void initPaints() {
        // Fill (semi-transparent blue)
        fillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        fillPaint.setColor(Color.argb(50, 33, 150, 243)); // ~20% opacity blue
        fillPaint.setStyle(Paint.Style.FILL);
        
        // Border (slightly more visible blue)
        borderPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        borderPaint.setColor(Color.argb(120, 33, 150, 243)); // ~47% opacity blue
        borderPaint.setStyle(Paint.Style.STROKE);
        borderPaint.setStrokeWidth(2 * density);
    }
    
    public void showHighlight(int x, int y, int width, int height) {
        // Add small padding for better visibility
        float padding = 4 * density;
        // Adjust Y by subtracting status bar height (OCR coords include status bar)
        int adjustedY = y - statusBarHeight;
        highlightRect.set(
            x - padding,
            adjustedY - padding,
            x + width + padding,
            adjustedY + height + padding
        );
        isVisible = true;
        invalidate();
    }
    
    public void hide() {
        isVisible = false;
        highlightRect.setEmpty();
        invalidate();
    }
    
    public boolean isHighlightVisible() {
        return isVisible;
    }
    
    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        
        if (!isVisible || highlightRect.isEmpty()) return;
        
        float cornerRadius = 4 * density;
        
        // Draw fill
        canvas.drawRoundRect(highlightRect, cornerRadius, cornerRadius, fillPaint);
        
        // Draw border
        canvas.drawRoundRect(highlightRect, cornerRadius, cornerRadius, borderPaint);
    }
}
