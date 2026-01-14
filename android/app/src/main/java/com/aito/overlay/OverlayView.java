package com.aito.overlay;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;
import android.view.View;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

public class OverlayView extends View {
    private final Paint paintBackground;
    private final TextPaint textPaint;
    private List<TextBlock> textBlocks = new ArrayList<>();
    private int statusBarHeight = 0;

    public static class TextBlock {
        String text;
        Rect rect;

        public TextBlock(String text, Rect rect) {
            this.text = text;
            this.rect = rect;
        }
    }

    public OverlayView(Context context) {
        super(context);

        paintBackground = new Paint();
        paintBackground.setColor(Color.argb(200, 0, 0, 0)); // Semi-transparent black
        paintBackground.setStyle(Paint.Style.FILL);

        textPaint = new TextPaint();
        textPaint.setColor(Color.WHITE);
        textPaint.setAntiAlias(true);

        // Calculate status bar height
        int resourceId = context.getResources().getIdentifier("status_bar_height", "dimen", "android");
        if (resourceId > 0) {
            statusBarHeight = context.getResources().getDimensionPixelSize(resourceId);
        }
    }

    public void updateBlocks(String jsonString) {
        textBlocks.clear();
        try {
            JSONArray jsonArray = new JSONArray(jsonString);
            for (int i = 0; i < jsonArray.length(); i++) {
                JSONObject obj = jsonArray.getJSONObject(i);
                String text = obj.optString("text", "");
                
                JSONObject boundingBox = obj.optJSONObject("boundingBox");
                
                if (boundingBox != null) {
                    int x = boundingBox.optInt("x", 0);
                    int y = boundingBox.optInt("y", 0);
                    int w = boundingBox.optInt("width", 0);
                    int h = boundingBox.optInt("height", 0);
                    
                    // Subtract status bar height to correct overlay position
                    int adjustedY = y - statusBarHeight;
                    
                    if (w > 0 && h > 0 && adjustedY + h > 0) {
                        textBlocks.add(new TextBlock(text, new Rect(x, adjustedY, x + w, adjustedY + h)));
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        invalidate();
    }

    /**
     * Find the optimal text size that fits the text within the given width and height
     * using binary search for efficiency.
     */
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

        for (TextBlock block : textBlocks) {
            // Draw Background
            canvas.drawRect(block.rect, paintBackground);

            if (block.text == null || block.text.isEmpty()) continue;

            int boxWidth = block.rect.width();
            int boxHeight = block.rect.height();
            
            if (boxWidth <= 0 || boxHeight <= 0) continue;

            // Add padding
            int padding = 4;
            int availableWidth = boxWidth - (padding * 2);
            int availableHeight = boxHeight - (padding * 2);
            
            if (availableWidth <= 0 || availableHeight <= 0) continue;

            // Find optimal text size (min 12, max 100)
            float optimalSize = findOptimalTextSize(block.text, availableWidth, availableHeight, 12f, 100f);
            textPaint.setTextSize(optimalSize);

            // Create StaticLayout for multi-line text rendering
            StaticLayout staticLayout = StaticLayout.Builder
                .obtain(block.text, 0, block.text.length(), textPaint, availableWidth)
                .setAlignment(Layout.Alignment.ALIGN_NORMAL) // Left-aligned
                .setLineSpacing(0f, 1f)
                .setIncludePad(false)
                .build();

            // Draw the text
            canvas.save();
            canvas.translate(block.rect.left + padding, block.rect.top + padding);
            staticLayout.draw(canvas);
            canvas.restore();
        }
    }
}
