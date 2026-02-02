/**
 * LiveTranslationScreen (Simplified Version)
 * 
 * This version uses Vision Camera for preview only.
 * OCR processing is done via a separate native module call.
 * No Frame Processors required (avoids worklets-core dependency).
 */

import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
    StyleSheet,
    View,
    Text,
    Dimensions,
    TouchableOpacity,
    Platform,
    NativeModules,
} from 'react-native';
import {
    Camera,
    useCameraDevice,
    useCameraPermission,
    PhotoFile,
} from 'react-native-vision-camera';
import {
    Canvas,
    Rect,
} from '@shopify/react-native-skia';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
} from 'react-native-reanimated';

import { createCoordinateMapper, ScreenBoundingBox, BoundingBox } from '../utils/coordinateMapper';
import type { OCRResult } from '../services/TextRecognitionModule';

const { TextRecognitionModule } = NativeModules;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Debug mode - shows bounding boxes
const DEBUG_MODE = true;

// OCR processing interval in ms (5fps = 200ms)
const OCR_INTERVAL_MS = 300;

interface LiveTranslationScreenProps {
    onBack?: () => void;
    sourceLang?: string;
    targetLang?: string;
}

interface TextBlock {
    text: string;
    boundingBox: BoundingBox;
    corners?: Array<{ x: number; y: number }>;
}

interface DebugOverlayProps {
    blocks: TextBlock[];
    frameWidth: number;
    frameHeight: number;
}

/**
 * Debug overlay component that draws bounding boxes around detected text
 */
const DebugOverlay: React.FC<DebugOverlayProps> = ({
    blocks,
    frameWidth,
    frameHeight,
}) => {
    if (!frameWidth || !frameHeight || blocks.length === 0) {
        return null;
    }

    // Create coordinate mapper
    const mapper = createCoordinateMapper({
        frame: { width: frameWidth, height: frameHeight },
        screen: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
        resizeMode: 'cover',
    });

    // Map all bounding boxes to screen coordinates
    const screenBoxes: ScreenBoundingBox[] = blocks
        .filter(block => block.boundingBox)
        .map(block => mapper.mapBoundingBox(block.boundingBox));

    return (
        <Canvas style={StyleSheet.absoluteFill}>
            {screenBoxes.map((box, index) => (
                <Rect
                    key={index}
                    x={box.x}
                    y={box.y}
                    width={box.width}
                    height={box.height}
                    color="rgba(255, 0, 0, 0.3)"
                    style="fill"
                />
            ))}
            {screenBoxes.map((box, index) => (
                <Rect
                    key={`border-${index}`}
                    x={box.x}
                    y={box.y}
                    width={box.width}
                    height={box.height}
                    color="red"
                    style="stroke"
                    strokeWidth={2}
                />
            ))}
        </Canvas>
    );
};

/**
 * Main Live Translation Screen Component
 */
export default function LiveTranslationScreen({
    onBack,
    sourceLang = 'en',
    targetLang = 'vi'
}: LiveTranslationScreenProps) {
    // Camera permission
    const { hasPermission, requestPermission } = useCameraPermission();

    // Get back camera
    const device = useCameraDevice('back');

    // Camera ref for taking photos
    const cameraRef = useRef<Camera>(null);

    // State for displaying OCR results
    const [displayBlocks, setDisplayBlocks] = useState<TextBlock[]>([]);
    const [frameDimensions, setFrameDimensions] = useState({ width: 1080, height: 1920 });
    const [isProcessing, setIsProcessing] = useState(false);

    // Processing interval ref
    const processingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Request camera permission on mount
    useEffect(() => {
        if (!hasPermission) {
            requestPermission();
        }
    }, [hasPermission, requestPermission]);

    // Start OCR processing loop when camera is active
    useEffect(() => {
        if (hasPermission && device && cameraRef.current) {
            // Start processing loop
            processingIntervalRef.current = setInterval(async () => {
                if (isProcessing || !cameraRef.current) return;

                try {
                    setIsProcessing(true);

                    // Take a snapshot for OCR (using lower quality for speed)
                    const photo = await cameraRef.current.takePhoto({
                        enableShutterSound: false,
                    });

                    console.log('Photo taken for OCR:', photo.path);

                    // Call native OCR module
                    const result: OCRResult = await TextRecognitionModule.processImage(photo.path);

                    console.log(`OCR detected ${result.blocks.length} blocks`);

                    setDisplayBlocks(result.blocks);
                    setFrameDimensions({ width: result.frameWidth, height: result.frameHeight });

                } catch (error) {
                    console.log('OCR processing error:', error);
                } finally {
                    setIsProcessing(false);
                }
            }, OCR_INTERVAL_MS);

            return () => {
                if (processingIntervalRef.current) {
                    clearInterval(processingIntervalRef.current);
                }
            };
        }
    }, [hasPermission, device, isProcessing]);

    // Handle back button
    const handleBack = useCallback(() => {
        if (onBack) {
            onBack();
        }
    }, [onBack]);

    // Render permission denied state
    if (!hasPermission) {
        return (
            <View style={styles.container}>
                <Text style={styles.permissionText}>
                    Camera permission is required for Live Translation
                </Text>
                <TouchableOpacity style={styles.button} onPress={requestPermission}>
                    <Text style={styles.buttonText}>Grant Permission</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Render no device state
    if (!device) {
        return (
            <View style={styles.container}>
                <Text style={styles.permissionText}>No camera device found</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Camera Preview */}
            <Camera
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={true}
                photo={true}
            />

            {/* Debug Overlay - Bounding Boxes */}
            {DEBUG_MODE && displayBlocks.length > 0 && (
                <DebugOverlay
                    blocks={displayBlocks}
                    frameWidth={frameDimensions.width}
                    frameHeight={frameDimensions.height}
                />
            )}

            {/* Header UI */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                    <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Live Translation</Text>
            </View>

            {/* Footer UI - Debug Info */}
            {DEBUG_MODE && (
                <View style={styles.footer}>
                    <Text style={styles.debugText}>
                        Detected: {displayBlocks.length} text blocks
                    </Text>
                    <Text style={styles.debugText}>
                        Processing: {isProcessing ? 'Yes' : 'No'}
                    </Text>
                    <Text style={styles.debugText}>
                        Screen: {SCREEN_WIDTH.toFixed(0)} x {SCREEN_HEIGHT.toFixed(0)}
                    </Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingTop: Platform.OS === 'ios' ? 50 : 30,
        paddingHorizontal: 16,
        paddingBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    backButton: {
        padding: 8,
    },
    backButtonText: {
        color: '#fff',
        fontSize: 16,
    },
    headerTitle: {
        flex: 1,
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        marginRight: 40,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    debugText: {
        color: '#0f0',
        fontSize: 12,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    permissionText: {
        color: '#fff',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 20,
        paddingHorizontal: 32,
    },
    button: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
