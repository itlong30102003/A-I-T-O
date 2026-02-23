/**
 * RealtimePipelineService - Optimized Pipeline for Capture → OCR → Translate → Overlay
 * 
 * Features:
 * - Auto/Manual mode toggle
 * - Debounce (500ms) to wait for stable frame
 * - Text similarity cache to skip re-translation
 * - Translation result cache by text hash
 * - Hide overlay immediately on frame change, show when translation done
 */

import { FrameData } from './ScreenCaptureService';
import textDetectionService, { TextBlock, ScriptType } from './TextDetectionService';
import TranslationManager from './TranslationManager';
import { overlayService } from './OverlayService';

export interface PipelineConfig {
    script: ScriptType;
    sourceLanguage?: string;
    targetLanguage: string;
}

type PipelineStatus = 'idle' | 'running';

class RealtimePipelineService {
    private config: PipelineConfig = {
        script: 'latin',
        targetLanguage: 'vi',
    };

    private status: PipelineStatus = 'idle';
    private nativeSubscription: any = null;
    private isProcessing = false;
    private currentFrameId = 0;

    // Auto/Manual mode
    private isAutoMode = true;
    private debounceTimer: any = null;
    private static readonly DEBOUNCE_MS = 500;

    // Text cache — skip re-translate if text unchanged
    private lastOcrText = '';
    private lastTranslatedBlocks: any[] = [];

    // Translation cache — hash → translated blocks
    private translationCache = new Map<string, any[]>();
    private static readonly MAX_CACHE_SIZE = 20;

    // Latest frame for manual translate
    private latestFrame: FrameData | null = null;

    private stats = {
        framesReceived: 0,
        ocrCompleted: 0,
        translationsCompleted: 0,
        cacheHits: 0,
    };

    start(config: PipelineConfig): void {
        if (this.status === 'running') {
            this.config = { ...this.config, ...config };
            console.log('[PIPELINE] Config updated while running');
            return;
        }

        this.config = { ...this.config, ...config };
        this.status = 'running';
        this.isProcessing = false;
        this.currentFrameId = 0;
        this.latestFrame = null;
        this.lastOcrText = '';
        this.lastTranslatedBlocks = [];
        this.translationCache.clear();
        this.stats = { framesReceived: 0, ocrCompleted: 0, translationsCompleted: 0, cacheHits: 0 };

        const { ScreenCaptureModule } = require('react-native').NativeModules;
        const { NativeEventEmitter } = require('react-native');
        const emitter = new NativeEventEmitter(ScreenCaptureModule);

        this.nativeSubscription = emitter.addListener('onFrameCaptured', (event: any) => {
            if (this.status !== 'running') return;
            this.handleFrame({
                path: event.imagePath,
                timestamp: event.timestamp || Date.now(),
            });
        });

        console.log('[PIPELINE] ▶️ Started (mode: ' + (this.isAutoMode ? 'AUTO' : 'MANUAL') + ')');
    }

    stop(): void {
        this.status = 'idle';
        if (this.nativeSubscription) {
            this.nativeSubscription.remove();
            this.nativeSubscription = null;
        }
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        this.latestFrame = null;
        overlayService.hideTranslation();
        overlayService.stop();
        console.log('[PIPELINE] ⏹️ Stopped');
    }

    /**
     * Pause pipeline — stops frame processing but keeps overlay/navbar alive.
     * Used by navbar Stop button to pause without destroying UI.
     */
    pause(): void {
        this.status = 'idle';
        if (this.nativeSubscription) {
            this.nativeSubscription.remove();
            this.nativeSubscription = null;
        }
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        this.latestFrame = null;
        overlayService.hideTranslation();
        console.log('[PIPELINE] ⏸️ Paused (navbar stays)');
    }

    setAutoMode(auto: boolean): void {
        this.isAutoMode = auto;
        console.log(`[PIPELINE] Mode: ${auto ? '⚡ AUTO' : '✋ MANUAL'}`);

        // If switching to auto and we have a frame, start debounce
        if (auto && this.latestFrame && this.status === 'running') {
            this.startDebounce(this.latestFrame);
        }
    }

    getAutoMode(): boolean {
        return this.isAutoMode;
    }

    getStatus(): PipelineStatus {
        return this.status;
    }

    /**
     * Manual translate trigger — called when user presses "Dịch" button
     */
    triggerManualTranslate(): void {
        if (this.status !== 'running') return;
        if (!this.latestFrame) {
            console.log('[PIPELINE] ⚠️ No frame available for manual translate');
            return;
        }
        if (this.isProcessing) {
            console.log('[PIPELINE] ⏳ Already processing, please wait');
            return;
        }

        console.log('[PIPELINE] 🔘 Manual translate triggered');
        this.currentFrameId++;
        this.processFrame(this.latestFrame, this.currentFrameId);
    }

    private handleFrame = (frame: FrameData): void => {
        if (this.status !== 'running') return;

        this.currentFrameId++;
        this.stats.framesReceived++;
        this.latestFrame = frame;

        // Hide overlay immediately — screen has changed
        overlayService.hideTranslation();

        // Cancel any pending debounce
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }

        // In auto mode, start debounce to wait for stable frame
        if (this.isAutoMode) {
            this.startDebounce(frame);
        }
        // In manual mode, do nothing — wait for user to press "Dịch"
    };

    private startDebounce(frame: FrameData): void {
        const frameId = this.currentFrameId;

        this.debounceTimer = setTimeout(() => {
            this.debounceTimer = null;

            // Verify frame is still current
            if (frameId !== this.currentFrameId) return;
            if (this.status !== 'running') return;
            if (this.isProcessing) return;

            console.log(`[PIPELINE] ⏰ Debounce complete, processing frame`);
            this.processFrame(frame, frameId);
        }, RealtimePipelineService.DEBOUNCE_MS);
    }

    private async processFrame(frame: FrameData, frameId: number): Promise<void> {
        this.isProcessing = true;
        const startTime = Date.now();

        try {
            // OCR
            const ocrStart = Date.now();
            const blocks = await textDetectionService.detectText(frame.path, this.config.script);
            console.log(`[PIPELINE] 🔍 OCR: ${blocks?.length || 0} blocks | ${Date.now() - ocrStart}ms`);

            if (frameId !== this.currentFrameId || this.status !== 'running') {
                console.log(`[PIPELINE] ⏭️ Frame outdated, discarding`);
                return;
            }

            this.stats.ocrCompleted++;

            if (!blocks || blocks.length === 0) {
                console.log(`[PIPELINE] 📭 No text found`);
                return;
            }

            // Build text hash for cache comparison
            const currentText = blocks.map(b => b.text).join('\n');
            const textHash = this.simpleHash(currentText);

            // Check if text is same as last translated
            if (currentText === this.lastOcrText && this.lastTranslatedBlocks.length > 0) {
                console.log(`[PIPELINE] ♻️ Text unchanged, showing cached overlay`);
                this.stats.cacheHits++;
                overlayService.updateOverlay(this.lastTranslatedBlocks);
                overlayService.showTranslation();
                console.log(`[PIPELINE] ✅ Cache hit | Total: ${Date.now() - startTime}ms`);
                return;
            }

            // Check translation cache by hash
            const cachedResult = this.translationCache.get(textHash);
            if (cachedResult) {
                console.log(`[PIPELINE] 💾 Translation cache hit`);
                this.stats.cacheHits++;
                this.lastOcrText = currentText;
                this.lastTranslatedBlocks = cachedResult;
                overlayService.updateOverlay(cachedResult);
                overlayService.showTranslation();
                console.log(`[PIPELINE] ✅ Hash cache hit | Total: ${Date.now() - startTime}ms`);
                return;
            }

            // Translate — bypass queue, call directly for realtime speed
            const transStart = Date.now();
            const response = await TranslationManager.executeTranslation({
                items: blocks.map((b, i) => ({ id: `${i}`, text: b.text })),
                sourceLanguage: this.config.sourceLanguage === 'auto' ? undefined : this.config.sourceLanguage,
                targetLanguage: this.config.targetLanguage,
                strategy: 'MLKIT',
                saveHistory: false,
            });
            console.log(`[PIPELINE] 🌐 Translate: ${response.results?.length || 0} results | ${Date.now() - transStart}ms`);

            // Check again if frame is still current
            if (frameId !== this.currentFrameId || this.status !== 'running') {
                console.log(`[PIPELINE] ⏭️ Frame outdated after translate, discarding`);
                return;
            }

            this.stats.translationsCompleted++;

            // Build translated blocks
            const translatedBlocks = blocks.map((block, index) => {
                const translation = response.results?.find(r => r.id === `${index}`);
                return { ...block, text: translation ? translation.t : block.text };
            });

            // Cache results
            this.lastOcrText = currentText;
            this.lastTranslatedBlocks = translatedBlocks;
            this.translationCache.set(textHash, translatedBlocks);

            // Evict oldest cache entries
            if (this.translationCache.size > RealtimePipelineService.MAX_CACHE_SIZE) {
                const firstKey = this.translationCache.keys().next().value;
                if (firstKey) this.translationCache.delete(firstKey);
            }

            // Show overlay
            overlayService.updateOverlay(translatedBlocks);
            overlayService.showTranslation();
            console.log(`[PIPELINE] ✅ COMPLETE | Total: ${Date.now() - startTime}ms | Stats: ${JSON.stringify(this.stats)}`);
        } catch (error) {
            console.error(`[PIPELINE] ❌ ERROR:`, error);
        } finally {
            this.isProcessing = false;
        }
    }

    private simpleHash(text: string): string {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return hash.toString(36);
    }
}

export const realtimePipelineService = new RealtimePipelineService();
export default realtimePipelineService;
