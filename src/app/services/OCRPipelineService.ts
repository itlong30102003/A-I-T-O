import { screenCaptureService } from './ScreenCaptureService';
import textDetectionService, { TextBlock, ScriptType } from './TextDetectionService';

export interface OCRResult {
    blocks: TextBlock[];
    imagePath: string;
    timestamp: number;
}

export type OCRCallback = (result: OCRResult) => void;

class OCRPipelineService {
    private isProcessing = false;
    private currentScript: ScriptType = 'latin';
    private ocrCallbacks: OCRCallback[] = [];
    private frameUnsubscribe: (() => void) | null = null;

    /**
     * Start the OCR pipeline
     */
    start(script: ScriptType = 'latin') {
        this.currentScript = script;

        if (this.frameUnsubscribe) {
            this.frameUnsubscribe();
        }

        this.frameUnsubscribe = screenCaptureService.onFrame(async (frame) => {
            if (this.isProcessing) return; // Skip frame if still processing

            this.isProcessing = true;
            try {
                const blocks = await textDetectionService.detectText(frame.path, this.currentScript);

                this.notifyOCRCallbacks({
                    blocks,
                    imagePath: frame.path,
                    timestamp: frame.timestamp
                });
            } catch (error) {
                console.error('OCRPipelineService detection error:', error);
            } finally {
                this.isProcessing = false;
            }
        });
    }

    /**
     * Stop the OCR pipeline
     */
    stop() {
        if (this.frameUnsubscribe) {
            this.frameUnsubscribe();
            this.frameUnsubscribe = null;
        }
        this.isProcessing = false;
    }

    /**
     * Set the recognition script
     */
    setScript(script: ScriptType) {
        this.currentScript = script;
    }

    /**
     * Subscribe to OCR results
     */
    onResult(callback: OCRCallback): () => void {
        this.ocrCallbacks.push(callback);
        return () => {
            const index = this.ocrCallbacks.indexOf(callback);
            if (index > -1) this.ocrCallbacks.splice(index, 1);
        };
    }

    private notifyOCRCallbacks(result: OCRResult) {
        this.ocrCallbacks.forEach(cb => cb(result));
    }
}

export const ocrPipelineService = new OCRPipelineService();
export default ocrPipelineService;