/**
 * RealtimePipelineService - Simple Pipeline for Capture → OCR → Translate → Overlay
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
    private currentFrameId = 0;  // Track which frame we're processing
    private pendingFrame: FrameData | null = null;  // Store latest frame if busy

    private stats = {
        framesReceived: 0,
        ocrCompleted: 0,
        translationsCompleted: 0,
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
        this.pendingFrame = null;
        this.stats = { framesReceived: 0, ocrCompleted: 0, translationsCompleted: 0 };

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

        console.log('[PIPELINE] ▶️ Started');
    }

    stop(): void {
        this.status = 'idle';
        if (this.nativeSubscription) {
            this.nativeSubscription.remove();
            this.nativeSubscription = null;
        }
        this.pendingFrame = null;
        overlayService.stop();
        console.log('[PIPELINE] ⏹️ Stopped');
    }

    private handleFrame = (frame: FrameData): void => {
        if (this.status !== 'running') return;

        // Increment frame ID - this invalidates any in-progress processing
        this.currentFrameId++;
        const thisFrameId = this.currentFrameId;

        this.stats.framesReceived++;
        console.log(`[PIPELINE] 📥 Frame #${this.stats.framesReceived} (ID: ${thisFrameId})`);

        // Clear overlay immediately - screen has changed
        overlayService.updateOverlay([]);

        // If already processing, save this frame for later
        if (this.isProcessing) {
            console.log(`[PIPELINE] ⏳ Busy, queuing frame for after current completes`);
            this.pendingFrame = frame;
            return;
        }

        this.processFrame(frame, thisFrameId);
    };

    private async processFrame(frame: FrameData, frameId: number): Promise<void> {
        this.isProcessing = true;
        const startTime = Date.now();

        try {
            // OCR
            console.log(`[PIPELINE] 🔍 OCR START (Frame ID: ${frameId})`);
            const ocrStart = Date.now();
            const blocks = await textDetectionService.detectText(frame.path, this.config.script);
            console.log(`[PIPELINE] 🔍 OCR DONE | ${blocks?.length || 0} blocks | ${Date.now() - ocrStart}ms`);

            // Check if this frame is still current
            if (frameId !== this.currentFrameId) {
                console.log(`[PIPELINE] ⏭️ Frame ${frameId} outdated (current: ${this.currentFrameId}), discarding`);
                return;
            }

            if (this.status !== 'running') return;
            this.stats.ocrCompleted++;

            if (!blocks || blocks.length === 0) {
                console.log(`[PIPELINE] 📭 No text found`);
                return;
            }

            // Log detected text
            console.log(`[PIPELINE] 📝 Detected:`);
            blocks.slice(0, 3).forEach((b, i) => console.log(`   [${i}] "${b.text.substring(0, 50)}"`));

            // Translate
            console.log(`[PIPELINE] 🌐 TRANSLATE START`);
            const transStart = Date.now();
            const response = await TranslationManager.translate({
                items: blocks.map((b, i) => ({ id: `${i}`, text: b.text })),
                sourceLanguage: this.config.sourceLanguage === 'auto' ? undefined : this.config.sourceLanguage,
                targetLanguage: this.config.targetLanguage,
                strategy: 'MLKIT',
                saveHistory: false,
            });
            console.log(`[PIPELINE] 🌐 TRANSLATE DONE | ${response.results?.length || 0} results | ${Date.now() - transStart}ms`);

            // Check AGAIN if this frame is still current after translation
            if (frameId !== this.currentFrameId) {
                console.log(`[PIPELINE] ⏭️ Frame ${frameId} outdated after translate (current: ${this.currentFrameId}), discarding`);
                return;
            }

            if (this.status !== 'running') return;
            this.stats.translationsCompleted++;

            // Build translated blocks
            const translatedBlocks = blocks.map((block, index) => {
                const translation = response.results?.find(r => r.id === `${index}`);
                return { ...block, text: translation ? translation.t : block.text };
            });

            // Update overlay
            console.log(`[PIPELINE] 📤 OVERLAY UPDATE (Frame ID: ${frameId})`);
            translatedBlocks.slice(0, 2).forEach((b, i) => console.log(`   [${i}] "${b.text.substring(0, 50)}"`));
            overlayService.updateOverlay(translatedBlocks);

            console.log(`[PIPELINE] ✅ COMPLETE | Total: ${Date.now() - startTime}ms`);
        } catch (error) {
            console.error(`[PIPELINE] ❌ ERROR:`, error);
        } finally {
            this.isProcessing = false;

            // Check if there's a pending frame to process
            if (this.pendingFrame && this.status === 'running') {
                const nextFrame = this.pendingFrame;
                this.pendingFrame = null;
                console.log(`[PIPELINE] 🔄 Processing pending frame`);
                this.processFrame(nextFrame, this.currentFrameId);
            }
        }
    }
}

export const realtimePipelineService = new RealtimePipelineService();
export default realtimePipelineService;
