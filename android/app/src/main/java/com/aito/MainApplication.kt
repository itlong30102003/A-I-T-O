package com.aito

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.aito.screencapture.ScreenCapturePackage
import com.aito.textdetection.TextDetectionPackage
import com.aito.device.DevicePackage
import com.aito.overlay.OverlayPackage
import com.aito.overlay.SelectionModePackage
import com.aito.overlay.ResourceMonitorPackage
import com.aito.frameprocessor.TextRecognitionPluginPackage
import com.aito.textrecognition.TextRecognitionPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here
          add(ScreenCapturePackage())
          add(TextDetectionPackage())
          add(DevicePackage())
          add(OverlayPackage())
          add(SelectionModePackage())
          add(TextRecognitionPackage())
          add(ResourceMonitorPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // Register Vision Camera Frame Processor Plugins
    TextRecognitionPluginPackage.register()
    loadReactNative(this)
  }
}
