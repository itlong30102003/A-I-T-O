package com.aito.textdetection

import android.graphics.Bitmap
import android.graphics.BitmapFactory
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

                    val linesArray = Arguments.createArray()
                    for (line in block.lines) {
                        val lineMap = Arguments.createMap()
                        lineMap.putString("text", line.text)
                        
                        val lineBoundingBox = line.boundingBox
                        if (lineBoundingBox != null) {
                            lineMap.putMap("boundingBox", createRectMap(lineBoundingBox))
                        }
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
}
