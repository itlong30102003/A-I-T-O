/**
 * SelectionPipelineService - Handles word/paragraph selection translation
 * 
 * Workflow:
 * 1. User activates selection mode (WORD or PARAGRAPH)
 * 2. User taps/selects region on screen
 * 3. Service captures current screen, crops region, runs OCR
 * 4. Translates detected text using MLKit
 * 5. Shows result in popup
 * 6. Saves to history
 */

import { selectionModeService, WordTapEvent, ParagraphSelectEvent } from './SelectionModeService';
import { screenCaptureService } from './ScreenCaptureService';
import textDetectionService, { ScriptType } from './TextDetectionService';
import TranslationManager from './TranslationManager';

export interface SelectionConfig {
    sourceLanguage: string;
    targetLanguage: string;
    script?: ScriptType;
    wordCropWidth?: number;  // Width of crop area for WORD mode (default: 200)
    wordCropHeight?: number; // Height of crop area for WORD mode (default: 100)
}

type SelectionMode = 'WORD' | 'PARAGRAPH';
type PipelineStatus = 'idle' | 'active' | 'processing';

class SelectionPipelineService {
    private mode: SelectionMode = 'WORD';
    private status: PipelineStatus = 'idle';
    private config: SelectionConfig = {
        sourceLanguage: 'auto',
        targetLanguage: 'vi',
        script: 'latin',
        wordCropWidth: 200,
        wordCropHeight: 100,
    };

    // Subscriptions
    private unsubWordTapped: (() => void) | null = null;
    private unsubParagraphSelected: (() => void) | null = null;
    private unsubSelectionCancelled: (() => void) | null = null;
    private unsubPopupDismissed: (() => void) | null = null;
    private unsubOverlayToggled: (() => void) | null = null;

    // Stats
    private stats = {
        selectionsProcessed: 0,
        translationsCompleted: 0,
        errors: 0,
    };

    /**
     * Start selection mode
     */
    start(mode: SelectionMode, config: Partial<SelectionConfig>): void {
        if (this.status !== 'idle') {
            console.log('[SELECTION] Already active, updating config');
            this.config = { ...this.config, ...config };
            this.mode = mode;
            selectionModeService.setSelectionType(mode);
            return;
        }

        this.mode = mode;
        this.config = { ...this.config, ...config };
        this.status = 'active';
        this.stats = { selectionsProcessed: 0, translationsCompleted: 0, errors: 0 };

        console.log(`[SELECTION] ▶️ Started (Mode: ${mode}, Lang: ${this.config.sourceLanguage} → ${this.config.targetLanguage})`);

        // Subscribe to selection events
        this.subscribeToEvents();

        // Start selection mode service (overlay starts hidden, user toggles with logo)
        selectionModeService.start(mode);
    }

    /**
     * Stop selection mode
     */
    stop(): void {
        this.status = 'idle';

        // Unsubscribe from events
        this.unsubscribeFromEvents();

        // Stop selection mode service
        selectionModeService.stop();

        console.log(`[SELECTION] ⏹️ Stopped (Stats: ${this.stats.selectionsProcessed} processed, ${this.stats.translationsCompleted} translated, ${this.stats.errors} errors)`);
    }

    /**
     * Update configuration (can be called while active)
     */
    updateConfig(config: Partial<SelectionConfig>): void {
        this.config = { ...this.config, ...config };
        console.log(`[SELECTION] Config updated: ${JSON.stringify(config)}`);
    }

    /**
     * Switch between WORD and PARAGRAPH mode
     */
    switchMode(mode: SelectionMode): void {
        this.mode = mode;
        if (this.status === 'active') {
            selectionModeService.setSelectionType(mode);
        }
        console.log(`[SELECTION] Mode switched to: ${mode}`);
    }

    /**
     * Toggle selection overlay visibility (called when user taps logo)
     */
    toggleOverlay(): void {
        if (this.status !== 'idle') {
            selectionModeService.toggleOverlay();
        }
    }

    private subscribeToEvents(): void {
        this.unsubWordTapped = selectionModeService.onWordTapped(this.handleWordTapped);
        this.unsubParagraphSelected = selectionModeService.onParagraphSelected(this.handleParagraphSelected);
        this.unsubSelectionCancelled = selectionModeService.onSelectionCancelled(this.handleSelectionCancelled);
        this.unsubPopupDismissed = selectionModeService.onPopupDismissed(this.handlePopupDismissed);
        this.unsubOverlayToggled = selectionModeService.onOverlayToggled((event) => {
            console.log(`[SELECTION] Overlay toggled: ${event.isVisible ? 'ON' : 'OFF'}`);
        });
    }

    private unsubscribeFromEvents(): void {
        if (this.unsubWordTapped) this.unsubWordTapped();
        if (this.unsubParagraphSelected) this.unsubParagraphSelected();
        if (this.unsubSelectionCancelled) this.unsubSelectionCancelled();
        if (this.unsubPopupDismissed) this.unsubPopupDismissed();
        if (this.unsubOverlayToggled) this.unsubOverlayToggled();

        this.unsubWordTapped = null;
        this.unsubParagraphSelected = null;
        this.unsubSelectionCancelled = null;
        this.unsubPopupDismissed = null;
        this.unsubOverlayToggled = null;
    }

    /**
     * Handle word tap event
     */
    private handleWordTapped = async (event: WordTapEvent): Promise<void> => {
        if (this.status === 'processing') {
            console.log('[SELECTION] Already processing, ignoring tap');
            return;
        }

        this.status = 'processing';
        this.stats.selectionsProcessed++;
        const { x, y } = event;

        console.log(`[SELECTION] 👆 Word tapped at (${x}, ${y})`);

        try {
            // 1. Capture current screen
            console.log('[SELECTION] 📸 Capturing screen...');
            const latestFrame = screenCaptureService.state.latestFrame;
            if (!latestFrame) {
                throw new Error('No screen capture available');
            }

            // 2. Calculate crop region around tap point
            const cropWidth = this.config.wordCropWidth || 200;
            const cropHeight = this.config.wordCropHeight || 100;
            const cropX = Math.max(0, x - cropWidth / 2);
            const cropY = Math.max(0, y - cropHeight / 2);

            console.log(`[SELECTION] ✂️ Cropping region: (${cropX}, ${cropY}) ${cropWidth}x${cropHeight}`);

            // 3. Run OCR on the entire frame (we'll filter by position)
            console.log('[SELECTION] 🔍 Running OCR...');
            const blocks = await textDetectionService.detectText(latestFrame.path, this.config.script || 'latin');

            if (!blocks || blocks.length === 0) {
                console.log('[SELECTION] 📭 No text detected');
                selectionModeService.showResultPopup('', 'Không tìm thấy văn bản tại vị trí này', x, y);
                return;
            }

            // 4. Find text block closest to tap position
            const tappedText = this.findTextAtPosition(blocks, x, y);

            if (!tappedText) {
                console.log('[SELECTION] 📭 No text at tap position');
                selectionModeService.showResultPopup('', 'Không tìm thấy văn bản tại vị trí này', x, y);
                return;
            }

            console.log(`[SELECTION] 📝 Found text: "${tappedText.substring(0, 50)}..."`);

            // 5. Translate
            console.log('[SELECTION] 🌐 Translating...');
            const response = await TranslationManager.translate({
                items: [{ id: '0', text: tappedText }],
                sourceLanguage: this.config.sourceLanguage === 'auto' ? undefined : this.config.sourceLanguage,
                targetLanguage: this.config.targetLanguage,
                strategy: 'MLKIT',
                saveHistory: false, // Disabled temporarily
            });

            const translatedText = response.results?.[0]?.t || 'Không thể dịch';
            this.stats.translationsCompleted++;

            console.log(`[SELECTION] ✅ Translation: "${translatedText.substring(0, 50)}..."`);

            // 6. Show popup
            selectionModeService.showResultPopup(tappedText, translatedText, x, y);

        } catch (error) {
            this.stats.errors++;
            console.error('[SELECTION] ❌ Error:', error);
            selectionModeService.showResultPopup('', `Lỗi: ${(error as Error).message}`, x, y);
        } finally {
            // Stay in processing state until popup is dismissed
        }
    };

    /**
     * Handle paragraph selection event
     */
    private handleParagraphSelected = async (event: ParagraphSelectEvent): Promise<void> => {
        if (this.status === 'processing') {
            console.log('[SELECTION] Already processing, ignoring selection');
            return;
        }

        this.status = 'processing';
        this.stats.selectionsProcessed++;
        const { x, y, width, height } = event;

        console.log(`[SELECTION] 📦 Paragraph selected: (${x}, ${y}) ${width}x${height}`);

        try {
            // 1. Get latest frame
            const latestFrame = screenCaptureService.state.latestFrame;
            if (!latestFrame) {
                throw new Error('No screen capture available');
            }

            // 2. Run OCR on entire frame
            console.log('[SELECTION] 🔍 Running OCR...');
            const blocks = await textDetectionService.detectText(latestFrame.path, this.config.script || 'latin');

            if (!blocks || blocks.length === 0) {
                console.log('[SELECTION] 📭 No text detected');
                selectionModeService.showResultPopup('', 'Không tìm thấy văn bản trong vùng chọn', x + width / 2, y);
                return;
            }

            // 3. Filter blocks that intersect with selection
            const selectedBlocks = this.findBlocksInRegion(blocks, x, y, width, height);

            if (selectedBlocks.length === 0) {
                console.log('[SELECTION] 📭 No text in selected region');
                selectionModeService.showResultPopup('', 'Không tìm thấy văn bản trong vùng chọn', x + width / 2, y);
                return;
            }

            // 4. Combine all text
            const combinedText = selectedBlocks.map(b => b.text).join(' ');
            console.log(`[SELECTION] 📝 Selected text (${selectedBlocks.length} blocks): "${combinedText.substring(0, 100)}..."`);

            // 5. Translate
            console.log('[SELECTION] 🌐 Translating...');
            const response = await TranslationManager.translate({
                items: [{ id: '0', text: combinedText }],
                sourceLanguage: this.config.sourceLanguage === 'auto' ? undefined : this.config.sourceLanguage,
                targetLanguage: this.config.targetLanguage,
                strategy: 'MLKIT',
                saveHistory: false, // Disabled temporarily
            });

            const translatedText = response.results?.[0]?.t || 'Không thể dịch';
            this.stats.translationsCompleted++;

            console.log(`[SELECTION] ✅ Translation: "${translatedText.substring(0, 100)}..."`);

            // 6. Show popup at center of selection
            selectionModeService.showResultPopup(combinedText, translatedText, x + width / 2, y);

        } catch (error) {
            this.stats.errors++;
            console.error('[SELECTION] ❌ Error:', error);
            selectionModeService.showResultPopup('', `Lỗi: ${(error as Error).message}`, x + width / 2, y);
        }
    };

    /**
     * Handle selection cancelled
     */
    private handleSelectionCancelled = (): void => {
        console.log('[SELECTION] Selection cancelled');
        this.status = 'active';
    };

    /**
     * Handle popup dismissed
     */
    private handlePopupDismissed = (): void => {
        console.log('[SELECTION] Popup dismissed, ready for next selection');
        this.status = 'active';
    };

    /**
     * Find text block at given position
     */
    private findTextAtPosition(blocks: Array<{ text: string; boundingBox: any }>, x: number, y: number): string | null {
        // Find block that contains the tap point
        for (const block of blocks) {
            const bbox = block.boundingBox;
            if (x >= bbox.x && x <= bbox.x + bbox.width &&
                y >= bbox.y && y <= bbox.y + bbox.height) {
                return block.text;
            }
        }

        // If no direct hit, find closest block within reasonable distance
        let closestBlock = null;
        let closestDistance = Infinity;
        const maxDistance = 100; // Maximum pixel distance to consider

        for (const block of blocks) {
            const bbox = block.boundingBox;
            const centerX = bbox.x + bbox.width / 2;
            const centerY = bbox.y + bbox.height / 2;
            const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));

            if (distance < closestDistance && distance < maxDistance) {
                closestDistance = distance;
                closestBlock = block;
            }
        }

        return closestBlock?.text || null;
    }

    /**
     * Find blocks that intersect with selection region
     */
    private findBlocksInRegion(
        blocks: Array<{ text: string; boundingBox: any }>,
        x: number,
        y: number,
        width: number,
        height: number
    ): Array<{ text: string; boundingBox: any }> {
        const selectionRight = x + width;
        const selectionBottom = y + height;

        return blocks.filter(block => {
            const bbox = block.boundingBox;
            const blockRight = bbox.x + bbox.width;
            const blockBottom = bbox.y + bbox.height;

            // Check if rectangles intersect
            return !(bbox.x > selectionRight ||
                blockRight < x ||
                bbox.y > selectionBottom ||
                blockBottom < y);
        });
    }

    // Getters
    get currentStatus(): PipelineStatus {
        return this.status;
    }

    get currentMode(): SelectionMode {
        return this.mode;
    }

    get currentStats() {
        return { ...this.stats };
    }
}

export const selectionPipelineService = new SelectionPipelineService();
export default selectionPipelineService;
