package com.aito.textdetection

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Rect
import com.facebook.react.bridge.*
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions
import com.google.mlkit.vision.text.japanese.JapaneseTextRecognizerOptions
import com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.io.File

class TextDetectionModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private var latinRecognizer: TextRecognizer? = null
    private var chineseRecognizer: TextRecognizer? = null
    private var japaneseRecognizer: TextRecognizer? = null
    private var koreanRecognizer: TextRecognizer? = null

    override fun getName(): String {
        return "TextDetectionModule"
    }

    private fun getRecognizer(script: String): TextRecognizer {
        return when (script.lowercase()) {
            "chinese" -> {
                if (chineseRecognizer == null) {
                    chineseRecognizer = TextRecognition.getClient(ChineseTextRecognizerOptions.Builder().build())
                }
                chineseRecognizer!!
            }
            "japanese" -> {
                if (japaneseRecognizer == null) {
                    japaneseRecognizer = TextRecognition.getClient(JapaneseTextRecognizerOptions.Builder().build())
                }
                japaneseRecognizer!!
            }
            "korean" -> {
                if (koreanRecognizer == null) {
                    koreanRecognizer = TextRecognition.getClient(KoreanTextRecognizerOptions.Builder().build())
                }
                koreanRecognizer!!
            }
            else -> {
                if (latinRecognizer == null) {
                    latinRecognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
                }
                latinRecognizer!!
            }
        }
    }

    @ReactMethod
    fun detectText(imagePath: String, script: String, promise: Promise) {
        try {
            val file = File(imagePath)
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "Image file not found at $imagePath")
                return
            }

            val bitmap = BitmapFactory.decodeFile(imagePath)
            if (bitmap == null) {
                promise.reject("DECODE_FAILED", "Failed to decode image at $imagePath")
                return
            }

            processImage(bitmap, script, promise)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    private fun processImage(bitmap: Bitmap, script: String, promise: Promise) {
        val image = InputImage.fromBitmap(bitmap, 0)
        val recognizer = getRecognizer(script)

        recognizer.process(image)
            .addOnSuccessListener { visionText ->
                val result = Arguments.createMap()
                val blocksArray = Arguments.createArray()

                for (block in visionText.textBlocks) {
                    val blockMap = Arguments.createMap()
                    blockMap.putString("text", block.text)
                    
                    val boundingBox = block.boundingBox
                    if (boundingBox != null) {
                        blockMap.putMap("boundingBox", createRectMap(boundingBox))
                    }

                    // Estimate fontSize: median element height × 0.98
                    val elementHeights = mutableListOf<Int>()
                    for (line in block.lines) {
                        for (element in line.elements) {
                            element.boundingBox?.let { elementHeights.add(it.height()) }
                        }
                    }
                    elementHeights.sort()
                    val medianHeight = if (elementHeights.isNotEmpty())
                        elementHeights[elementHeights.size / 2] else 14
                    blockMap.putInt("fontSize", medianHeight)

                    // Extract dominant background color from bitmap edges
                    val bgColor = boundingBox?.let { extractDominantColor(bitmap, it) }
                    blockMap.putString("bgColor", String.format("#%06X", 0xFFFFFF and (bgColor ?: 0)))

                    val linesArray = Arguments.createArray()
                    for (line in block.lines) {
                        val lineMap = Arguments.createMap()
                        lineMap.putString("text", line.text)
                        
                        val lineBoundingBox = line.boundingBox
                        if (lineBoundingBox != null) {
                            lineMap.putMap("boundingBox", createRectMap(lineBoundingBox))
                        }
                        
                        // Extract Elements (words) - enables word-level hit testing
                        val elementsArray = Arguments.createArray()
                        for (element in line.elements) {
                            val elementMap = Arguments.createMap()
                            elementMap.putString("text", element.text)
                            val elementBoundingBox = element.boundingBox
                            if (elementBoundingBox != null) {
                                elementMap.putMap("boundingBox", createRectMap(elementBoundingBox))
                            }
                            elementsArray.pushMap(elementMap)
                        }
                        lineMap.putArray("elements", elementsArray)
                        
                        linesArray.pushMap(lineMap)
                    }
                    blockMap.putArray("lines", linesArray)
                    blocksArray.pushMap(blockMap)
                }

                result.putArray("blocks", blocksArray)
                promise.resolve(result)
            }
            .addOnFailureListener { e ->
                promise.reject("DETECTION_FAILED", e.message)
            }
    }

    private fun createRectMap(rect: Rect): WritableMap {
        val map = Arguments.createMap()
        map.putInt("x", rect.left)
        map.putInt("y", rect.top)
        map.putInt("width", rect.width())
        map.putInt("height", rect.height())
        return map
    }

    /**
     * Extract dominant background color by sampling pixels along the edges of the bounding box.
     * Edges are sampled to avoid picking up text pixel colors.
     */
    private fun extractDominantColor(bitmap: Bitmap, rect: Rect): Int {
        val safeRect = Rect(
            rect.left.coerceIn(0, bitmap.width - 1),
            rect.top.coerceIn(0, bitmap.height - 1),
            rect.right.coerceIn(1, bitmap.width),
            rect.bottom.coerceIn(1, bitmap.height)
        )
        val colorCounts = mutableMapOf<Int, Int>()
        // Sample top and bottom rows
        for (x in safeRect.left until safeRect.right step 3) {
            addColor(colorCounts, bitmap.getPixel(x, safeRect.top))
            addColor(colorCounts, bitmap.getPixel(x, (safeRect.bottom - 1).coerceAtLeast(safeRect.top)))
        }
        // Sample left and right columns
        for (y in safeRect.top until safeRect.bottom step 3) {
            addColor(colorCounts, bitmap.getPixel(safeRect.left, y))
            addColor(colorCounts, bitmap.getPixel((safeRect.right - 1).coerceAtLeast(safeRect.left), y))
        }
        return colorCounts.maxByOrNull { it.value }?.key ?: Color.BLACK
    }

    /**
     * Quantize color (drop lower 4 bits per channel) and add to frequency map.
     */
    private fun addColor(map: MutableMap<Int, Int>, color: Int) {
        val q = Color.argb(
            255,
            Color.red(color) and 0xF0,
            Color.green(color) and 0xF0,
            Color.blue(color) and 0xF0
        )
        map[q] = (map[q] ?: 0) + 1
    }
}
