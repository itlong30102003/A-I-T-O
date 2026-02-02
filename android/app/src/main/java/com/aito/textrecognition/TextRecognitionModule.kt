package com.aito.textrecognition

import android.graphics.Rect
import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.io.File

/**
 * Native Module for text recognition from image files
 * 
 * This module processes images captured by Vision Camera and returns OCR results.
 * It uses ML Kit Text Recognition V2 with Latin script support.
 */
class TextRecognitionModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val recognizer: TextRecognizer = 
        TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

    override fun getName(): String {
        return "TextRecognitionModule"
    }

    /**
     * Process an image file and return detected text with bounding boxes
     * 
     * @param imagePath - Absolute path to image file (from takePhoto)
     * @param promise - Promise that resolves with OCR result
     * 
     * Returns: {
     *   blocks: Array<{
     *     text: string,
     *     boundingBox: { left, top, right, bottom, width, height },
     *     corners?: Array<{ x, y }>
     *   }>,
     *   frameWidth: number,
     *   frameHeight: number
     * }
     */
    @ReactMethod
    fun processImage(imagePath: String, promise: Promise) {
        try {
            // Validate file exists
            val imageFile = File(imagePath)
            if (!imageFile.exists()) {
                promise.reject("FILE_NOT_FOUND", "Image file not found: $imagePath")
                return
            }

            // Create InputImage from file
            val inputImage = InputImage.fromFilePath(reactApplicationContext, Uri.fromFile(imageFile))
            
            // Process image synchronously (we're on background thread via React Native)
            val result = Tasks.await(recognizer.process(inputImage))
            
            // Build result map
            val resultMap = Arguments.createMap()
            val blocks = Arguments.createArray()
            
            for (block in result.textBlocks) {
                val blockMap = Arguments.createMap()
                blockMap.putString("text", block.text)
                
                // Add bounding box
                block.boundingBox?.let { bbox ->
                    val bboxMap = Arguments.createMap()
                    bboxMap.putInt("left", bbox.left)
                    bboxMap.putInt("top", bbox.top)
                    bboxMap.putInt("right", bbox.right)
                    bboxMap.putInt("bottom", bbox.bottom)
                    bboxMap.putInt("width", bbox.width())
                    bboxMap.putInt("height", bbox.height())
                    blockMap.putMap("boundingBox", bboxMap)
                }
                
                // Add corners if available
                block.cornerPoints?.let { corners ->
                    if (corners.size == 4) {
                        val cornersList = Arguments.createArray()
                        for (corner in corners) {
                            val cornerMap = Arguments.createMap()
                            cornerMap.putInt("x", corner.x)
                            cornerMap.putInt("y", corner.y)
                            cornersList.pushMap(cornerMap)
                        }
                        blockMap.putArray("corners", cornersList)
                    }
                }
                
                blocks.pushMap(blockMap)
            }
            
            resultMap.putArray("blocks", blocks)
            resultMap.putInt("frameWidth", inputImage.width)
            resultMap.putInt("frameHeight", inputImage.height)
            
            promise.resolve(resultMap)
            
        } catch (e: Exception) {
            promise.reject("OCR_ERROR", "Failed to process image: ${e.message}", e)
        }
    }

    /**
     * Cleanup resources when module is destroyed
     */
    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        recognizer.close()
    }
}
