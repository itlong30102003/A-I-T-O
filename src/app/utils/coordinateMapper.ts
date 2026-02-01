/**
 * Coordinate Mapper Utility
 * Maps coordinates from camera frame space to screen space
 * 
 * This is critical for AR overlay because:
 * - Camera frame (e.g., 1080x1920) ≠ Screen size
 * - resizeMode="cover" adds offset and scaling
 * - Android/iOS have different coordinate systems
 */

export interface BoundingBox {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
}

export interface ScreenBoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface FrameDimensions {
    width: number;
    height: number;
}

export interface ScreenDimensions {
    width: number;
    height: number;
}

export interface MappingConfig {
    frame: FrameDimensions;
    screen: ScreenDimensions;
    resizeMode: 'cover' | 'contain';
}

/**
 * Creates a coordinate mapper for converting camera frame coordinates to screen coordinates
 */
export function createCoordinateMapper(config: MappingConfig) {
    const { frame, screen, resizeMode } = config;

    // Calculate scale factors
    const scaleX = screen.width / frame.width;
    const scaleY = screen.height / frame.height;

    let scale: number;
    let offsetX = 0;
    let offsetY = 0;

    if (resizeMode === 'cover') {
        // Cover: use the larger scale to fill the screen (some content may be cropped)
        scale = Math.max(scaleX, scaleY);

        // Calculate offset for centering
        const scaledWidth = frame.width * scale;
        const scaledHeight = frame.height * scale;

        offsetX = (screen.width - scaledWidth) / 2;
        offsetY = (screen.height - scaledHeight) / 2;
    } else {
        // Contain: use the smaller scale to fit within screen (letterboxing)
        scale = Math.min(scaleX, scaleY);

        const scaledWidth = frame.width * scale;
        const scaledHeight = frame.height * scale;

        offsetX = (screen.width - scaledWidth) / 2;
        offsetY = (screen.height - scaledHeight) / 2;
    }

    return {
        /**
         * Map a single point from frame space to screen space
         */
        mapPoint: (x: number, y: number): { x: number; y: number } => {
            return {
                x: x * scale + offsetX,
                y: y * scale + offsetY,
            };
        },

        /**
         * Map a bounding box from frame space to screen space
         */
        mapBoundingBox: (box: BoundingBox): ScreenBoundingBox => {
            const screenLeft = box.left * scale + offsetX;
            const screenTop = box.top * scale + offsetY;
            const screenWidth = box.width * scale;
            const screenHeight = box.height * scale;

            return {
                x: screenLeft,
                y: screenTop,
                width: screenWidth,
                height: screenHeight,
            };
        },

        /**
         * Get the current scale factor
         */
        getScale: () => scale,

        /**
         * Get the current offset
         */
        getOffset: () => ({ x: offsetX, y: offsetY }),
    };
}

/**
 * Quick mapping function for one-off conversions
 */
export function mapBoundingBoxToScreen(
    box: BoundingBox,
    frame: FrameDimensions,
    screen: ScreenDimensions,
    resizeMode: 'cover' | 'contain' = 'cover'
): ScreenBoundingBox {
    const mapper = createCoordinateMapper({ frame, screen, resizeMode });
    return mapper.mapBoundingBox(box);
}
