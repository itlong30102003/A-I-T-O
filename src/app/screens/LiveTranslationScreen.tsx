/**
 * LiveTranslationScreen - Live AR Camera Translation
 * 
 * Phase 2.3: OCR + Translation + Tracking Integration
 * 
 * Features:
 * - Camera preview with Vision Camera
 * - Real-time OCR with ML Kit
 * - On-device translation
 * - Text block tracking and stabilization
 * - AR overlay with Skia
 */

import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import {
    StyleSheet,
    View,
    Text as RNText,
    Dimensions,
    TouchableOpacity,
    Platform,
    NativeModules,
    ActivityIndicator,
} from 'react-native';
import {
    Camera,
    useCameraDevice,
    useCameraPermission,
} from 'react-native-vision-camera';
import {
    Canvas,
    Rect,
    RoundedRect,
    Group,
} from '@shopify/react-native-skia';

import { createCoordinateMapper, ScreenBoundingBox } from '../utils/coordinateMapper';
import { TextBlockTracker, TrackedTextBlock } from '../utils/textTracking';
import type { OCRResult } from '../services/TextRecognitionModule';
import mlKitTranslationService from '../services/MLKitTranslationService';

const { TextRecognitionModule } = NativeModules;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Configuration
const CONFIG = {
    DEBUG_MODE: true,
    OCR_INTERVAL_MS: 300,
    TRANSLATION_DEBOUNCE_MS: 500,
    MIN_FRAMES_FOR_TRANSLATION: 3,
    MAX_BLOCKS_TO_TRANSLATE: 10,
};

interface LiveTranslationScreenProps {
    onBack?: () => void;
    sourceLang?: string;
    targetLang?: string;
}

interface TranslationOverlayProps {
    blocks: TrackedTextBlock[];
    frameWidth: number;
    frameHeight: number;
    isProcessing: boolean;
}

/**
 * Translation Overlay Component
 * Renders translated text on top of detected text blocks
 * Uses Skia for boxes, RN Text for translations (no font loading required)
 */
const TranslationOverlay: React.FC<TranslationOverlayProps> = ({
    blocks,
    frameWidth,
    frameHeight,
    isProcessing,
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

    // Map blocks to screen coordinates
    const screenBlocks = blocks
        .filter(block => block.smoothedBox)
        .map(block => ({
            ...block,
            screenBox: mapper.mapBoundingBox(block.smoothedBox),
        }));

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {/* Skia Canvas for bounding boxes */}
            <Canvas style={StyleSheet.absoluteFill}>
                {screenBlocks.map((block) => {
                    const { screenBox, translatedText, isStable } = block;
                    const hasTranslation = !!translatedText;

                    // Colors based on state
                    const boxColor = hasTranslation
                        ? 'rgba(0, 200, 0, 0.25)'
                        : isStable
                            ? 'rgba(255, 200, 0, 0.25)'
                            : 'rgba(255, 0, 0, 0.15)';

                    const borderColor = hasTranslation
                        ? '#00C853'
                        : isStable
                            ? '#FFD600'
                            : '#FF5252';

                    return (
                        <Group key={block.id}>
                            {/* Original text bounding box */}
                            <RoundedRect
                                x={screenBox.x}
                                y={screenBox.y}
                                width={screenBox.width}
                                height={screenBox.height}
                                r={4}
                                color={boxColor}
                            />
                            <RoundedRect
                                x={screenBox.x}
                                y={screenBox.y}
                                width={screenBox.width}
                                height={screenBox.height}
                                r={4}
                                color={borderColor}
                                style="stroke"
                                strokeWidth={1.5}
                            />
                        </Group>
                    );
                })}
            </Canvas>

            {/* React Native Text overlays for translations */}
            {screenBlocks.map((block) => {
                const { screenBox, translatedText, isStable, needsTranslation } = block;
                const hasTranslation = !!translatedText;
                const translationBoxY = screenBox.y + screenBox.height + 4;

                return (
                    <View key={`text-${block.id}`}>
                        {/* Translation text */}
                        {hasTranslation && (
                            <View
                                style={[
                                    overlayStyles.translationBox,
                                    {
                                        left: screenBox.x,
                                        top: translationBoxY,
                                        maxWidth: Math.max(screenBox.width + 20, 120),
                                    }
                                ]}
                            >
                                <RNText style={overlayStyles.translationText} numberOfLines={2}>
                                    {translatedText}
                                </RNText>
                            </View>
                        )}

                        {/* Loading indicator */}
                        {isStable && needsTranslation && !hasTranslation && (
                            <View
                                style={[
                                    overlayStyles.loadingBox,
                                    {
                                        left: screenBox.x,
                                        top: translationBoxY,
                                    }
                                ]}
                            >
                                <RNText style={overlayStyles.loadingText}>Đang dịch...</RNText>
                            </View>
                        )}
                    </View>
                );
            })}
        </View>
    );
};

const overlayStyles = StyleSheet.create({
    translationBox: {
        position: 'absolute',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    translationText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '500',
    },
    loadingBox: {
        position: 'absolute',
        backgroundColor: 'rgba(255, 200, 0, 0.9)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 3,
    },
    loadingText: {
        color: '#000000',
        fontSize: 11,
        fontWeight: '500',
    },
});

/**
 * Debug Overlay - Shows raw bounding boxes (legacy)
 */
const DebugOverlay: React.FC<{
    blocks: TrackedTextBlock[];
    frameWidth: number;
    frameHeight: number;
}> = ({ blocks, frameWidth, frameHeight }) => {
    if (!frameWidth || !frameHeight || blocks.length === 0) {
        return null;
    }

    const mapper = createCoordinateMapper({
        frame: { width: frameWidth, height: frameHeight },
        screen: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
        resizeMode: 'cover',
    });

    const screenBoxes: ScreenBoundingBox[] = blocks
        .filter(block => block.boundingBox)
        .map(block => mapper.mapBoundingBox(block.boundingBox));

    return (
        <Canvas style={StyleSheet.absoluteFill}>
            {screenBoxes.map((box, index) => (
                <React.Fragment key={index}>
                    <Rect
                        x={box.x}
                        y={box.y}
                        width={box.width}
                        height={box.height}
                        color="rgba(255, 0, 0, 0.2)"
                        style="fill"
                    />
                    <Rect
                        x={box.x}
                        y={box.y}
                        width={box.width}
                        height={box.height}
                        color="red"
                        style="stroke"
                        strokeWidth={1}
                    />
                </React.Fragment>
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
    const device = useCameraDevice('back');
    const cameraRef = useRef<Camera>(null);

    // Tracker instance
    const trackerRef = useRef(new TextBlockTracker());

    // State
    const [trackedBlocks, setTrackedBlocks] = useState<TrackedTextBlock[]>([]);
    const [frameDimensions, setFrameDimensions] = useState({ width: 1080, height: 1920 });
    const [isProcessing, setIsProcessing] = useState(false);
    const [isTranslating, setIsTranslating] = useState(false);
    const [stats, setStats] = useState({
        totalBlocks: 0,
        stableBlocks: 0,
        translatedBlocks: 0,
        ocrLatency: 0,
        translationLatency: 0,
    });

    // Refs for async operations
    const processingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const translationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isProcessingRef = useRef(false);

    // Request camera permission on mount
    useEffect(() => {
        if (!hasPermission) {
            requestPermission();
        }

        // Cleanup tracker on unmount
        return () => {
            trackerRef.current.clear();
        };
    }, [hasPermission, requestPermission]);

    /**
     * Translate stable blocks that need translation
     */
    const translateBlocks = useCallback(async () => {
        const blocksToTranslate = trackerRef.current.getBlocksNeedingTranslation()
            .slice(0, CONFIG.MAX_BLOCKS_TO_TRANSLATE);

        if (blocksToTranslate.length === 0) return;

        setIsTranslating(true);
        const startTime = Date.now();

        try {
            console.log(`Translating ${blocksToTranslate.length} blocks...`);

            // Batch translate
            const items = blocksToTranslate.map(block => ({
                id: block.id,
                text: block.text,
            }));

            const response = await mlKitTranslationService.translate({
                items,
                sourceLanguage: sourceLang,
                targetLanguage: targetLang,
            });

            // Update tracker with results
            if (response.results) {
                const translations = response.results.map(r => ({
                    id: String(r.id),
                    translatedText: r.t,
                }));
                trackerRef.current.setTranslations(translations);
            }

            const latency = Date.now() - startTime;
            setStats(prev => ({
                ...prev,
                translationLatency: latency,
                translatedBlocks: trackerRef.current.getStableBlocks()
                    .filter(b => b.translatedText).length,
            }));

            console.log(`Translation completed in ${latency}ms`);

        } catch (error) {
            console.error('Translation error:', error);
        } finally {
            setIsTranslating(false);
        }
    }, [sourceLang, targetLang]);

    /**
     * Process OCR frame
     */
    const processFrame = useCallback(async () => {
        if (isProcessingRef.current || !cameraRef.current) return;

        isProcessingRef.current = true;
        setIsProcessing(true);
        const startTime = Date.now();

        try {
            // Take photo for OCR
            const photo = await cameraRef.current.takePhoto({
                enableShutterSound: false,
            });

            // Run OCR
            const result: OCRResult = await TextRecognitionModule.processImage(photo.path);

            // Update frame dimensions
            setFrameDimensions({
                width: result.frameWidth,
                height: result.frameHeight
            });

            // Update tracker with new blocks
            const updatedBlocks = trackerRef.current.update(result.blocks);
            setTrackedBlocks(updatedBlocks);

            // Update stats
            const stableBlocks = updatedBlocks.filter(b => b.isStable);
            const translatedBlocks = stableBlocks.filter(b => b.translatedText);
            const ocrLatency = Date.now() - startTime;

            setStats(prev => ({
                ...prev,
                totalBlocks: updatedBlocks.length,
                stableBlocks: stableBlocks.length,
                translatedBlocks: translatedBlocks.length,
                ocrLatency,
            }));

            // Schedule translation if there are blocks needing it
            const needsTranslation = trackerRef.current.getBlocksNeedingTranslation();
            if (needsTranslation.length > 0 && !isTranslating) {
                // Debounce translation
                if (translationTimeoutRef.current) {
                    clearTimeout(translationTimeoutRef.current);
                }
                translationTimeoutRef.current = setTimeout(translateBlocks, CONFIG.TRANSLATION_DEBOUNCE_MS);
            }

        } catch (error) {
            console.log('OCR processing error:', error);
        } finally {
            isProcessingRef.current = false;
            setIsProcessing(false);
        }
    }, [translateBlocks, isTranslating]);

    // Start OCR processing loop
    useEffect(() => {
        if (hasPermission && device && cameraRef.current) {
            // Small delay to ensure camera is ready
            const startTimeout = setTimeout(() => {
                processingIntervalRef.current = setInterval(processFrame, CONFIG.OCR_INTERVAL_MS);
            }, 1000);

            return () => {
                clearTimeout(startTimeout);
                if (processingIntervalRef.current) {
                    clearInterval(processingIntervalRef.current);
                }
                if (translationTimeoutRef.current) {
                    clearTimeout(translationTimeoutRef.current);
                }
            };
        }
    }, [hasPermission, device, processFrame]);

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
                <RNText style={styles.permissionText}>
                    Camera permission is required for Live Translation
                </RNText>
                <TouchableOpacity style={styles.button} onPress={requestPermission}>
                    <RNText style={styles.buttonText}>Grant Permission</RNText>
                </TouchableOpacity>
            </View>
        );
    }

    // Render no device state
    if (!device) {
        return (
            <View style={styles.container}>
                <RNText style={styles.permissionText}>No camera device found</RNText>
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

            {/* Translation Overlay */}
            <TranslationOverlay
                blocks={trackedBlocks}
                frameWidth={frameDimensions.width}
                frameHeight={frameDimensions.height}
                isProcessing={isProcessing}
            />

            {/* Debug Overlay - Raw boxes */}
            {CONFIG.DEBUG_MODE && false && (
                <DebugOverlay
                    blocks={trackedBlocks}
                    frameWidth={frameDimensions.width}
                    frameHeight={frameDimensions.height}
                />
            )}

            {/* Header UI */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                    <RNText style={styles.backButtonText}>← Back</RNText>
                </TouchableOpacity>
                <RNText style={styles.headerTitle}>Live Translation</RNText>
                <View style={styles.langBadge}>
                    <RNText style={styles.langText}>{sourceLang} → {targetLang}</RNText>
                </View>
            </View>

            {/* Status Indicators */}
            <View style={styles.statusBar}>
                {isProcessing && (
                    <View style={styles.statusItem}>
                        <ActivityIndicator size="small" color="#00C853" />
                        <RNText style={styles.statusText}>OCR</RNText>
                    </View>
                )}
                {isTranslating && (
                    <View style={styles.statusItem}>
                        <ActivityIndicator size="small" color="#FFD600" />
                        <RNText style={styles.statusText}>Dịch</RNText>
                    </View>
                )}
            </View>

            {/* Footer UI - Debug Info */}
            {CONFIG.DEBUG_MODE && (
                <View style={styles.footer}>
                    <RNText style={styles.debugText}>
                        Blocks: {stats.totalBlocks} | Stable: {stats.stableBlocks} | Translated: {stats.translatedBlocks}
                    </RNText>
                    <RNText style={styles.debugText}>
                        OCR: {stats.ocrLatency}ms | Trans: {stats.translationLatency}ms
                    </RNText>
                    <RNText style={styles.debugText}>
                        Frame: {trackerRef.current.getCurrentFrame()} | Screen: {SCREEN_WIDTH.toFixed(0)}x{SCREEN_HEIGHT.toFixed(0)}
                    </RNText>
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
        paddingBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
    },
    langBadge: {
        backgroundColor: 'rgba(0, 200, 83, 0.8)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    langText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    statusBar: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 100 : 80,
        right: 16,
        flexDirection: 'column',
        gap: 8,
    },
    statusItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 6,
    },
    statusText: {
        color: '#fff',
        fontSize: 12,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
    },
    debugText: {
        color: '#0f0',
        fontSize: 11,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        marginBottom: 2,
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
