package com.aito.frameprocessor;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin;
import com.mrousavy.camera.frameprocessors.FrameProcessorPluginRegistry;
import com.mrousavy.camera.frameprocessors.VisionCameraProxy;

import java.util.Map;

public class TextRecognitionPluginPackage {
    
    public static void register() {
        FrameProcessorPluginRegistry.addFrameProcessorPlugin(
            "textRecognition",
            (proxy, options) -> new TextRecognitionFrameProcessorPlugin(proxy, options)
        );
    }
}
