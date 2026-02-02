/**
 * TypeScript type definitions for TextRecognitionModule
 */

export interface BoundingBox {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
}

export interface Corner {
    x: number;
    y: number;
}

export interface TextBlock {
    text: string;
    boundingBox: BoundingBox;
    corners?: Corner[];
}

export interface OCRResult {
    blocks: TextBlock[];
    frameWidth: number;
    frameHeight: number;
}

export interface TextRecognitionModule {
    /**
     * Process an image file and return detected text with bounding boxes
     * 
     * @param imagePath - Absolute path to image file (from takePhoto)
     * @returns Promise resolving to OCR result with text blocks and dimensions
     * @throws Error if file not found or OCR fails
     */
    processImage(imagePath: string): Promise<OCRResult>;
}

declare module 'react-native' {
    interface NativeModulesStatic {
        TextRecognitionModule: TextRecognitionModule;
    }
}
