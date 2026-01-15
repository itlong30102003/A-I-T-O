/**
 * RealtimePipelineService - Optimized Async Pipeline for Capture → OCR → Translate → Overlay
 */

import { FrameData } from './ScreenCaptureService';
import textDetectionService, { TextBlock, ScriptType } from './TextDetectionService';
import TranslationManager from './TranslationManager';
import { overlayService } from './OverlayService';

export interface PipelineConfig {
    script: ScriptType;
    sourceLanguage?: string;
    targetLanguage: string;
    debounceMs?: number;
    maxPendingOCR?: number;
    maxPendingTranslation?: number;
}

interface PendingOCRTask {
    frame: FrameData;
    cancelled: boolean;
}

interface PendingTranslationTask {
    blocks: TextBlock[];
    timestamp: number;
    cancelled: boolean;
}

type PipelineStatus = 'idle' | 'running' | 'paused';

class RealtimePipelineService {
    private config: PipelineConfig = {
        script: 'latin',
        targetLanguage: 'vi',
        debounceMs: 250,
        maxPendingOCR: 2,
        maxPendingTranslation: 2,
    };

    private status: PipelineStatus = 'idle';
    private frameUnsubscribe: (() => void) | null = null;
    private nativeSubscription: any = null;
    private statsTimer: ReturnType<typeof setInterval> | null = null;
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;

    private pendingOCRTasks: PendingOCRTask[] = [];
    private pendingTranslationTasks: PendingTranslationTask[] = [];
    private lastFrameTimestamp = 0;

    private stats = {
        framesReceived: 0,
        ocrCompleted: 0,
        translationsCompleted: 0,
        overlayUpdates: 0,
    };

    start(config: PipelineConfig): void {
        if (this.status === 'running') {
            this.config = { ...this.config, ...config };
            return;
        }

        this.config = { ...this.config, ...config };
        this.status = 'running';
        this.resetStats();

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

        this.frameUnsubscribe = () => {
            if (this.nativeSubscription) {
                this.nativeSubscription.remove();
                this.nativeSubscription = null;
            }
        };

        // Periodic status log for production monitoring (hidden in warn to stay visible but clean)
        this.statsTimer = setInterval(() => {
            if (this.status === 'running') {
                console.log(`Realtime Status [FPS Index: ${this.stats.framesReceived}] OCR: ${this.stats.ocrCompleted}, Trans: ${this.stats.translationsCompleted}`);
            }
        }, 5000);
    }

    stop(): void {
        this.status = 'idle';
        if (this.frameUnsubscribe) {
            this.frameUnsubscribe();
            this.frameUnsubscribe = null;
        }
        if (this.statsTimer) clearInterval(this.statsTimer);
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.cancelAllPendingTasks();
        overlayService.stop();
    }

    private handleFrame = (frame: FrameData): void => {
        if (this.status !== 'running') return;
        this.stats.framesReceived++;

        // Debounce to improve performance and avoid flickering
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.processFrame(frame);
        }, this.config.debounceMs);
    };

    private async processFrame(frame: FrameData): Promise<void> {
        if (frame.timestamp < this.lastFrameTimestamp) return;
        this.lastFrameTimestamp = frame.timestamp;

        // Clean up old tasks if queue is too long
        if (this.pendingOCRTasks.length >= (this.config.maxPendingOCR || 2)) {
            const oldest = this.pendingOCRTasks.shift();
            if (oldest) oldest.cancelled = true;
        }

        const ocrTask: PendingOCRTask = { frame, cancelled: false };
        this.pendingOCRTasks.push(ocrTask);

        try {
            const blocks = await textDetectionService.detectText(frame.path, this.config.script);

            if (ocrTask.cancelled || this.status !== 'running') return;
            this.stats.ocrCompleted++;
            this.cleanupTask(ocrTask, this.pendingOCRTasks);

            if (!blocks || blocks.length === 0) {
                overlayService.updateOverlay([]); // Clear overlay if no text
                return;
            }

            this.processTranslation(blocks, frame.timestamp);
        } catch (error) {
            console.error('RealtimePipeline: OCR failed', error);
            this.cleanupTask(ocrTask, this.pendingOCRTasks);
        }
    }

    private async processTranslation(blocks: TextBlock[], timestamp: number): Promise<void> {
        if (this.pendingTranslationTasks.length >= (this.config.maxPendingTranslation || 2)) {
            const oldest = this.pendingTranslationTasks.shift();
            if (oldest) oldest.cancelled = true;
        }

        const translationTask: PendingTranslationTask = { blocks, timestamp, cancelled: false };
        this.pendingTranslationTasks.push(translationTask);

        try {
            const response = await TranslationManager.translate({
                items: blocks.map((b, i) => ({ id: `${i}`, text: b.text })),
                sourceLanguage: this.config.sourceLanguage === 'auto' ? undefined : this.config.sourceLanguage,
                targetLanguage: this.config.targetLanguage,
                strategy: 'MLKIT',
                saveHistory: false,
            });

            if (translationTask.cancelled || this.status !== 'running') return;
            this.stats.translationsCompleted++;
            this.cleanupTask(translationTask, this.pendingTranslationTasks);

            const translatedBlocks = blocks.map((block, index) => {
                const translation = response.results?.find(r => r.id === `${index}`);
                return { ...block, text: translation ? translation.t : block.text };
            });

            overlayService.updateOverlay(translatedBlocks);
            this.stats.overlayUpdates++;
        } catch (error) {
            console.error('RealtimePipeline: Translation failed', error);
            this.cleanupTask(translationTask, this.pendingTranslationTasks);
        }
    }

    private cleanupTask<T>(task: T, queue: T[]): void {
        const index = queue.indexOf(task);
        if (index > -1) queue.splice(index, 1);
    }

    private cancelAllPendingTasks(): void {
        this.pendingOCRTasks.forEach(t => t.cancelled = true);
        this.pendingTranslationTasks.forEach(t => t.cancelled = true);
        this.pendingOCRTasks = [];
        this.pendingTranslationTasks = [];
    }

    private resetStats(): void {
        this.stats = { framesReceived: 0, ocrCompleted: 0, translationsCompleted: 0, overlayUpdates: 0 };
    }
}

export const realtimePipelineService = new RealtimePipelineService();
export default realtimePipelineService;
