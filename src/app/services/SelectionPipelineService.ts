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
import textDetectionService, { ScriptType, TextBlock, TextElement, BoundingBox } from './TextDetectionService';
import TranslationManager from './TranslationManager';

// Result from Element-level hit testing
interface ElementHitResult {
    text: string;
    boundingBox: BoundingBox;
}

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
    private unsubSelectionStarted: (() => void) | null = null;

    // Pre-scan cache for WORD mode
    private cachedBlocks: TextBlock[] | null = null;
    private isScanning: boolean = false;

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
     * Update strictly the mode to sync UI without disrupting the config
     */
    setSelectionType(mode: SelectionMode): void {
        this.mode = mode;
        if (this.status === 'active') {
            selectionModeService.setSelectionType(mode);
        }
        console.log(`[SELECTION] Selection type set to: ${mode}`);
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
     * For WORD mode: Runs pre-scan OCR and draws bounding boxes
     */
    async toggleOverlay(): Promise<void> {
        if (this.status === 'idle') return;

        // Check if overlay is currently visible
        const isVisible = await selectionModeService.isOverlayVisible();

        if (isVisible) {
            console.log('[SELECTION] 🔄 Resetting selection mode via Logo click');
            // Hide overlay and clear everything
            selectionModeService.hideOverlay();
            selectionModeService.hideResultPopup();
            selectionModeService.hideTextHighlight();
            selectionModeService.clearDetectedBoxes();
            this.cachedBlocks = null;
            this.status = 'active';
            return;
        }

        // For WORD mode: Run pre-scan OCR before showing overlay
        if (this.mode === 'WORD') {
            await this.performPreScan();
        } else {
            // PARAGRAPH mode: Just show overlay directly
            selectionModeService.showOverlay();
        }
    }

    /**
     * Pre-scan: Capture screen, run OCR, draw detected boxes
     */
    private async performPreScan(): Promise<void> {
        if (this.isScanning) {
            console.log('[SELECTION] Pre-scan already in progress');
            return;
        }

        this.isScanning = true;
        console.log('[SELECTION] 🔍 Starting pre-scan...');

        try {
            // Show overlay with "scanning" message (no boxes yet)
            selectionModeService.showOverlay();

            // 1. Get latest frame
            const latestFrame = screenCaptureService.state.latestFrame;
            if (!latestFrame) {
                throw new Error('No screen capture available');
            }

            // 2. Run OCR to get all text blocks
            console.log('[SELECTION] 📸 Running OCR on captured frame...');
            const blocks = await textDetectionService.detectText(
                latestFrame.path,
                this.config.script || 'latin'
            );

            if (!blocks || blocks.length === 0) {
                console.log('[SELECTION] 📭 No text detected');
                selectionModeService.hideOverlay();
                selectionModeService.showResultPopup('', 'Không tìm thấy văn bản trên màn hình', 0, 0);
                this.cachedBlocks = null;
                this.isScanning = false;
                return;
            }

            // 3. Cache the blocks for tap handling
            this.cachedBlocks = blocks;

            // 4. Extract all Element bounding boxes for drawing
            const boxes: Array<{ x: number; y: number; width: number; height: number }> = [];
            for (const block of blocks) {
                for (const line of block.lines) {
                    for (const element of line.elements) {
                        boxes.push({
                            x: element.boundingBox.x,
                            y: element.boundingBox.y,
                            width: element.boundingBox.width,
                            height: element.boundingBox.height,
                        });
                    }
                }
            }

            console.log(`[SELECTION] ✅ Pre-scan complete: ${boxes.length} elements detected`);

            // 5. Draw boxes on overlay
            selectionModeService.drawDetectedBoxes(boxes);

        } catch (error) {
            console.error('[SELECTION] ❌ Pre-scan error:', error);
            selectionModeService.hideOverlay();
            selectionModeService.showResultPopup('', `Lỗi quét: ${(error as Error).message}`, 0, 0);
            this.cachedBlocks = null;
        } finally {
            this.isScanning = false;
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
        this.unsubSelectionStarted = selectionModeService.onSelectionStarted(this.handleSelectionStarted);
    }

    private unsubscribeFromEvents(): void {
        if (this.unsubWordTapped) this.unsubWordTapped();
        if (this.unsubParagraphSelected) this.unsubParagraphSelected();
        if (this.unsubSelectionCancelled) this.unsubSelectionCancelled();
        if (this.unsubPopupDismissed) this.unsubPopupDismissed();
        if (this.unsubOverlayToggled) this.unsubOverlayToggled();
        if (this.unsubSelectionStarted) this.unsubSelectionStarted();

        this.unsubWordTapped = null;
        this.unsubParagraphSelected = null;
        this.unsubSelectionCancelled = null;
        this.unsubPopupDismissed = null;
        this.unsubOverlayToggled = null;
        this.unsubSelectionStarted = null;
    }

    /**
     * Handle word tap event
     * Uses cached OCR results from pre-scan (no new OCR call needed)
     */
    private handleWordTapped = async (event: WordTapEvent): Promise<void> => {
        if (this.status === 'processing') {
            console.log('[SELECTION] Already processing, ignoring tap');
            return;
        }

        this.status = 'processing';
        this.stats.selectionsProcessed++;

        // Hide overlay and clear boxes immediately
        selectionModeService.hideOverlay();
        selectionModeService.clearDetectedBoxes();
        console.log('[SELECTION] Overlay hidden after tap');

        const { x, y } = event;

        console.log(`[SELECTION] 👆 Word tapped at (${x}, ${y})`);

        // Show loading indicator immediately at tap position
        selectionModeService.showLoadingAt(x, y);

        try {
            // Use cached blocks from pre-scan (no new OCR needed!)
            if (!this.cachedBlocks || this.cachedBlocks.length === 0) {
                console.log('[SELECTION] ⚠️ No cached blocks, tap ignored');
                selectionModeService.hideLoading();
                selectionModeService.showResultPopup('', 'Vui lòng quét lại màn hình', x, y);
                this.status = 'active';
                return;
            }

            console.log(`[SELECTION] 🔍 Using cached OCR results (${this.cachedBlocks.length} blocks)`);

            // Find Element at tap position using Block → Line → Element hierarchy
            const hitResult = this.findElementAtPosition(this.cachedBlocks, x, y);

            if (!hitResult) {
                console.log('[SELECTION] 📭 No text at tap position');
                selectionModeService.hideLoading();
                selectionModeService.showResultPopup('', 'Không tìm thấy văn bản tại vị trí này', x, y);
                this.status = 'active';
                return;
            }

            console.log(`[SELECTION] 📝 Found text: "${hitResult.text}"`);

            // Hide loading and show highlight on detected text bbox
            selectionModeService.hideLoading();
            const bbox = hitResult.boundingBox;
            selectionModeService.showTextHighlight(bbox.x, bbox.y, bbox.width, bbox.height);

            // Translate
            console.log('[SELECTION] 🌐 Translating...');
            const response = await TranslationManager.translate({
                items: [{ id: '0', text: hitResult.text }],
                sourceLanguage: this.config.sourceLanguage === 'auto' ? undefined : this.config.sourceLanguage,
                targetLanguage: this.config.targetLanguage,
                strategy: 'MLKIT',
                saveHistory: true,
                selectionMode: 'WORD',
            });

            const translatedText = response.results?.[0]?.t || 'Không thể dịch';
            this.stats.translationsCompleted++;

            console.log(`[SELECTION] ✅ Translation: "${translatedText}"`);

            // Show popup (highlight remains visible until popup is dismissed)
            selectionModeService.showResultPopup(hitResult.text, translatedText, x, y);

            // Clear cache after successful translation
            this.cachedBlocks = null;

        } catch (error) {
            this.stats.errors++;
            console.error('[SELECTION] ❌ Error:', error);
            selectionModeService.hideLoading();
            selectionModeService.hideTextHighlight();
            selectionModeService.showResultPopup('', `Lỗi: ${(error as Error).message}`, x, y);
        } finally {
            this.status = 'active';
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

        // Native side automatically hides overlay and shows Loading Indicator
        // We just need to process and show result

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
                selectionModeService.hideLoading();
                selectionModeService.showResultPopup('', 'Không tìm thấy văn bản trong vùng chọn', x + width / 2, y);
                return;
            }

            // 3. Smart Snap: Calculate snapped rectangle that perfectly bounds all intersecting lines
            const snappedRect = this.calculateSmartSnap({ x, y, width, height }, blocks, 10);
            console.log(`[SELECTION] 📐 Smart snap calculated: (${snappedRect.x}, ${snappedRect.y}) ${snappedRect.width}x${snappedRect.height}`);

            // 4. Update overlay with snapped highlight (Use TextHighlightView now)
            // Use showTextHighlight instead of updateSelectionHighlight
            selectionModeService.showTextHighlight(
                snappedRect.x,
                snappedRect.y,
                snappedRect.width,
                snappedRect.height
            );

            // 5. Filter blocks that intersect with snapped selection
            const selectedBlocks = this.findBlocksInRegion(blocks, snappedRect.x, snappedRect.y, snappedRect.width, snappedRect.height);

            if (selectedBlocks.length === 0) {
                console.log('[SELECTION] 📭 No text in selected region');
                selectionModeService.hideLoading();
                selectionModeService.showResultPopup('', 'Không tìm thấy văn bản trong vùng chọn', x + width / 2, y);
                return;
            }

            // 6. Combine all text
            const combinedText = selectedBlocks.map(b => b.text).join(' ');
            console.log(`[SELECTION] 📝 Selected text (${selectedBlocks.length} blocks): "${combinedText.substring(0, 100)}..."`);

            // 7. Translate
            console.log('[SELECTION] 🌐 Translating...');
            const response = await TranslationManager.translate({
                items: [{ id: '0', text: combinedText }],
                sourceLanguage: this.config.sourceLanguage === 'auto' ? undefined : this.config.sourceLanguage,
                targetLanguage: this.config.targetLanguage,
                strategy: 'MLKIT',
                saveHistory: true,
                selectionMode: 'PARAGRAPH',
            });

            const translatedText = response.results?.[0]?.t || 'Không thể dịch';
            this.stats.translationsCompleted++;

            console.log(`[SELECTION] ✅ Translation: "${translatedText.substring(0, 100)}..."`);

            // 8. Hide Loading & Show popup at center of selection
            selectionModeService.hideLoading();
            selectionModeService.showResultPopup(combinedText, translatedText, x + width / 2, y);

        } catch (error) {
            this.stats.errors++;
            console.error('[SELECTION] ❌ Error:', error);
            selectionModeService.hideLoading();
            selectionModeService.showResultPopup('', `Lỗi: ${(error as Error).message}`, x + width / 2, y);
        } finally {
            this.status = 'active';
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
        // Hide text highlight when popup is dismissed
        selectionModeService.hideTextHighlight();
        this.status = 'active';
    };

    /**
     * Handle selection started (for PARAGRAPH mode redraw mechanism)
     */
    private handleSelectionStarted = (): void => {
        console.log('[SELECTION] Selection started, hiding popup for redraw');
        // Hide popup immediately when user starts drawing new selection
        selectionModeService.hideResultPopup();
    };

    /**
     * Find Element at given position using Block → Line → Element hierarchy
     * Uses padding for better UX and nearest neighbor fallback
     */
    private findElementAtPosition(blocks: TextBlock[], x: number, y: number): ElementHitResult | null {
        const PADDING = 10; // Padding to make small text easier to tap
        const MAX_DISTANCE = 50; // Maximum distance for nearest neighbor fallback

        // Helper to check if point is in rect with optional padding
        const isPointInRect = (px: number, py: number, bbox: BoundingBox, padding: number = 0): boolean => {
            return px >= bbox.x - padding && px <= bbox.x + bbox.width + padding &&
                py >= bbox.y - padding && py <= bbox.y + bbox.height + padding;
        };

        // Helper to calculate distance from point to rect center
        const distanceToRect = (px: number, py: number, bbox: BoundingBox): number => {
            const centerX = bbox.x + bbox.width / 2;
            const centerY = bbox.y + bbox.height / 2;
            return Math.sqrt(Math.pow(px - centerX, 2) + Math.pow(py - centerY, 2));
        };

        let nearestElement: ElementHitResult | null = null;
        let nearestDistance = Infinity;

        // 1. Traverse Block → Line → Element hierarchy
        for (const block of blocks) {
            // Optimization: Skip if tap is not even close to block
            if (!isPointInRect(x, y, block.boundingBox, PADDING * 2)) continue;

            for (const line of block.lines) {
                // Optimization: Skip if tap is not in line
                if (!isPointInRect(x, y, line.boundingBox, PADDING)) continue;

                // Check each Element (word) in the line
                for (const element of line.elements) {
                    // Direct hit with padding
                    if (isPointInRect(x, y, element.boundingBox, PADDING)) {
                        return {
                            text: element.text,
                            boundingBox: element.boundingBox
                        };
                    }

                    // Track nearest for fallback
                    const distance = distanceToRect(x, y, element.boundingBox);
                    if (distance < nearestDistance && distance < MAX_DISTANCE) {
                        nearestDistance = distance;
                        nearestElement = {
                            text: element.text,
                            boundingBox: element.boundingBox
                        };
                    }
                }
            }
        }

        // Fallback to nearest element if no direct hit
        return nearestElement;
    }

    /**
     * @deprecated Use findElementAtPosition instead
     * Find text block at given position (legacy method for backward compatibility)
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

    /**
     * Calculate smart snap bounding box from user's rough selection
     * Finds all lines that intersect with user rect and creates tight bbox around them
     */
    private calculateSmartSnap(
        userRect: { x: number; y: number; width: number; height: number },
        ocrBlocks: TextBlock[],
        padding: number = 10
    ): { x: number; y: number; width: number; height: number } {
        let minX = Number.MAX_VALUE;
        let minY = Number.MAX_VALUE;
        let maxX = Number.MIN_VALUE;
        let maxY = Number.MIN_VALUE;
        let hasIntersection = false;

        // Helper to check if two rectangles intersect
        const isIntersecting = (r1: BoundingBox, r2: BoundingBox): boolean => {
            const r1Right = r1.x + r1.width;
            const r1Bottom = r1.y + r1.height;
            const r2Right = r2.x + r2.width;
            const r2Bottom = r2.y + r2.height;

            return !(r2.x > r1Right || r2Right < r1.x || r2.y > r1Bottom || r2Bottom < r1.y);
        };

        const userBBox: BoundingBox = {
            x: userRect.x,
            y: userRect.y,
            width: userRect.width,
            height: userRect.height
        };

        // Iterate through OCR blocks and lines to find intersections
        for (const block of ocrBlocks) {
            for (const line of block.lines) {
                if (isIntersecting(userBBox, line.boundingBox)) {
                    hasIntersection = true;
                    const lineBBox = line.boundingBox;
                    minX = Math.min(minX, lineBBox.x);
                    minY = Math.min(minY, lineBBox.y);
                    maxX = Math.max(maxX, lineBBox.x + lineBBox.width);
                    maxY = Math.max(maxY, lineBBox.y + lineBBox.height);
                }
            }
        }

        // If no text found, return original user rect
        if (!hasIntersection) {
            console.log('[SELECTION] Smart snap: No text found, using original rect');
            return userRect;
        }

        // Return snapped rect with padding
        const snappedRect = {
            x: Math.max(0, minX - padding),
            y: Math.max(0, minY - padding),
            width: (maxX - minX) + (padding * 2),
            height: (maxY - minY) + (padding * 2)
        };

        console.log(`[SELECTION] Smart snap: user=${JSON.stringify(userRect)} → snapped=${JSON.stringify(snappedRect)}`);
        return snappedRect;
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
