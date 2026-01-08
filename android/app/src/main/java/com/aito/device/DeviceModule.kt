package com.aito.device

import android.app.ActivityManager
import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class DeviceModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "DeviceModule"
    }

    @ReactMethod
    fun getTotalRam(promise: Promise) {
        try {
            val actManager = reactApplicationContext.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val memInfo = ActivityManager.MemoryInfo()
            actManager.getMemoryInfo(memInfo)
            val totalMemory = memInfo.totalMem.toDouble() / (1024 * 1024 * 1024) // Convert to GB
            promise.resolve(totalMemory)
        } catch (e: Exception) {
            promise.reject("RAM_ERROR", e.message)
        }
    }
}
