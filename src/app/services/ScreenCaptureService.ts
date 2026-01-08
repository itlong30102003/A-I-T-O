/**
 * ScreenCaptureService - Service quản lý screen capture
 * Gộp native bindings + business logic vào 1 file để đơn giản
 */
import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { ScreenCaptureModule } = NativeModules;
const screenCaptureEmitter = new NativeEventEmitter(ScreenCaptureModule);

// ============================================
// TYPES & INTERFACES
// ============================================

export interface CropRegion {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface CaptureOptions {
    intervalMs?: number;
    cropRegion?: CropRegion;
}

export interface FrameCaptureEvent {
    imagePath: string;
    timestamp: number;
}

export interface AndroidVersionInfo {
    sdkVersion: number;
    supportsAppSelection: boolean;
    androidVersion?: string;
}

export interface FrameData {
    path: string;
    timestamp: number;
}

export interface CaptureState {
    isCapturing: boolean;
    permissionGranted: boolean;
    latestFrame: FrameData | null;
    captureStartTime: number | null;
    androidInfo: AndroidVersionInfo | null;
}

export type StateChangeCallback = (state: CaptureState) => void;
export type FrameCallback = (frame: FrameData) => void;

// ============================================
// SCREEN CAPTURE SERVICE CLASS
// ============================================

/**
 * Screen Capture Service - Singleton
 * 
 * @example
 * ```typescript
 * import { screenCaptureService } from '../services/ScreenCaptureService';
 * 
 * await screenCaptureService.initialize();
 * await screenCaptureService.selectApp();
 * await screenCaptureService.startCapture({ intervalMs: 500 });
 * 
 * screenCaptureService.onStateChange((state) => console.log(state));
 * screenCaptureService.cleanup();
 * ```
 */
class ScreenCaptureService {
    private _state: CaptureState = {
        isCapturing: false,
        permissionGranted: false,
        latestFrame: null,
        captureStartTime: null,
        androidInfo: null,
    };

    private frameSubscription: any = null;
    private stateChangeCallbacks: StateChangeCallback[] = [];
    private frameCallbacks: FrameCallback[] = [];

    /** Lấy state hiện tại */
    get state(): CaptureState {
        return { ...this._state };
    }

    /** Check device có hỗ trợ chọn app không (Android 14+) */
    get supportsAppSelection(): boolean {
        return this._state.androidInfo?.supportsAppSelection ?? false;
    }

    /**
     * Khởi tạo service - lấy thông tin Android version
     */
    async initialize(): Promise<AndroidVersionInfo> {
        if (Platform.OS !== 'android') {
            const info = { sdkVersion: 0, supportsAppSelection: false };
            this.updateState({ androidInfo: info });
            return info;
        }

        try {
            const info = await ScreenCaptureModule.getAndroidVersion();
            this.updateState({ androidInfo: info });
            return info;
        } catch (error) {
            console.error('❌ Failed to initialize:', error);
            throw error;
        }
    }

    /**
     * Chọn app để capture (hiện Android dialog)
     */
    async selectApp(): Promise<boolean> {
        if (Platform.OS !== 'android') {
            return Promise.reject('Screen capture only available on Android');
        }

        try {
            if (this._state.isCapturing) {
                await this.stopCapture();
            }

            console.log('📱 Requesting permission...');
            const granted = await ScreenCaptureModule.requestPermission();

            this.updateState({ permissionGranted: granted });
            return granted;
        } catch (error) {
            console.error('❌ Error selecting app:', error);
            this.updateState({ permissionGranted: false });
            throw error;
        }
    }

    /**
     * Bắt đầu capture
     */
    async startCapture(options: CaptureOptions = { intervalMs: 500 }): Promise<void> {
        if (Platform.OS !== 'android') {
            throw new Error('Screen capture only available on Android');
        }

        if (!this._state.permissionGranted) {
            throw new Error('Permission not granted. Call selectApp() first.');
        }

        try {
            console.log('▶️ Starting capture...');
            this.removeFrameSubscription();

            // Subscribe frame events
            this.frameSubscription = screenCaptureEmitter.addListener(
                'onFrameCaptured',
                (event: FrameCaptureEvent) => {
                    const frame: FrameData = {
                        path: event.imagePath,
                        timestamp: Date.now(),
                    };
                    this.updateState({ latestFrame: frame });
                    this.notifyFrameCallbacks(frame);
                }
            );

            await ScreenCaptureModule.startCapture(options);
            this.updateState({ isCapturing: true, captureStartTime: Date.now() });
        } catch (error) {
            console.error('❌ Failed to start:', error);
            this.removeFrameSubscription();
            throw error;
        }
    }

    /**
     * Dừng capture
     */
    async stopCapture(): Promise<void> {
        if (Platform.OS !== 'android') return;

        try {
            console.log('⏹️ Stopping capture...');
            await ScreenCaptureModule.stopCapture();
            this.removeFrameSubscription();

            this.updateState({
                isCapturing: false,
                latestFrame: null,
                captureStartTime: null,
                permissionGranted: false,
            });
        } catch (error) {
            console.error('❌ Failed to stop:', error);
            throw error;
        }
    }

    /**
     * Set crop region
     */
    async setCropRegion(region: CropRegion): Promise<boolean> {
        if (Platform.OS !== 'android') return false;
        return ScreenCaptureModule.setCropRegion(region.x, region.y, region.width, region.height);
    }

    /**
     * Clear crop region
     */
    async clearCropRegion(): Promise<boolean> {
        if (Platform.OS !== 'android') return false;
        return ScreenCaptureModule.clearCropRegion();
    }

    /**
     * Check overlay permission
     */
    async checkOverlayPermission(): Promise<boolean> {
        if (Platform.OS !== 'android') return false;
        return ScreenCaptureModule.checkOverlayPermission();
    }

    /**
     * Request overlay permission
     */
    requestOverlayPermission(): void {
        if (Platform.OS !== 'android') return;
        ScreenCaptureModule.requestOverlayPermission();
    }

    /**
     * Subscribe state changes
     */
    onStateChange(callback: StateChangeCallback): () => void {
        this.stateChangeCallbacks.push(callback);
        callback(this.state);

        return () => {
            const index = this.stateChangeCallbacks.indexOf(callback);
            if (index > -1) this.stateChangeCallbacks.splice(index, 1);
        };
    }

    /**
     * Subscribe frame events
     */
    onFrame(callback: FrameCallback): () => void {
        this.frameCallbacks.push(callback);

        return () => {
            const index = this.frameCallbacks.indexOf(callback);
            if (index > -1) this.frameCallbacks.splice(index, 1);
        };
    }

    /**
     * Cleanup - gọi khi component unmount
     */
    cleanup(): void {
        console.log('🧹 Cleaning up...');
        this.removeFrameSubscription();
        if (Platform.OS === 'android') {
            ScreenCaptureModule.stopCapture().catch(() => { });
        }
        this.stateChangeCallbacks = [];
        this.frameCallbacks = [];
    }

    /**
     * Format thời gian capture (mm:ss)
     */
    formatDuration(): string {
        const { captureStartTime } = this._state;
        if (!captureStartTime) return '00:00';

        const seconds = Math.floor((Date.now() - captureStartTime) / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // === Private ===

    private updateState(partial: Partial<CaptureState>): void {
        this._state = { ...this._state, ...partial };
        this.stateChangeCallbacks.forEach((cb) => cb(this.state));
    }

    private notifyFrameCallbacks(frame: FrameData): void {
        this.frameCallbacks.forEach((cb) => cb(frame));
    }

    private removeFrameSubscription(): void {
        if (this.frameSubscription) {
            this.frameSubscription.remove();
            this.frameSubscription = null;
        }
    }
}

// Singleton instance
export const screenCaptureService = new ScreenCaptureService();
export default ScreenCaptureService;
