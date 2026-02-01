package com.aito.frameprocessor;

import android.graphics.Rect;
import android.media.Image;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.android.gms.tasks.Tasks;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import com.mrousavy.camera.frameprocessors.Frame;
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin;
import com.mrousavy.camera.frameprocessors.VisionCameraProxy;
import com.mrousavy.camera.core.types.Orientation;
import com.mrousavy.camera.core.FrameInvalidError;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class TextRecognitionFrameProcessorPlugin extends FrameProcessorPlugin {
    private static final String TAG = "TextRecognitionPlugin";
    private final TextRecognizer recognizer;
    
    // Throttle OCR calls - only process every 200ms (5fps)
    private long lastProcessTime = 0;
    private static final long PROCESS_INTERVAL_MS = 200;
    
    // Cache last result to return when throttled
    private Map<String, Object> lastResult = new HashMap<>();

    public TextRecognitionFrameProcessorPlugin(@NonNull VisionCameraProxy proxy, @Nullable Map<String, Object> options) {
        super();
        // Initialize ML Kit Text Recognizer
        recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        
        // Initialize empty result
        lastResult.put("blocks", new ArrayList<>());
        lastResult.put("frameWidth", 0);
        lastResult.put("frameHeight", 0);
    }

    @Nullable
    @Override
    public Object callback(@NonNull Frame frame, @Nullable Map<String, Object> arguments) {
        long currentTime = System.currentTimeMillis();
        
        // Throttle: return cached result if called too frequently
        if (currentTime - lastProcessTime < PROCESS_INTERVAL_MS) {
            return lastResult;
        }
        lastProcessTime = currentTime;
        
        try {
            // Check if frame is valid first
            if (!frame.getIsValid()) {
                return lastResult;
            }
            
            Image mediaImage = frame.getImage();
            if (mediaImage == null) {
                return lastResult;
            }
            
            // Get rotation from Orientation enum
            Orientation orientation = frame.getOrientation();
            int rotation = getRotationDegrees(orientation);
            InputImage inputImage = InputImage.fromMediaImage(mediaImage, rotation);
            
            // Process synchronously (we're already on a background thread)
            Text result = Tasks.await(recognizer.process(inputImage));
            
            // Build result map
            Map<String, Object> resultMap = new HashMap<>();
            List<Map<String, Object>> blocks = new ArrayList<>();
            
            for (Text.TextBlock block : result.getTextBlocks()) {
                Map<String, Object> blockMap = new HashMap<>();
                blockMap.put("text", block.getText());
                
                Rect boundingBox = block.getBoundingBox();
                if (boundingBox != null) {
                    Map<String, Object> bbox = new HashMap<>();
                    bbox.put("left", boundingBox.left);
                    bbox.put("top", boundingBox.top);
                    bbox.put("right", boundingBox.right);
                    bbox.put("bottom", boundingBox.bottom);
                    bbox.put("width", boundingBox.width());
                    bbox.put("height", boundingBox.height());
                    blockMap.put("boundingBox", bbox);
                }
                
                // Add corners if available
                android.graphics.Point[] corners = block.getCornerPoints();
                if (corners != null && corners.length == 4) {
                    List<Map<String, Integer>> cornersList = new ArrayList<>();
                    for (android.graphics.Point corner : corners) {
                        Map<String, Integer> point = new HashMap<>();
                        point.put("x", corner.x);
                        point.put("y", corner.y);
                        cornersList.add(point);
                    }
                    blockMap.put("corners", cornersList);
                }
                
                blocks.add(blockMap);
            }
            
            resultMap.put("blocks", blocks);
            resultMap.put("frameWidth", mediaImage.getWidth());
            resultMap.put("frameHeight", mediaImage.getHeight());
            
            // Cache result
            lastResult = resultMap;
            
            return resultMap;
            
        } catch (FrameInvalidError e) {
            // Frame was closed/invalid, return cached result
            return lastResult;
        } catch (Exception e) {
            android.util.Log.e(TAG, "Error processing frame: " + e.getMessage(), e);
            return lastResult;
        }
    }
    
    private int getRotationDegrees(Orientation orientation) {
        // Map Vision Camera Orientation to ML Kit rotation degrees
        if (orientation == Orientation.PORTRAIT) {
            return 0;
        } else if (orientation == Orientation.LANDSCAPE_RIGHT) {
            return 90;
        } else if (orientation == Orientation.PORTRAIT_UPSIDE_DOWN) {
            return 180;
        } else if (orientation == Orientation.LANDSCAPE_LEFT) {
            return 270;
        } else {
            return 0;
        }
    }
}
