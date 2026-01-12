import { NativeModules, Platform } from 'react-native';

const { OverlayModule } = NativeModules;

class OverlayService {
    isSupported: boolean;

    constructor() {
        this.isSupported = Platform.OS === 'android';
    }

    /**
     * Check if the app has permission to draw over other apps.
     * @returns {Promise<boolean>}
     */
    async checkPermission() {
        if (!this.isSupported) return false;
        try {
            return await OverlayModule.checkPermission();
        } catch (error) {
            console.error('Error checking overlay permission:', error);
            return false;
        }
    }

    /**
     * Request the "Display over other apps" permission.
     * On Android M+, this will open the system settings screen.
     * @returns {Promise<boolean>}
     */
    async requestPermission() {
        if (!this.isSupported) return false;
        try {
            return await OverlayModule.requestPermission();
        } catch (error) {
            console.error('Error requesting overlay permission:', error);
            return false;
        }
    }

    /**
     * Start the overlay service with the given text.
     * @param {string} text - The text to display on the overlay.
     */
    async start(text = 'Hello World') {
        if (!this.isSupported) return;
        try {
            const hasPermission = await this.checkPermission();
            if (hasPermission) {
                OverlayModule.startOverlay(text);
                return true;
            } else {
                console.warn('Overlay permission not granted');
                return false;
            }
        } catch (error) {
            console.error('Error starting overlay:', error);
            return false;
        }
    }

    /**
     * Stop the overlay service.
     */
    stop() {
        if (!this.isSupported) return;
        try {
            OverlayModule.stopOverlay();
        } catch (error) {
            console.error('Error stopping overlay:', error);
        }
    }
}

export const overlayService = new OverlayService();
