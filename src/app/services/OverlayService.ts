import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { OverlayModule } = NativeModules;

export interface WordTapEvent {
    x: number;
    y: number;
}

export interface ParagraphSelectEvent {
    x: number;
    y: number;
    width: number;
    height: number;
}

class OverlayService {
    isSupported: boolean;
    private emitter: NativeEventEmitter | null = null;

    constructor() {
        this.isSupported = Platform.OS === 'android';
        if (this.isSupported && OverlayModule) {
            this.emitter = new NativeEventEmitter(OverlayModule);
        }
    }

    /**
     * Check if the app has permission to draw over other apps.
     */
    async checkPermission(): Promise<boolean> {
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
     */
    async requestPermission(): Promise<boolean> {
        if (!this.isSupported) return false;
        try {
            return await OverlayModule.requestPermission();
        } catch (error) {
            console.error('Error requesting overlay permission:', error);
            return false;
        }
    }

    /**
     * Start the overlay service with the given data (JSON string of blocks).
     */
    async start(data: string): Promise<boolean> {
        if (!this.isSupported) return false;
        try {
            const hasPermission = await this.checkPermission();
            if (hasPermission) {
                OverlayModule.startOverlay(data);
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
     * Show the logo button at bottom-right corner.
     */
    showLogo(): void {
        if (!this.isSupported) return;
        OverlayModule.showLogo();
    }

    /**
     * Hide the logo and navbar.
     */
    hideLogo(): void {
        if (!this.isSupported) return;
        OverlayModule.hideLogo();
    }

    /**
     * Toggle navbar visibility.
     */
    toggleNavbar(): void {
        if (!this.isSupported) return;
        OverlayModule.toggleNavbar();
    }

    /**
     * Update navbar configuration.
     */
    setNavbarConfig(mode: string, sourceLang: string, targetLang: string): void {
        if (!this.isSupported) return;
        OverlayModule.setNavbarConfig(mode, sourceLang, targetLang);
    }

    /**
     * Toggle touch interaction for overlay.
     */
    setInteractionEnabled(enabled: boolean): void {
        if (!this.isSupported) return;
        OverlayModule.setInteractionEnabled(enabled);
    }

    /**
     * Show translation overlay (touch pass-through).
     */
    showTranslation(): void {
        if (!this.isSupported) return;
        OverlayModule.showTranslation();
    }

    /**
     * Hide translation overlay.
     */
    hideTranslation(): void {
        if (!this.isSupported) return;
        OverlayModule.hideTranslation();
    }

    /**
     * Subscribe to logo click events.
     */
    onLogoClick(callback: () => void): () => void {
        if (!this.isSupported || !this.emitter) return () => { };
        const subscription = this.emitter.addListener('onOverlayLogoClick', callback);
        return () => subscription.remove();
    }

    /**
     * Subscribe to source language button click.
     */
    onSourceLangClick(callback: () => void): () => void {
        if (!this.isSupported || !this.emitter) return () => { };
        const subscription = this.emitter.addListener('onNavbarSourceLangClick', callback);
        return () => subscription.remove();
    }

    /**
     * Subscribe to target language button click.
     */
    onTargetLangClick(callback: () => void): () => void {
        if (!this.isSupported || !this.emitter) return () => { };
        const subscription = this.emitter.addListener('onNavbarTargetLangClick', callback);
        return () => subscription.remove();
    }

    /**
     * Subscribe to translate button click.
     */
    onTranslateClick(callback: () => void): () => void {
        if (!this.isSupported || !this.emitter) return () => { };
        const subscription = this.emitter.addListener('onNavbarTranslateClick', callback);
        return () => subscription.remove();
    }

    /**
     * Subscribe to auto mode toggle click.
     */
    onAutoModeClick(callback: () => void): () => void {
        if (!this.isSupported || !this.emitter) return () => { };
        const subscription = this.emitter.addListener('onNavbarAutoModeClick', callback);
        return () => subscription.remove();
    }

    /**
     * Subscribe to close button click.
     */
    onCloseClick(callback: () => void): () => void {
        if (!this.isSupported || !this.emitter) return () => { };
        const subscription = this.emitter.addListener('onNavbarCloseClick', callback);
        return () => subscription.remove();
    }

    /**
     * Set overlay font style (dark = black bg white text, light = white bg black text).
     */
    setOverlayStyle(style: 'dark' | 'light'): void {
        if (!this.isSupported) return;
        OverlayModule.setOverlayStyle(style);
    }

    /**
     * Set overlay text size scale factor.
     */
    setOverlayTextSize(scale: number): void {
        if (!this.isSupported) return;
        OverlayModule.setOverlayTextSize(scale);
    }

    /**
     * Update overlay with translated blocks.
     */
    updateOverlay(blocks: any[]): void {
        if (!this.isSupported) return;
        const json = JSON.stringify(blocks);
        this.start(json);
    }

    /**
     * Stop the overlay service.
     */
    stop(): void {
        if (!this.isSupported) return;
        try {
            OverlayModule.stopOverlay();
        } catch (error) {
            console.error('Error stopping overlay:', error);
        }
    }

}

export const overlayService = new OverlayService();

