package com.aito.overlay;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.util.DisplayMetrics;
import android.view.View;
import android.view.animation.LinearInterpolator;

/**
 * LoadingIndicatorView - Displays a spinning loader at tap position
 * 
 * Features:
 * - Circular progress spinner animation
 * - Positioned at user tap location
 * - Semi-transparent background circle
 */
public class LoadingIndicatorView extends View {
    private static final String TAG = "LoadingIndicatorView";
    
    // Position
    private float centerX;
    private float centerY;
    private boolean isVisible = false;
    
    // Dimensions
    private float density;
    private static final int INDICATOR_SIZE_DP = 40;
    private static final int STROKE_WIDTH_DP = 3;
    
    // Animation
    private float rotationAngle = 0f;
    private ValueAnimator rotationAnimator;
    
    // Paints
    private Paint bgPaint;
    private Paint spinnerPaint;
    private Paint arcPaint;
    private int statusBarHeight = 0;
    
    public LoadingIndicatorView(Context context) {
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
        initAnimation();
    }
    
    private void initPaints() {
        // Background circle (semi-transparent white)
        bgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        bgPaint.setColor(Color.argb(200, 255, 255, 255));
        bgPaint.setStyle(Paint.Style.FILL);
        bgPaint.setShadowLayer(8 * density, 0, 2 * density, Color.argb(60, 0, 0, 0));
        
        // Spinner track (light gray)
        spinnerPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        spinnerPaint.setColor(Color.parseColor("#E0E0E0"));
        spinnerPaint.setStyle(Paint.Style.STROKE);
        spinnerPaint.setStrokeWidth(STROKE_WIDTH_DP * density);
        spinnerPaint.setStrokeCap(Paint.Cap.ROUND);
        
        // Spinner arc (blue)
        arcPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        arcPaint.setColor(Color.parseColor("#2196F3"));
        arcPaint.setStyle(Paint.Style.STROKE);
        arcPaint.setStrokeWidth(STROKE_WIDTH_DP * density);
        arcPaint.setStrokeCap(Paint.Cap.ROUND);
    }
    
    private void initAnimation() {
        rotationAnimator = ValueAnimator.ofFloat(0f, 360f);
        rotationAnimator.setDuration(1000);
        rotationAnimator.setRepeatCount(ValueAnimator.INFINITE);
        rotationAnimator.setInterpolator(new LinearInterpolator());
        rotationAnimator.addUpdateListener(animation -> {
            rotationAngle = (float) animation.getAnimatedValue();
            invalidate();
        });
    }
    
    public void showAt(int x, int y) {
        this.centerX = x;
        // Adjust Y by subtracting status bar height (tap coords include status bar)
        this.centerY = y - statusBarHeight;
        this.isVisible = true;
        
        if (!rotationAnimator.isRunning()) {
            rotationAnimator.start();
        }
        invalidate();
    }
    
    public void hide() {
        this.isVisible = false;
        if (rotationAnimator.isRunning()) {
            rotationAnimator.cancel();
        }
        invalidate();
    }
    
    public boolean isIndicatorVisible() {
        return isVisible;
    }
    
    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        
        if (!isVisible) return;
        
        setLayerType(LAYER_TYPE_SOFTWARE, null);
        
        float size = INDICATOR_SIZE_DP * density;
        float radius = size / 2;
        float innerRadius = radius - 8 * density;
        
        // Draw background circle
        canvas.drawCircle(centerX, centerY, radius, bgPaint);
        
        // Draw spinner track
        RectF arcRect = new RectF(
            centerX - innerRadius,
            centerY - innerRadius,
            centerX + innerRadius,
            centerY + innerRadius
        );
        canvas.drawOval(arcRect, spinnerPaint);
        
        // Draw spinning arc
        canvas.save();
        canvas.rotate(rotationAngle, centerX, centerY);
        canvas.drawArc(arcRect, 0, 90, false, arcPaint);
        canvas.restore();
    }
    
    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        if (rotationAnimator != null && rotationAnimator.isRunning()) {
            rotationAnimator.cancel();
        }
    }
}
