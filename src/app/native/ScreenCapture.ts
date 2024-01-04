/**
 * ScreenCaptureModule - TypeScript bindings for native screen capture
 * Supports Android 14+ app selection and crop region targeting
 */
import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { ScreenCaptureModule } = NativeModules;

// Event emitter for frame callbacks
const screenCaptureEmitter = new NativeEventEmitter(ScreenCaptureModule);

export interface CropRegion {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface CaptureOptions {
    intervalMs?: number; // Capture interval in milliseconds (default: 500)
    cropRegion?: CropRegion; // Optional region to crop (for targeting specific area)
}

export interface FrameCaptureEvent {
    imagePath: string;
    timestamp: number;
}

export interface AndroidVersionInfo {
    sdkVersion: number;
    supportsAppSelection: boolean; // true if Android 14+
}

/**
 * Request MediaProjection permission with app selection (Android 14+)
 * On Android 14+, user can choose to share only a specific app.
 * On older versions, falls back to full screen capture.
 * @returns Promise<boolean> - true if permission granted
 */
export const requestPermission = (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
        return Promise.reject('Screen capture is only available on Android');
    }
    return ScreenCaptureModule.requestPermission();
};

/**
 * Get Android version info
 * @returns Promise<AndroidVersionInfo>
 */
export const getAndroidVersion = (): Promise<AndroidVersionInfo> => {
    if (Platform.OS !== 'android') {
        return Promise.resolve({ sdkVersion: 0, supportsAppSelection: false });
    }
    return ScreenCaptureModule.getAndroidVersion();
};

/**
 * Start screen capture
 * @param options - Capture options including interval and optional crop region
 * @returns Promise<boolean> - true if capture started
 */
export const startScreenCapture = (options?: CaptureOptions): Promise<boolean> => {
    if (Platform.OS !== 'android') {
        return Promise.reject('Screen capture is only available on Android');
    }
    return ScreenCaptureModule.startCapture(options || {});
};

/**
 * Set crop region for capturing only part of the screen
 * Use this to "target" a specific window/area
 * @param region - The region to crop
 * @returns Promise<boolean>
 */
export const setCropRegion = (region: CropRegion): Promise<boolean> => {
    if (Platform.OS !== 'android') {
        return Promise.reject('Screen capture is only available on Android');
    }
    return ScreenCaptureModule.setCropRegion(region.x, region.y, region.width, region.height);
};

/**
 * Clear crop region (capture full screen)
 * @returns Promise<boolean>
 */
export const clearCropRegion = (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
        return Promise.reject('Screen capture is only available on Android');
    }
    return ScreenCaptureModule.clearCropRegion();
};

/**
 * Stop screen capture
 * @returns Promise<boolean> - true if capture stopped
 */
export const stopScreenCapture = (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
        return Promise.reject('Screen capture is only available on Android');
    }
    return ScreenCaptureModule.stopCapture();
};

/**
 * Check if currently capturing
 * @returns Promise<boolean>
 */
export const isCapturing = (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
        return Promise.resolve(false);
    }
    return ScreenCaptureModule.isCapturing();
};

/**
 * Check if overlay permission is granted
 * @returns Promise<boolean>
 */
export const checkOverlayPermission = (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
        return Promise.resolve(false);
    }
    return ScreenCaptureModule.checkOverlayPermission();
};

/**
 * Request overlay (SYSTEM_ALERT_WINDOW) permission
 * Opens system settings for the user to grant permission
 */
export const requestOverlayPermission = (): void => {
    if (Platform.OS !== 'android') {
        return;
    }
    ScreenCaptureModule.requestOverlayPermission();
};

/**
 * Subscribe to frame capture events
 * @param callback - Called when a frame is captured
 * @returns Subscription object, call .remove() to unsubscribe
 */
export const onFrameCaptured = (callback: (event: FrameCaptureEvent) => void) => {
    return screenCaptureEmitter.addListener('onFrameCaptured', callback);
};

// Default export with all methods
export default {
    // Permission
    requestPermission,

    // Capture control
    startCapture: startScreenCapture,
    stopCapture: stopScreenCapture,
    isCapturing,

    // Target window / crop region
    setCropRegion,
    clearCropRegion,

    // Overlay
    checkOverlayPermission,
    requestOverlayPermission,

    // Events
    onFrameCaptured,

    // Utils
    getAndroidVersion,
};
