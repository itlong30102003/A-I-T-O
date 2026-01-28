import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { SelectionModeModule } = NativeModules;

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

export interface OverlayToggleEvent {
    isVisible: boolean;
}

/**
 * SelectionModeService - JS wrapper for native SelectionModeModule
 * 
 * Independent microservice for text/paragraph selection
 */
class SelectionModeService {
    isSupported: boolean;
    private emitter: NativeEventEmitter | null = null;
    private _isActive: boolean = false;
    private _isOverlayVisible: boolean = false;

    constructor() {
        this.isSupported = Platform.OS === 'android' && !!SelectionModeModule;
        if (this.isSupported) {
            this.emitter = new NativeEventEmitter(SelectionModeModule);
        }
    }

    /**
     * Start selection mode service
     * @param type - 'WORD' for single word, 'PARAGRAPH' for area selection
     */
    start(type: 'WORD' | 'PARAGRAPH'): void {
        if (!this.isSupported) return;
        console.log(`[SelectionModeService] Starting with type: ${type}`);
        this._isActive = true;
        this._isOverlayVisible = false;
        SelectionModeModule.start(type);
    }

    /**
     * Stop selection mode service
     */
    stop(): void {
        if (!this.isSupported) return;
        console.log('[SelectionModeService] Stopping');
        this._isActive = false;
        this._isOverlayVisible = false;
        SelectionModeModule.stop();
    }

    /**
     * Toggle selection overlay on/off
     */
    toggleOverlay(): void {
        if (!this.isSupported) return;
        console.log('[SelectionModeService] Toggle overlay');
        SelectionModeModule.toggleOverlay();
    }

    /**
     * Show selection overlay
     */
    showOverlay(): void {
        if (!this.isSupported) return;
        console.log('[SelectionModeService] Show overlay');
        SelectionModeModule.showOverlay();
    }

    /**
     * Hide selection overlay
     */
    hideOverlay(): void {
        if (!this.isSupported) return;
        console.log('[SelectionModeService] Hide overlay');
        SelectionModeModule.hideOverlay();
    }

    /**
     * Check if overlay is currently visible
     */
    async isOverlayVisible(): Promise<boolean> {
        if (!this.isSupported) return false;
        try {
            return await SelectionModeModule.isOverlayVisible();
        } catch {
            return false;
        }
    }

    /**
     * Set selection type
     */
    setSelectionType(type: 'WORD' | 'PARAGRAPH'): void {
        if (!this.isSupported) return;
        SelectionModeModule.setSelectionType(type);
    }

    /**
     * Show result popup with translation
     */
    showResultPopup(originalText: string, translatedText: string, hintX: number = 0, hintY: number = 0): void {
        if (!this.isSupported) return;
        console.log('[SelectionModeService] Show result popup');
        SelectionModeModule.showResultPopup(originalText, translatedText, hintX, hintY);
    }

    /**
     * Hide result popup
     */
    hideResultPopup(): void {
        if (!this.isSupported) return;
        SelectionModeModule.hideResultPopup();
    }

    /**
     * Show loading indicator at tap position
     */
    showLoadingAt(x: number, y: number): void {
        if (!this.isSupported) return;
        console.log(`[SelectionModeService] Show loading at ${x}, ${y}`);
        SelectionModeModule.showLoadingAt(x, y);
    }

    /**
     * Hide loading indicator
     */
    hideLoading(): void {
        if (!this.isSupported) return;
        SelectionModeModule.hideLoading();
    }

    /**
     * Show text highlight at bounding box
     */
    showTextHighlight(x: number, y: number, width: number, height: number): void {
        if (!this.isSupported) return;
        console.log(`[SelectionModeService] Show highlight at ${x},${y} ${width}x${height}`);
        SelectionModeModule.showTextHighlight(x, y, width, height);
    }

    /**
     * Hide text highlight
     */
    hideTextHighlight(): void {
        if (!this.isSupported) return;
        SelectionModeModule.hideTextHighlight();
    }

    /**
     * Draw detected text bounding boxes for pre-scan WORD mode
     * @param boxes Array of bounding boxes {x, y, width, height}
     */
    drawDetectedBoxes(boxes: Array<{ x: number; y: number; width: number; height: number }>): void {
        if (!this.isSupported) return;
        console.log(`[SelectionModeService] Drawing ${boxes.length} detected boxes`);
        SelectionModeModule.updateDetectedBoxes(boxes);
    }

    /**
     * Clear all detected boxes
     */
    clearDetectedBoxes(): void {
        if (!this.isSupported) return;
        console.log('[SelectionModeService] Clearing detected boxes');
        SelectionModeModule.clearDetectedBoxes();
    }

    /**
     * Update selection highlight (for PARAGRAPH mode smart snap)
     */
    updateSelectionHighlight(x: number, y: number, width: number, height: number): void {
        if (!this.isSupported) return;
        console.log(`[SelectionModeService] Updating selection highlight: (${x},${y}) ${width}x${height}`);
        SelectionModeModule.updateSelectionHighlight(x, y, width, height);
    }

    // ==================== EVENT SUBSCRIPTIONS ====================

    /**
     * Subscribe to word tap events
     */
    onWordTapped(callback: (event: WordTapEvent) => void): () => void {
        if (!this.isSupported || !this.emitter) return () => { };
        const subscription = this.emitter.addListener('onSelectionWordTapped', callback);
        return () => subscription.remove();
    }

    /**
     * Subscribe to paragraph selection events
     */
    onParagraphSelected(callback: (event: ParagraphSelectEvent) => void): () => void {
        if (!this.isSupported || !this.emitter) return () => { };
        const subscription = this.emitter.addListener('onSelectionParagraphSelected', callback);
        return () => subscription.remove();
    }

    /**
     * Subscribe to selection cancelled events
     */
    onSelectionCancelled(callback: () => void): () => void {
        if (!this.isSupported || !this.emitter) return () => { };
        const subscription = this.emitter.addListener('onSelectionCancelled', callback);
        return () => subscription.remove();
    }

    /**
     * Subscribe to popup dismissed events
     */
    onPopupDismissed(callback: () => void): () => void {
        if (!this.isSupported || !this.emitter) return () => { };
        const subscription = this.emitter.addListener('onSelectionPopupDismissed', callback);
        return () => subscription.remove();
    }

    /**
     * Subscribe to overlay toggle events
     */
    onOverlayToggled(callback: (event: OverlayToggleEvent) => void): () => void {
        if (!this.isSupported || !this.emitter) return () => { };
        const subscription = this.emitter.addListener('onSelectionOverlayToggled', (event) => {
            this._isOverlayVisible = event.isVisible;
            callback(event);
        });
        return () => subscription.remove();
    }

    /**
     * Subscribe to selection started events (fired when user starts drawing new selection)
     */
    onSelectionStarted(callback: () => void): () => void {
        if (!this.isSupported || !this.emitter) return () => { };
        const subscription = this.emitter.addListener('onSelectionStarted', callback);
        return () => subscription.remove();
    }

    // Getters
    get isActive(): boolean {
        return this._isActive;
    }

    get overlayVisible(): boolean {
        return this._isOverlayVisible;
    }
}

export const selectionModeService = new SelectionModeService();
export default selectionModeService;
