package com.aito.overlay;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;
import android.view.View;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

public class OverlayView extends View {
    private final Paint paintBackground;
    private final Paint paintText;
    private List<TextBlock> textBlocks = new ArrayList<>();

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

        paintText = new Paint();
        paintText.setColor(Color.WHITE);
        paintText.setTextSize(40f); // Default size, will auto-scale ideally or fixed for now
        paintText.setAntiAlias(true);
    }

    public void updateBlocks(String jsonString) {
        textBlocks.clear();
        try {
            JSONArray jsonArray = new JSONArray(jsonString);
            for (int i = 0; i < jsonArray.length(); i++) {
                JSONObject obj = jsonArray.getJSONObject(i);
                String text = obj.optString("text", "");
                
                // ML Kit frame-coordinates might need scaling if screen resolution differs from image resolution.
                // However, usually they match if capture is full screen.
                // The frame object in JS has width/height. We might need to handle scaling.
                // For MVP, assuming 1:1 mapping (Screen Capture Resolution == Display Resolution).
                
                JSONObject boundingBox = obj.optJSONObject("boundingBox");
                // TextDetectionModule uses "boundingBox" key with x, y, width, height
                
                if (boundingBox != null) {
                    int x = boundingBox.optInt("x", 0);
                    int y = boundingBox.optInt("y", 0);
                    int w = boundingBox.optInt("width", 0);
                    int h = boundingBox.optInt("height", 0);
                    
                    // Basic sanity check
                    if (w > 0 && h > 0) {
                        textBlocks.add(new TextBlock(text, new Rect(x, y, x + w, y + h)));
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        invalidate(); // Request redraw
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);

        for (TextBlock block : textBlocks) {
            // Draw Background
            canvas.drawRect(block.rect, paintBackground);

            // Draw Text
            // Simple text fitting logic
            float textSize = block.rect.height() * 0.8f; 
            if (textSize < 20f) textSize = 20f; // Min size
            if (textSize > 100f) textSize = 100f; // Max size
            
            paintText.setTextSize(textSize);
            
            // Measure text to center or fit? Just left align for now.
            // Center vertically
            Paint.FontMetrics metrics = paintText.getFontMetrics();
            float y = block.rect.centerY() - (metrics.top + metrics.bottom) / 2f;
            
            canvas.drawText(block.text, block.rect.left + 5, y, paintText);
        }
    }
}
