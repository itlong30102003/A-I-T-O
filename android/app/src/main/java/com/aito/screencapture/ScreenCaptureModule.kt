package com.aito.screencapture

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Rect
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.provider.Settings
import android.util.Log
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class ScreenCaptureModule(reactContext: ReactApplicationContext) : 
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {
    
    companion object {
        private const val TAG = "ScreenCaptureModule"
        private const val REQUEST_MEDIA_PROJECTION = 1000
        private const val REQUEST_MEDIA_PROJECTION_APP_SELECT = 1001
        const val NAME = "ScreenCaptureModule"
    }
    
    private var pendingPromise: Promise? = null
    private val projectionManager: MediaProjectionManager
    
    init {
        reactContext.addActivityEventListener(this)
        projectionManager = reactContext.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    }
    
    override fun getName(): String = NAME
    
    /**
     * Request permission for screen capture with app selection on Android 14+
     */
    @ReactMethod
    @android.annotation.SuppressLint("NewApi")
    fun requestPermission(promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("ERROR", "Activity is null")
            return
        }
        
        pendingPromise = promise
        
        // On Android 14+, allow user to select specific app
        val captureIntent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            val config = android.media.projection.MediaProjectionConfig.createConfigForUserChoice()
            projectionManager.createScreenCaptureIntent(config)
        } else {
            projectionManager.createScreenCaptureIntent()
        }
        
        activity.startActivityForResult(captureIntent, REQUEST_MEDIA_PROJECTION)
        
        Log.d(TAG, "Requested MediaProjection permission (app selection on Android 14+)")
    }
    
    /**
     * Get Android version info
     */
    @ReactMethod
    fun getAndroidVersion(promise: Promise) {
        promise.resolve(Arguments.createMap().apply {
            putInt("sdkVersion", Build.VERSION.SDK_INT)
            putBoolean("supportsAppSelection", Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
        })
    }
    
    @ReactMethod
    fun startCapture(options: ReadableMap?, promise: Promise) {
        try {
            val context = reactApplicationContext
            
            if (ScreenCaptureService.resultData == null) {
                promise.reject("ERROR", "MediaProjection permission not granted. Call requestPermission first.")
                return
            }
            
            // Set capture interval if provided
            if (options?.hasKey("intervalMs") == true) {
                ScreenCaptureService.captureIntervalMs = options.getInt("intervalMs").toLong()
            }
            
            // Set crop region if provided (for targeting specific area)
            if (options?.hasKey("cropRegion") == true) {
                val cropRegion = options.getMap("cropRegion")
                if (cropRegion != null) {
                    val x = cropRegion.getInt("x")
                    val y = cropRegion.getInt("y")
                    val width = cropRegion.getInt("width")
                    val height = cropRegion.getInt("height")
                    ScreenCaptureService.cropRegion = Rect(x, y, x + width, y + height)
                    Log.d(TAG, "Crop region set: x=$x, y=$y, w=$width, h=$height")
                }
            } else {
                ScreenCaptureService.cropRegion = null
            }
            
            // Set frame callback
            ScreenCaptureService.onFrameCaptured = { imagePath ->
                sendEvent("onFrameCaptured", Arguments.createMap().apply {
                    putString("imagePath", imagePath)
                    putDouble("timestamp", System.currentTimeMillis().toDouble())
                })
            }
            
            // Start the service
            val serviceIntent = Intent(context, ScreenCaptureService::class.java)
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
            
            Log.d(TAG, "Screen capture started")
            promise.resolve(true)
            
        } catch (e: Exception) {
            Log.e(TAG, "Error starting capture: ${e.message}")
            promise.reject("ERROR", e.message)
        }
    }
    
    /**
     * Set crop region for capturing only part of the screen
     */
    @ReactMethod
    fun setCropRegion(x: Int, y: Int, width: Int, height: Int, promise: Promise) {
        try {
            ScreenCaptureService.cropRegion = Rect(x, y, x + width, y + height)
            Log.d(TAG, "Crop region updated: x=$x, y=$y, w=$width, h=$height")
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }
    
    /**
     * Clear crop region (capture full screen)
     */
    @ReactMethod
    fun clearCropRegion(promise: Promise) {
        ScreenCaptureService.cropRegion = null
        Log.d(TAG, "Crop region cleared")
        promise.resolve(true)
    }
    
    @ReactMethod
    fun stopCapture(promise: Promise) {
        try {
            val context = reactApplicationContext
            
            val serviceIntent = Intent(context, ScreenCaptureService::class.java)
            context.stopService(serviceIntent)
            
            ScreenCaptureService.onFrameCaptured = null
            ScreenCaptureService.resultData = null
            ScreenCaptureService.resultCode = Activity.RESULT_CANCELED
            ScreenCaptureService.cropRegion = null
            
            Log.d(TAG, "Screen capture stopped")
            promise.resolve(true)
            
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping capture: ${e.message}")
            promise.reject("ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun isCapturing(promise: Promise) {
        promise.resolve(ScreenCaptureService.mediaProjection != null)
    }
    
    @ReactMethod
    fun checkOverlayPermission(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            promise.resolve(Settings.canDrawOverlays(reactApplicationContext))
        } else {
            promise.resolve(true)
        }
    }
    
    @ReactMethod
    fun requestOverlayPermission() {
        val activity = reactApplicationContext.currentActivity ?: return
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                android.net.Uri.parse("package:${reactApplicationContext.packageName}")
            )
            activity.startActivity(intent)
        }
    }
    
    private fun sendEvent(eventName: String, params: com.facebook.react.bridge.WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }
    
    // ActivityEventListener methods
    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == REQUEST_MEDIA_PROJECTION) {
            if (resultCode == Activity.RESULT_OK && data != null) {
                // Store the result for the service to use
                ScreenCaptureService.resultCode = resultCode
                ScreenCaptureService.resultData = data
                
                Log.d(TAG, "MediaProjection permission granted")
                pendingPromise?.resolve(true)
            } else {
                Log.d(TAG, "MediaProjection permission denied")
                pendingPromise?.reject("PERMISSION_DENIED", "User denied screen capture permission")
            }
            pendingPromise = null
        }
    }
    
    override fun onNewIntent(intent: Intent) {
        // Not used
    }
    
    // Required for event emitter
    @ReactMethod
    fun addListener(eventName: String) {
        // Keep: Required for RN built-in Event Emitter
    }
    
    @ReactMethod
    fun removeListeners(count: Int) {
        // Keep: Required for RN built-in Event Emitter
    }
}

