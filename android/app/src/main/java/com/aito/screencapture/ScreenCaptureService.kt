package com.aito.screencapture

import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.graphics.Rect
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.Image
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.content.pm.ServiceInfo
import android.util.DisplayMetrics
import android.util.Log
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer

class ScreenCaptureService : Service() {
    
    companion object {
        private const val TAG = "ScreenCaptureService"
        private const val CHANNEL_ID = "screen_capture_channel"
        private const val CHANNEL_NAME = "Screen Capture"
        private const val NOTIFICATION_ID = 1001
        
        // Static references for MediaProjection
        var mediaProjection: MediaProjection? = null
        var resultCode: Int = Activity.RESULT_CANCELED
        var resultData: Intent? = null
        
        // Callback for captured frames
        var onFrameCaptured: ((String) -> Unit)? = null
        
        // Capture settings
        var captureIntervalMs: Long = 500L
        
        // Crop region for targeting specific area (null = full screen)
        var cropRegion: Rect? = null
    }
    
    private var virtualDisplay: VirtualDisplay? = null
    private var imageReader: ImageReader? = null
    private var handler: Handler? = null
    private var isCapturing = false
    
    private var screenWidth: Int = 0
    private var screenHeight: Int = 0
    private var screenDensity: Int = 0
    
    // For frame change detection - only update when content changes
    private var previousFrameHash: Int = 0
    private var currentFramePath: String? = null
    
    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "ScreenCaptureService onCreate")
        createNotificationChannel()
        
        // Get screen dimensions
        val windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val metrics = DisplayMetrics()
        windowManager.defaultDisplay.getMetrics(metrics)
        screenWidth = metrics.widthPixels
        screenHeight = metrics.heightPixels
        screenDensity = metrics.densityDpi
        
        handler = Handler(Looper.getMainLooper())
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "ScreenCaptureService onStartCommand")
        
        // Start as foreground service with mediaProjection type for Android 10+ (API 29+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, createNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
        } else {
            startForeground(NOTIFICATION_ID, createNotification())
        }
        
        // Initialize MediaProjection
        val projectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        
        if (resultData != null) {
            Log.d(TAG, "ResultData is valid, creating MediaProjection. ResultCode: $resultCode")
            mediaProjection = projectionManager.getMediaProjection(resultCode, resultData!!)
            Log.d(TAG, "MediaProjection created: $mediaProjection")
            
            mediaProjection?.registerCallback(object : MediaProjection.Callback() {
                override fun onStop() {
                    Log.d(TAG, "MediaProjection stopped by system")
                    stopCapture()
                }
            }, handler)
            
            startCapture()
        } else {
            Log.e(TAG, "resultData is null, cannot start capture. Make sure requestPermission was successful.")
            stopSelf()
        }
        
        return START_STICKY
    }
    
    override fun onBind(intent: Intent?): IBinder? = null
    
    override fun onDestroy() {
        Log.d(TAG, "ScreenCaptureService onDestroy")
        stopCapture()
        super.onDestroy()
    }
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Screen capture is running"
                setShowBadge(false)
            }
            
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager?.createNotificationChannel(channel)
        }
    }
    
    private fun createNotification(): Notification {
        val stopIntent = Intent(this, ScreenCaptureService::class.java).apply {
            action = "STOP_CAPTURE"
        }
        val stopPendingIntent = PendingIntent.getService(
            this, 0, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Screen Capture Active")
            .setContentText("Capturing screen for OCR translation")
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .addAction(android.R.drawable.ic_media_pause, "Stop", stopPendingIntent)
            .build()
    }
    
    private fun startCapture() {
        if (isCapturing) {
            Log.d(TAG, "Already capturing, skipping startCapture")
            return
        }
        
        Log.d(TAG, "Starting capture loop: ${screenWidth}x${screenHeight} (density: $screenDensity)")
        
        // Create ImageReader
        imageReader = ImageReader.newInstance(
            screenWidth, screenHeight,
            PixelFormat.RGBA_8888, 2
        )
        
        Log.d(TAG, "ImageReader surface: ${imageReader?.surface}")
        
        // Create VirtualDisplay
        virtualDisplay = mediaProjection?.createVirtualDisplay(
            "ScreenCapture",
            screenWidth, screenHeight, screenDensity,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            imageReader?.surface,
            null, handler
        )
        
        if (virtualDisplay == null) {
            Log.e(TAG, "Failed to create VirtualDisplay!")
            stopSelf()
            return
        }
        
        Log.d(TAG, "VirtualDisplay created: $virtualDisplay")
        isCapturing = true
        
        // Start capture loop
        handler?.post(captureRunnable)
    }
    
    private val captureRunnable = object : Runnable {
        override fun run() {
            if (!isCapturing) return
            
            captureFrame()
            
            // Schedule next capture
            handler?.postDelayed(this, captureIntervalMs)
        }
    }
    
    private fun captureFrame() {
        val image: Image? = try {
            // acquireLatestImage can return null frequently on emulators if no change detected
            // acquireNextImage is more reliable for catching the first frame
            imageReader?.acquireNextImage()
        } catch (e: Exception) {
            // Buffer might be empty, that's fine
            null
        }

        if (image != null) {
            image.use { img ->
                try {
                    var bitmap = imageToBitmap(img)
                    if (bitmap != null) {
                        // Apply crop region if set
                        val region = cropRegion
                        if (region != null) {
                            bitmap = cropBitmap(bitmap, region)
                        }
                        
                        // Calculate hash to detect changes (sample pixels for speed)
                        val currentHash = calculateBitmapHash(bitmap)
                        
                        // Only update if content changed
                        if (currentHash != previousFrameHash) {
                            previousFrameHash = currentHash
                            
                            // Use single file for smooth preview (reuse same path)
                            val tempFile = File(cacheDir, "live_capture.jpg")
                            FileOutputStream(tempFile).use { out ->
                                // Use JPEG for faster encoding/smaller size
                                bitmap.compress(Bitmap.CompressFormat.JPEG, 80, out)
                            }
                            
                            currentFramePath = tempFile.absolutePath
                            
                            // Callback with file path + timestamp to force refresh
                            onFrameCaptured?.invoke(tempFile.absolutePath)
                            
                            Log.d(TAG, "Frame #${statsFrameCount++} sent to JS. Path: ${tempFile.absoluteFile}")
                        }
                        
                        // Clean up bitmap
                        bitmap.recycle()
                    } else {
                        Log.e(TAG, "Failed to convert image to bitmap")
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error processing image: ${e.message}")
                }
            }
        } else {
            // Log once every 10 attempts if image is null to avoid spam
            if (statsNullCount++ % 10 == 0) {
                Log.w(TAG, "No image acquired from ImageReader (Total nulls: $statsNullCount)")
            }
        }
    }

    private var statsFrameCount = 0
    private var statsNullCount = 0
    
    /**
     * Calculate a fast hash of bitmap by sampling pixels
     */
    private fun calculateBitmapHash(bitmap: Bitmap): Int {
        var hash = 0
        val stepX = maxOf(1, bitmap.width / 10)
        val stepY = maxOf(1, bitmap.height / 10)
        
        for (x in 0 until bitmap.width step stepX) {
            for (y in 0 until bitmap.height step stepY) {
                hash = 31 * hash + bitmap.getPixel(x, y)
            }
        }
        return hash
    }
    
    private fun imageToBitmap(image: Image): Bitmap? {
        val planes = image.planes
        val buffer: ByteBuffer = planes[0].buffer
        val pixelStride = planes[0].pixelStride
        val rowStride = planes[0].rowStride
        val rowPadding = rowStride - pixelStride * screenWidth
        
        val bitmap = Bitmap.createBitmap(
            screenWidth + rowPadding / pixelStride,
            screenHeight,
            Bitmap.Config.ARGB_8888
        )
        bitmap.copyPixelsFromBuffer(buffer)
        
        // Crop to actual screen size if needed
        return if (rowPadding > 0) {
            Bitmap.createBitmap(bitmap, 0, 0, screenWidth, screenHeight)
        } else {
            bitmap
        }
    }
    
    /**
     * Crop bitmap to specified region
     */
    private fun cropBitmap(source: Bitmap, region: Rect): Bitmap {
        // Ensure region is within bitmap bounds
        val x = region.left.coerceIn(0, source.width - 1)
        val y = region.top.coerceIn(0, source.height - 1)
        val width = region.width().coerceIn(1, source.width - x)
        val height = region.height().coerceIn(1, source.height - y)
        
        return try {
            val cropped = Bitmap.createBitmap(source, x, y, width, height)
            if (cropped != source) {
                source.recycle()
            }
            cropped
        } catch (e: Exception) {
            Log.e(TAG, "Error cropping bitmap: ${e.message}")
            source
        }
    }
    
    private fun stopCapture() {
        Log.d(TAG, "Stopping capture")
        isCapturing = false
        handler?.removeCallbacks(captureRunnable)
        previousFrameHash = 0 // Reset hash to force first frame on next start
        statsFrameCount = 0
        statsNullCount = 0
        
        virtualDisplay?.release()
        virtualDisplay = null
        
        imageReader?.close()
        imageReader = null
        
        mediaProjection?.stop()
        mediaProjection = null
    }
}
