/**
 * RealtimePipelineService - Async Pipeline for Capture → OCR → Translate → Overlay
 * 
 * Architecture:
 * - Each stage runs independently (non-blocking)
 * - Uses "latest-wins" strategy: new frame cancels pending old frame processing
 * - Debouncing prevents overload during rapid content changes
 * - Translation failures don't block the pipeline
 */

import { screenCaptureService, FrameData } from './ScreenCaptureService';
import textDetectionService, { TextBlock, ScriptType } from './TextDetectionService';
import TranslationManager from './TranslationManager';
import { overlayService } from './OverlayService';

export interface PipelineConfig {
    /** Script type for OCR detection */
    script: ScriptType;
    /** Source language code */
    sourceLanguage?: string;
    /** Target language code */
    targetLanguage: string;
    /** Debounce delay in ms (default: 100) */
    debounceMs?: number;
    /** Maximum pending OCR tasks before dropping (default: 2) */
    maxPendingOCR?: number;
    /** Maximum pending translation tasks before dropping (default: 2) */
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
        debounceMs: 100,
        maxPendingOCR: 2,
        maxPendingTranslation: 2,
    };

    private status: PipelineStatus = 'idle';
    private frameUnsubscribe: (() => void) | null = null;

    // Async task tracking
    private pendingOCRTasks: PendingOCRTask[] = [];
    private pendingTranslationTasks: PendingTranslationTask[] = [];
    private lastFrameTimestamp = 0;
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;

    // Statistics for monitoring
    private stats = {
        framesReceived: 0,
        framesDropped: 0,
        ocrCompleted: 0,
        translationsCompleted: 0,
        overlayUpdates: 0,
        errors: 0,
    };

    /**
     * Start the realtime pipeline
     */
    start(config: PipelineConfig): void {
        if (this.status === 'running') {
            console.log('RealtimePipeline: Already running, updating config');
            this.config = { ...this.config, ...config };
            return;
        }

        console.warn('RealtimePipeline: Starting pipeline', JSON.stringify(config));
        this.config = { ...this.config, ...config };
        this.status = 'running';
        this.resetStats();

        // Subscribe DIRECTLY to native emitter to avoid any middleware/service lag
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

        // Add periodic logging for debugging (every 3 seconds)
        this.statsTimer = setInterval(() => {
            if (this.status === 'running') {
                console.log('Realtime Status:',
                    `Frames: ${this.stats.framesReceived}, ` +
                    `OCR: ${this.stats.ocrCompleted}, ` +
                    `Trans: ${this.stats.translationsCompleted}, ` +
                    `Overlay: ${this.stats.overlayUpdates}`);

                if (this.stats.framesReceived === 0) {
                    console.warn('RealtimePipeline: No frames received yet. Check ScreenCapture service state.');
                }
            }
        }, 3000);
    }

    private nativeSubscription: any = null;
    private statsTimer: ReturnType<typeof setInterval> | null = null;

    /**
     * Stop the pipeline and clean up
     */
    stop(): void {
        console.log('RealtimePipeline: Stopping pipeline');

        // Cancel all pending tasks
        this.cancelAllPendingTasks();

        // Clear debounce timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }

        // Unsubscribe from frames
        if (this.frameUnsubscribe) {
            this.frameUnsubscribe();
            this.frameUnsubscribe = null;
        }

        // Clear stats timer
        if (this.statsTimer) {
            clearInterval(this.statsTimer);
            this.statsTimer = null;
        }

        // Clear overlay
        overlayService.stop();

        this.status = 'idle';
        console.log('RealtimePipeline: Stats', this.stats);
    }

    /**
     * Pause pipeline (keeps subscriptions, stops processing)
     */
    pause(): void {
        if (this.status === 'running') {
            this.status = 'paused';
            this.cancelAllPendingTasks();
            console.log('RealtimePipeline: Paused');
        }
    }

    /**
     * Resume pipeline after pause
     */
    resume(): void {
        if (this.status === 'paused') {
            this.status = 'running';
            console.log('RealtimePipeline: Resumed');
        }
    }

    /**
     * Update configuration on the fly
     */
    updateConfig(partialConfig: Partial<PipelineConfig>): void {
        this.config = { ...this.config, ...partialConfig };
        console.log('RealtimePipeline: Config updated', this.config);
    }

    /**
     * Get current status and stats
     */
    getStatus() {
        return {
            status: this.status,
            pendingOCR: this.pendingOCRTasks.filter(t => !t.cancelled).length,
            pendingTranslation: this.pendingTranslationTasks.filter(t => !t.cancelled).length,
            stats: { ...this.stats },
        };
    }

    // ==================== PRIVATE METHODS ====================

    /**
     * Handle incoming frame from capture service
     */
    private handleFrame = (frame: FrameData): void => {
        if (this.status !== 'running') return;

        this.stats.framesReceived++;
        if (this.stats.framesReceived % 5 === 0) {
            console.log(`RealtimePipeline: Frame #${this.stats.framesReceived} arrived from Native`);
        }

        // Debounce rapid frames
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            this.processFrame(frame);
        }, this.config.debounceMs);
    };

    /**
     * Process a frame: Stage 1 - OCR Detection (async)
     */
    private async processFrame(frame: FrameData): Promise<void> {
        console.warn(`RealtimePipeline: Processing frame @ ${frame.timestamp}`);
        // Drop old frames (latest-wins strategy)
        if (frame.timestamp < this.lastFrameTimestamp) {
            this.stats.framesDropped++;
            return;
        }
        this.lastFrameTimestamp = frame.timestamp;

        // Cancel oldest pending OCR if exceeding limit
        const activeOCRTasks = this.pendingOCRTasks.filter(t => !t.cancelled);
        if (activeOCRTasks.length >= (this.config.maxPendingOCR || 2)) {
            const oldestTask = activeOCRTasks[0];
            if (oldestTask) {
                oldestTask.cancelled = true;
                this.stats.framesDropped++;
                console.log('RealtimePipeline: Dropped old OCR task (queue full)');
            }
        }

        // Create new OCR task
        const ocrTask: PendingOCRTask = {
            frame,
            cancelled: false,
        };
        this.pendingOCRTasks.push(ocrTask);

        try {
            // Async OCR Detection
            const blocks = await textDetectionService.detectText(frame.path, this.config.script);

            // Check if task was cancelled while processing
            if (ocrTask.cancelled) {
                console.log('RealtimePipeline: OCR task cancelled mid-process');
                return;
            }

            this.stats.ocrCompleted++;
            this.cleanupTask(ocrTask, this.pendingOCRTasks);

            // If no text detected, skip translation
            if (!blocks || blocks.length === 0) {
                return;
            }

            // Move to translation stage (async, non-blocking)
            this.processTranslation(blocks, frame.timestamp);

        } catch (error) {
            this.stats.errors++;
            console.error('RealtimePipeline: OCR error', error);
            this.cleanupTask(ocrTask, this.pendingOCRTasks);
        }
    }

    /**
     * Process translation: Stage 2 - Translation (async, fire-and-forget)
     */
    private async processTranslation(blocks: TextBlock[], timestamp: number): Promise<void> {
        // Cancel oldest pending translation if exceeding limit
        const activeTranslationTasks = this.pendingTranslationTasks.filter(t => !t.cancelled);
        if (activeTranslationTasks.length >= (this.config.maxPendingTranslation || 2)) {
            const oldestTask = activeTranslationTasks[0];
            if (oldestTask) {
                oldestTask.cancelled = true;
                console.log('RealtimePipeline: Dropped old translation task (queue full)');
            }
        }

        // Create new translation task
        const translationTask: PendingTranslationTask = {
            blocks,
            timestamp,
            cancelled: false,
        };
        this.pendingTranslationTasks.push(translationTask);

        try {
            // Prepare batch items for translation
            const itemsToTranslate = blocks.map((block, index) => ({
                id: `block_${index}`,
                text: block.text,
            }));

            // Async translation (non-blocking)
            const response = await TranslationManager.translate({
                text: '',
                items: itemsToTranslate,
                sourceLanguage: this.config.sourceLanguage === 'auto' ? undefined : this.config.sourceLanguage,
                targetLanguage: this.config.targetLanguage,
                strategy: 'MLKIT', // Force MLKIT for realtime speed
                saveHistory: false,
            });

            // Check if task was cancelled
            if (translationTask.cancelled) {
                console.log('RealtimePipeline: Translation task cancelled mid-process');
                return;
            }

            // Check if a newer translation has already completed
            const newerCompleted = this.pendingTranslationTasks.some(
                t => !t.cancelled && t.timestamp > translationTask.timestamp
            );
            if (newerCompleted) {
                console.log('RealtimePipeline: Skipping overlay update (newer translation available)');
                this.cleanupTask(translationTask, this.pendingTranslationTasks);
                return;
            }

            this.stats.translationsCompleted++;
            this.cleanupTask(translationTask, this.pendingTranslationTasks);

            // Map translations back to blocks
            const translatedBlocks = blocks.map((block, index) => {
                const translation = response.results?.find(r => r.id === `block_${index}`);
                return {
                    ...block,
                    text: translation ? translation.t : block.text,
                };
            });

            // Update overlay (async, fire-and-forget)
            this.updateOverlay(translatedBlocks);

        } catch (error) {
            this.stats.errors++;
            console.error('RealtimePipeline: Translation error', error);
            this.cleanupTask(translationTask, this.pendingTranslationTasks);

            // Fallback: Show original text if translation fails
            this.updateOverlay(blocks);
        }
    }

    /**
     * Update overlay: Stage 3 - Display (async)
     */
    private async updateOverlay(blocks: TextBlock[]): Promise<void> {
        try {
            console.log(`RealtimePipeline: Updating overlay with ${blocks.length} blocks`);
            await overlayService.start(JSON.stringify(blocks));
            this.stats.overlayUpdates++;
        } catch (error) {
            this.stats.errors++;
            console.error('RealtimePipeline: Overlay error', error);
        }
    }

    /**
     * Cancel all pending tasks
     */
    private cancelAllPendingTasks(): void {
        this.pendingOCRTasks.forEach(t => t.cancelled = true);
        this.pendingTranslationTasks.forEach(t => t.cancelled = true);
        this.pendingOCRTasks = [];
        this.pendingTranslationTasks = [];
    }

    /**
     * Remove a task from its queue
     */
    private cleanupTask<T>(task: T, queue: T[]): void {
        const index = queue.indexOf(task);
        if (index > -1) {
            queue.splice(index, 1);
        }
    }

    /**
     * Reset statistics
     */
    private resetStats(): void {
        this.stats = {
            framesReceived: 0,
            framesDropped: 0,
            ocrCompleted: 0,
            translationsCompleted: 0,
            overlayUpdates: 0,
            errors: 0,
        };
    }
}

export const realtimePipelineService = new RealtimePipelineService();
export default realtimePipelineService;
