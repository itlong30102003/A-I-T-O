import { NativeModules } from 'react-native';

const { TextDetectionModule } = NativeModules;

export type ScriptType = 'latin' | 'chinese' | 'japanese' | 'korean';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextElement {
  text: string;
  boundingBox: BoundingBox;
}

export interface TextLine {
  text: string;
  boundingBox: BoundingBox;
  elements: TextElement[];
}

export interface TextBlock {
  text: string;
  boundingBox: BoundingBox;
  lines: TextLine[];
  fontSize?: number;   // Estimated original font size (px)
  bgColor?: string;    // Dominant background color (hex "#RRGGBB")
}

export interface DetectionResult {
  blocks: TextBlock[];
}

class TextDetectionService {
  /**
   * Detect text from an image file
   * @param imagePath Path to the image file on device
   * @param script Script type to use ('latin', 'chinese', 'japanese', 'korean')
   */
  async detectText(imagePath: string, script: ScriptType = 'latin'): Promise<TextBlock[]> {
    try {
      const result: DetectionResult = await TextDetectionModule.detectText(imagePath, script);
      return result.blocks;
    } catch (error) {
      console.error('TextDetectionService.detectText error:', error);
      throw error;
    }
  }
}

export default new TextDetectionService();
