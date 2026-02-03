/**
 * Text Block Tracking and Stabilization
 * 
 * Provides stable tracking of text blocks across camera frames.
 * Uses IoU (Intersection over Union) matching and temporal filtering.
 */

import type { BoundingBox, Corner } from '../services/TextRecognitionModule';

export interface TrackedTextBlock {
    id: string;
    text: string;
    translatedText?: string;
    boundingBox: BoundingBox;
    smoothedBox: BoundingBox;
    corners?: Corner[];
    framesSeen: number;
    lastSeenFrame: number;
    isStable: boolean;
    needsTranslation: boolean;
}

interface RawTextBlock {
    text: string;
    boundingBox: BoundingBox;
    corners?: Corner[];
}

// Configuration
const CONFIG = {
    // Minimum IoU to consider blocks as same
    IOU_THRESHOLD: 0.3,
    // Text similarity threshold (0-1)
    TEXT_SIMILARITY_THRESHOLD: 0.7,
    // Frames required before block is considered stable
    STABILITY_THRESHOLD: 3,
    // Frames before block is removed after disappearing
    MAX_MISSING_FRAMES: 5,
    // Smoothing factor for bounding box (0 = no smooth, 1 = fully smooth)
    SMOOTHING_FACTOR: 0.4,
};

/**
 * Calculate Intersection over Union for two bounding boxes
 */
function calculateIoU(box1: BoundingBox, box2: BoundingBox): number {
    const x1 = Math.max(box1.left, box2.left);
    const y1 = Math.max(box1.top, box2.top);
    const x2 = Math.min(box1.right, box2.right);
    const y2 = Math.min(box1.bottom, box2.bottom);

    const intersectionWidth = Math.max(0, x2 - x1);
    const intersectionHeight = Math.max(0, y2 - y1);
    const intersectionArea = intersectionWidth * intersectionHeight;

    const area1 = box1.width * box1.height;
    const area2 = box2.width * box2.height;
    const unionArea = area1 + area2 - intersectionArea;

    return unionArea > 0 ? intersectionArea / unionArea : 0;
}

/**
 * Calculate text similarity using Levenshtein-like ratio
 */
function textSimilarity(text1: string, text2: string): number {
    if (text1 === text2) return 1;
    if (!text1 || !text2) return 0;

    const longer = text1.length > text2.length ? text1 : text2;
    const shorter = text1.length > text2.length ? text2 : text1;

    if (longer.length === 0) return 1;

    // Simple containment check for partial matches
    if (longer.includes(shorter) || shorter.includes(longer)) {
        return shorter.length / longer.length;
    }

    // Word-level comparison
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    const commonWords = words1.filter(w => words2.includes(w));

    return commonWords.length / Math.max(words1.length, words2.length);
}

/**
 * Smooth bounding box using exponential moving average
 */
function smoothBoundingBox(current: BoundingBox, previous: BoundingBox, factor: number): BoundingBox {
    const smooth = (curr: number, prev: number) =>
        Math.round(prev + (curr - prev) * factor);

    const left = smooth(current.left, previous.left);
    const top = smooth(current.top, previous.top);
    const right = smooth(current.right, previous.right);
    const bottom = smooth(current.bottom, previous.bottom);

    return {
        left,
        top,
        right,
        bottom,
        width: right - left,
        height: bottom - top,
    };
}

/**
 * Generate unique ID for tracking
 */
let idCounter = 0;
function generateId(): string {
    return `block_${++idCounter}_${Date.now()}`;
}

/**
 * TextBlockTracker - Main tracking class
 * 
 * Maintains state across frames and provides stable block IDs
 */
export class TextBlockTracker {
    private trackedBlocks: Map<string, TrackedTextBlock> = new Map();
    private currentFrame: number = 0;

    /**
     * Update tracker with new blocks from OCR
     * Returns list of tracked blocks with stable IDs
     */
    update(newBlocks: RawTextBlock[]): TrackedTextBlock[] {
        this.currentFrame++;

        // Match new blocks to existing tracked blocks
        const matched = new Set<string>();
        const matchedNewIndices = new Set<number>();

        // Sort new blocks by area (larger first) for better matching
        const sortedNewBlocks = newBlocks
            .map((block, index) => ({ block, index }))
            .sort((a, b) =>
                (b.block.boundingBox.width * b.block.boundingBox.height) -
                (a.block.boundingBox.width * a.block.boundingBox.height)
            );

        // Match existing blocks to new blocks
        for (const [id, tracked] of this.trackedBlocks) {
            let bestMatch: { index: number; score: number } | null = null;

            for (const { block: newBlock, index } of sortedNewBlocks) {
                if (matchedNewIndices.has(index)) continue;

                const iou = calculateIoU(tracked.boundingBox, newBlock.boundingBox);
                const textSim = textSimilarity(tracked.text, newBlock.text);

                // Combined score: IoU weighted more heavily
                const score = iou * 0.6 + textSim * 0.4;

                if (score > CONFIG.IOU_THRESHOLD && (!bestMatch || score > bestMatch.score)) {
                    bestMatch = { index, score };
                }
            }

            if (bestMatch) {
                const newBlock = newBlocks[bestMatch.index];

                // Update tracked block
                tracked.boundingBox = newBlock.boundingBox;
                tracked.smoothedBox = smoothBoundingBox(
                    newBlock.boundingBox,
                    tracked.smoothedBox,
                    CONFIG.SMOOTHING_FACTOR
                );
                tracked.corners = newBlock.corners;
                tracked.framesSeen++;
                tracked.lastSeenFrame = this.currentFrame;

                // Check if text changed significantly
                if (textSimilarity(tracked.text, newBlock.text) < 0.9) {
                    tracked.text = newBlock.text;
                    tracked.needsTranslation = true;
                    tracked.translatedText = undefined;
                }

                // Update stability
                tracked.isStable = tracked.framesSeen >= CONFIG.STABILITY_THRESHOLD;

                matched.add(id);
                matchedNewIndices.add(bestMatch.index);
            }
        }

        // Create new tracked blocks for unmatched new blocks
        for (let i = 0; i < newBlocks.length; i++) {
            if (matchedNewIndices.has(i)) continue;

            const newBlock = newBlocks[i];
            const id = generateId();

            this.trackedBlocks.set(id, {
                id,
                text: newBlock.text,
                translatedText: undefined,
                boundingBox: newBlock.boundingBox,
                smoothedBox: { ...newBlock.boundingBox },
                corners: newBlock.corners,
                framesSeen: 1,
                lastSeenFrame: this.currentFrame,
                isStable: false,
                needsTranslation: true,
            });
        }

        // Remove blocks that haven't been seen for too long
        for (const [id, tracked] of this.trackedBlocks) {
            if (this.currentFrame - tracked.lastSeenFrame > CONFIG.MAX_MISSING_FRAMES) {
                this.trackedBlocks.delete(id);
            }
        }

        return Array.from(this.trackedBlocks.values());
    }

    /**
     * Get only stable blocks (seen for enough frames)
     */
    getStableBlocks(): TrackedTextBlock[] {
        return Array.from(this.trackedBlocks.values())
            .filter(block => block.isStable);
    }

    /**
     * Get blocks that need translation
     */
    getBlocksNeedingTranslation(): TrackedTextBlock[] {
        return Array.from(this.trackedBlocks.values())
            .filter(block => block.isStable && block.needsTranslation);
    }

    /**
     * Set translation result for a block
     */
    setTranslation(blockId: string, translatedText: string): void {
        const block = this.trackedBlocks.get(blockId);
        if (block) {
            block.translatedText = translatedText;
            block.needsTranslation = false;
        }
    }

    /**
     * Batch set translations
     */
    setTranslations(translations: Array<{ id: string; translatedText: string }>): void {
        for (const { id, translatedText } of translations) {
            this.setTranslation(id, translatedText);
        }
    }

    /**
     * Clear all tracked blocks
     */
    clear(): void {
        this.trackedBlocks.clear();
        this.currentFrame = 0;
    }

    /**
     * Get current frame number
     */
    getCurrentFrame(): number {
        return this.currentFrame;
    }
}

// Export singleton instance
export const textBlockTracker = new TextBlockTracker();
