import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Alert,
    StyleSheet,
    ScrollView,
    Image,
    ActivityIndicator,
    Modal,
    FlatList,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import { screenCaptureService } from '../services/ScreenCaptureService';
import { ocrPipelineService } from '../services/OCRPipelineService';
import TranslationManager from '../services/TranslationManager';
import { overlayService } from '../services/OverlayService';
import { realtimePipelineService } from '../services/RealtimePipelineService';
import { selectionPipelineService } from '../services/SelectionPipelineService';
import { mlKitTranslationService } from '../services/MLKitTranslationService';
import LiveTranslationScreen from '../screens/LiveTranslationScreen';

const LANGUAGES = {
    source: [
        { code: 'auto', label: '✨ Auto Detect' },
        { code: 'en', label: '🇺🇸 English' },
        { code: 'zh', label: '🇨🇳 Chinese' },
        { code: 'ja', label: '🇯🇵 Japanese' },
        { code: 'ko', label: '🇰🇷 Korean' },
        { code: 'vi', label: '🇻🇳 Vietnamese' },
    ],
    target: [
        { code: 'vi', label: '🇻🇳 Vietnamese' },
        { code: 'en', label: '🇺🇸 English' },
    ]
};

export default function MainScreen({ onLogout }) {
    const [user, setUser] = useState(null);
    const [captureState, setCaptureState] = useState(screenCaptureService.state);
    const [duration, setDuration] = useState('00:00');
    const [translationMode, setTranslationMode] = useState('REALTIME'); // 'REALTIME' | 'SELECTION' | 'CAMERA'
    const [showCameraScreen, setShowCameraScreen] = useState(false);

    // Language Selection State
    const [sourceLang, setSourceLang] = useState(LANGUAGES.source[0]);
    const [targetLang, setTargetLang] = useState(LANGUAGES.target[0]);
    const [showLanguageModal, setShowLanguageModal] = useState(null); // 'source' | 'target' | null
    const [showResultModal, setShowResultModal] = useState(false);
    const [selectedText, setSelectedText] = useState('Nội dung sẽ được dịch ở đây...');

    // Selection Mode State
    const [selectionType, setSelectionType] = useState('WORD'); // 'WORD' | 'PARAGRAPH'

    // Model Loading State
    const [modelLoadingStatus, setModelLoadingStatus] = useState({
        isLoading: false,
        loaded: mlKitTranslationService.modelsLoaded,
        progress: 0,
        total: 4,
        models: [],
    });

    const MODES = [
        { id: 'REALTIME', label: '⚡ Realtime', desc: 'Dịch trực tiếp (ML Kit)' },
        { id: 'SELECTION', label: '🖐️ Selection', desc: 'Chọn vùng dịch (ML Kit)' },
        { id: 'CAMERA', label: '📷 Camera', desc: 'Dịch qua Camera AR' },
    ];

    // Handle Camera mode selection
    const handleModeChange = (modeId) => {
        if (modeId === 'CAMERA') {
            setShowCameraScreen(true);
        } else {
            setTranslationMode(modeId);
            setShowCameraScreen(false);
        }
    };

    // Khởi tạo service và subscribe state changes
    useEffect(() => {
        // Get current user
        const currentUser = auth().currentUser;
        if (currentUser) {
            setUser({
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName,
                photoURL: currentUser.photoURL,
                provider: currentUser.providerData[0]?.providerId || 'unknown',
            });
        }

        // Khởi tạo capture service
        screenCaptureService.initialize();

        // Subscribe to state changes
        const unsubscribe = screenCaptureService.onStateChange((state) => {
            console.log('MainScreen: Capture State Update ->', state.isCapturing ? 'CAPTURING' : 'STOPPED');
            setCaptureState(state);
        });

        // Subscribe to logo clicks - handle toggle based on current mode
        const unsubsLogo = overlayService.onLogoClick(() => {
            console.log('MainScreen: Logo clicked, current mode:', translationMode);
            if (translationMode === 'SELECTION') {
                selectionPipelineService.toggleOverlay();
            } else {
                overlayService.toggleNavbar();
            }
        });

        // Subscribe to navbar source language click
        const unsubsSourceLang = overlayService.onSourceLangClick(() => {
            console.log('MainScreen: Source lang clicked from navbar');
            setShowLanguageModal('source');
        });

        // Subscribe to navbar target language click
        const unsubsTargetLang = overlayService.onTargetLangClick(() => {
            console.log('MainScreen: Target lang clicked from navbar');
            setShowLanguageModal('target');
        });

        // Cleanup on unmount
        return () => {
            unsubscribe();
            unsubsLogo();
            unsubsSourceLang();
            unsubsTargetLang();
            screenCaptureService.cleanup();
        };
    }, [translationMode]);

    // Auto-start Selection Mode when switching to SELECTION
    useEffect(() => {
        if (translationMode === 'SELECTION' && !captureState.isCapturing && !captureState.permissionGranted) {
            console.log('MainScreen: Auto-starting Selection Mode...');
            handleStartSelectionMode();
        }
    }, [translationMode]);

    // Preload ML Kit translation models on startup
    useEffect(() => {
        // Subscribe to model loading status
        const unsubscribe = mlKitTranslationService.onStatusChange((status) => {
            setModelLoadingStatus(status);
        });

        // Start preloading models in background
        if (!mlKitTranslationService.modelsLoaded && !mlKitTranslationService.isModelLoading) {
            console.log('MainScreen: Starting ML Kit model preload...');
            mlKitTranslationService.preloadModels().catch(err => {
                console.warn('MainScreen: Model preload failed:', err);
            });
        }

        return () => unsubscribe();
    }, []);

    // Update duration and handle OCR pipeline state & Realtime Translation
    useEffect(() => {
        let interval;
        let isActive = true;

        const startPipelines = async () => {
            if (!captureState.isCapturing || !isActive) {
                console.log('MainScreen: Skip pipeline start (not capturing or inactive)');
                return;
            }

            console.log(`MainScreen: Starting pipelines (Mode: ${translationMode}, Lang: ${sourceLang.code} -> ${targetLang.code})`);

            // Start duration timer
            interval = setInterval(() => {
                setDuration(screenCaptureService.formatDuration());
            }, 1000);

            const script = ['zh', 'ja', 'ko'].includes(sourceLang.code) ? 'chinese' : 'latin';

            // Start overlay with logo and navbar config
            await overlayService.start('[]');
            overlayService.showLogo();
            overlayService.setNavbarConfig(translationMode, sourceLang.label, targetLang.label);

            if (translationMode === 'REALTIME') {
                console.log('MainScreen: --> Realtime Pipeline Start');
                realtimePipelineService.start({
                    script,
                    sourceLanguage: sourceLang.code,
                    targetLanguage: targetLang.code,
                    debounceMs: 250,
                    maxPendingOCR: 2,
                    maxPendingTranslation: 2,
                });
            } else if (translationMode === 'SELECTION') {
                console.log('MainScreen: --> Selection Pipeline Start');
                selectionPipelineService.start(selectionType, {
                    sourceLanguage: sourceLang.code,
                    targetLanguage: targetLang.code,
                    script,
                });
            } else {
                console.log('MainScreen: --> OCR Pipeline Start (Camera Mode)');
                ocrPipelineService.start(script);
            }
        };

        if (captureState.isCapturing) {
            startPipelines();
        } else {
            realtimePipelineService.stop();
            selectionPipelineService.stop();
            ocrPipelineService.stop();
            overlayService.stop();
        }

        return () => {
            isActive = false;
            if (interval) clearInterval(interval);
            // Don't stop if we are just updating config (handled by .start() logic)
            // Only stop if we are actually stopping capture
            if (!screenCaptureService.state.isCapturing) {
                realtimePipelineService.stop();
                selectionPipelineService.stop();
                ocrPipelineService.stop();
            }
        };
    }, [captureState.isCapturing, translationMode, selectionType, sourceLang.code, targetLang.code]);

    // Sync navbar config when mode or language changes
    useEffect(() => {
        overlayService.setNavbarConfig(translationMode, sourceLang.label, targetLang.label);
    }, [translationMode, sourceLang.label, targetLang.label]);

    const handleLogout = async () => {
        try {
            screenCaptureService.cleanup();
            await auth().signOut();
            if (onLogout) onLogout();
        } catch (error) {
            Alert.alert('Lỗi', 'Không thể đăng xuất');
        }
    };

    // Chọn app để capture (for REALTIME mode)
    const handleSelectApp = async () => {
        try {
            const granted = await screenCaptureService.selectApp();

            if (!granted) {
                Alert.alert(
                    'Quyền bị từ chối',
                    'Bạn cần cấp quyền để capture màn hình.',
                    [{ text: 'OK' }]
                );
            } else {
                // Tự động bắt đầu capture sau khi chọn app
                try {
                    await screenCaptureService.startCapture({ intervalMs: 1000 });
                } catch (captureError) {
                    Alert.alert('Lỗi', captureError.message || 'Không thể bắt đầu capture');
                }
            }
        } catch (error) {
            const isPermissionDenied = error.message?.includes('PERMISSION_DENIED');
            Alert.alert('Lỗi', isPermissionDenied ? 'Bạn đã hủy việc chọn app.' : error.message);
        }
    };

    // Đổi app capture
    const handleChangeApp = () => {
        if (screenCaptureService.supportsAppSelection) {
            Alert.alert(
                '🔄 Đổi App Capture',
                captureState.isCapturing
                    ? 'Capture hiện tại sẽ dừng và bạn có thể chọn app mới.'
                    : 'Bạn có muốn chọn app khác để capture?',
                [
                    { text: 'Hủy', style: 'cancel' },
                    { text: 'Đổi App', onPress: handleSelectApp }
                ]
            );
        } else {
            Alert.alert('Không hỗ trợ', 'Cần Android 14+ để chọn app cụ thể.', [{ text: 'OK' }]);
        }
    };

    // Bắt đầu Selection Mode (tự động capture entire screen)
    const handleStartSelectionMode = async () => {
        // Check overlay permission first
        const hasOverlayPermission = await overlayService.checkPermission();
        if (!hasOverlayPermission) {
            Alert.alert(
                'Quyền Overlay',
                'Ứng dụng cần quyền "Hiển thị trên các ứng dụng khác" để hiển thị bản dịch.',
                [
                    { text: 'Hủy', style: 'cancel' },
                    { text: 'Cấp quyền', onPress: () => overlayService.requestPermission() }
                ]
            );
            return;
        }

        try {
            // Request entire screen capture (no app selection dialog)
            console.log('📺 Starting Selection Mode with Entire Screen...');
            const granted = await screenCaptureService.selectEntireScreen();

            if (!granted) {
                Alert.alert('Quyền bị từ chối', 'Bạn cần cấp quyền để capture màn hình.', [{ text: 'OK' }]);
                return;
            }

            // Auto start capture
            await screenCaptureService.startCapture({ intervalMs: 1000 });
            console.log('✅ Selection Mode started with entire screen capture');
        } catch (error) {
            const isPermissionDenied = error.message?.includes('PERMISSION_DENIED');
            Alert.alert('Lỗi', isPermissionDenied ? 'Bạn đã hủy việc cấp quyền.' : error.message);
        }
    };

    // Bắt đầu capture
    const handleStartCapture = async () => {
        if (!captureState.permissionGranted) {
            Alert.alert('Chưa chọn nguồn', 'Vui lòng chọn app trước khi bắt đầu!', [{ text: 'OK' }]);
            return;
        }

        // Check overlay permission
        const hasOverlayPermission = await overlayService.checkPermission();
        if (!hasOverlayPermission) {
            Alert.alert(
                'Quyền Overlay',
                'Ứng dụng cần quyền "Hiển thị trên các ứng dụng khác" để hiển thị bản dịch.',
                [
                    { text: 'Hủy', style: 'cancel' },
                    { text: 'Cấp quyền', onPress: () => overlayService.requestPermission() }
                ]
            );
            return;
        }

        try {
            await screenCaptureService.startCapture({ intervalMs: 1000 });
        } catch (error) {
            Alert.alert('Lỗi khởi động', error.message || 'Không thể bắt đầu capture.', [{ text: 'OK' }]);
        }
    };

    // Dừng capture
    const handleStopCapture = async () => {
        try {
            await screenCaptureService.stopCapture();
        } catch (error) {
            Alert.alert('Lỗi', error.message || 'Không thể dừng capture', [{ text: 'OK' }]);
        }
    };

    const renderLanguageModal = () => (
        <Modal
            visible={!!showLanguageModal}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowLanguageModal(null)}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>
                        {showLanguageModal === 'source' ? 'Chọn ngôn ngữ nguồn' : 'Chọn ngôn ngữ đích'}
                    </Text>
                    <FlatList
                        data={showLanguageModal === 'source' ? LANGUAGES.source : LANGUAGES.target}
                        keyExtractor={(item) => item.code}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.languageOption}
                                onPress={() => {
                                    if (showLanguageModal === 'source') setSourceLang(item);
                                    else setTargetLang(item);
                                    setShowLanguageModal(null);
                                }}
                            >
                                <Text style={styles.languageOptionText}>{item.label}</Text>
                                {((showLanguageModal === 'source' && sourceLang.code === item.code) ||
                                    (showLanguageModal === 'target' && targetLang.code === item.code)) && (
                                        <Text style={styles.checkMark}>✓</Text>
                                    )}
                            </TouchableOpacity>
                        )}
                    />
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => setShowLanguageModal(null)}
                    >
                        <Text style={styles.closeButtonText}>Đóng</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );

    const renderResultModal = () => (
        <Modal
            visible={showResultModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowResultModal(false)}
        >
            <TouchableOpacity
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setShowResultModal(false)}
            >
                <View style={styles.resultPanel}>
                    <View style={styles.resultHeader}>
                        <Text style={styles.resultTitle}>📝 Bản dịch</Text>
                        <TouchableOpacity onPress={() => setShowResultModal(false)}>
                            <Text style={styles.closeIcon}>✕</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.resultContent}>
                        <Text style={styles.translatedTextContent}>{selectedText}</Text>
                    </ScrollView>
                    <View style={styles.resultFooter}>
                        <Text style={styles.resultMeta}>💡 Model: ML Kit (Local)</Text>
                    </View>
                </View>
            </TouchableOpacity>
        </Modal>
    );


    // Destructure state for easier access
    const { isCapturing, permissionGranted, latestFrame, androidInfo } = captureState;

    // If Camera mode is active, render LiveTranslationScreen instead
    if (showCameraScreen) {
        return (
            <LiveTranslationScreen
                onBack={() => {
                    setShowCameraScreen(false);
                    setTranslationMode('REALTIME');
                }}
                sourceLang={sourceLang.code}
                targetLang={targetLang.code}
            />
        );
    }

    return (
        <ScrollView style={styles.container}>
            {/* User Info */}
            <View style={styles.userSection}>
                <Text style={styles.userName}>
                    {user?.displayName || user?.email || 'Chưa có tên'}
                </Text>
                <Text style={styles.userEmail}>{user?.email}</Text>
            </View>

            {/* Android Info */}
            <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>📱 Thông tin thiết bị</Text>
                {androidInfo ? (
                    <>
                        <Text style={styles.infoText}>
                            🤖 Android: {androidInfo.androidVersion || 'N/A'} (API {androidInfo.sdkVersion})
                        </Text>
                        <Text style={[
                            styles.infoText,
                            androidInfo.supportsAppSelection && styles.infoTextSuccess
                        ]}>
                            {androidInfo.supportsAppSelection
                                ? '✅ Hỗ trợ chọn App cụ thể (Android 14+)'
                                : '📺 Chế độ Full Screen (Android < 14)'}
                        </Text>
                        {androidInfo.supportsAppSelection && (
                            <Text style={styles.infoTextSmall}>
                                💡 Bạn có thể chọn capture chỉ 1 app cụ thể
                            </Text>
                        )}
                    </>
                ) : (
                    <Text style={styles.infoText}>⏳ Đang tải thông tin...</Text>
                )}
            </View>

            {/* Model Loading Status - Detailed Progress */}
            {(modelLoadingStatus.isLoading || (modelLoadingStatus.models && modelLoadingStatus.models.length > 0 && !modelLoadingStatus.loaded)) && (
                <View style={styles.modelLoadingCard}>
                    <View style={styles.modelLoadingHeader}>
                        <Text style={styles.modelLoadingTitle}>📥 Đang tải Model dịch</Text>
                        <Text style={styles.modelLoadingSubtitle}>
                            {modelLoadingStatus.progress}/{modelLoadingStatus.total} hoàn thành
                        </Text>
                    </View>

                    {/* Individual Model Progress */}
                    {modelLoadingStatus.models && modelLoadingStatus.models.map((model, index) => (
                        <View key={model.id} style={styles.modelItem}>
                            <View style={styles.modelItemHeader}>
                                <Text style={styles.modelEmoji}>{model.emoji}</Text>
                                <Text style={styles.modelName}>{model.name}</Text>
                                <Text style={[
                                    styles.modelStatus,
                                    model.status === 'completed' && styles.modelStatusCompleted,
                                    model.status === 'downloading' && styles.modelStatusDownloading,
                                    model.status === 'failed' && styles.modelStatusFailed,
                                ]}>
                                    {model.status === 'pending' && '⏳ Đợi'}
                                    {model.status === 'downloading' && '⬇️ Đang tải...'}
                                    {model.status === 'completed' && '✅ Xong'}
                                    {model.status === 'failed' && '❌ Lỗi'}
                                </Text>
                            </View>

                            {/* Progress Bar - show spinner for downloading, bar for completed */}
                            {model.status === 'downloading' ? (
                                <View style={styles.downloadingContainer}>
                                    <ActivityIndicator size="small" color="#1976d2" />
                                    <Text style={styles.elapsedText}>
                                        Đang chờ... {model.progress < 0 ? `${Math.abs(model.progress)}s` : ''}
                                    </Text>
                                </View>
                            ) : (
                                <>
                                    <View style={styles.progressBarContainer}>
                                        <View
                                            style={[
                                                styles.progressBar,
                                                model.status === 'completed' && styles.progressBarCompleted,
                                                model.status === 'failed' && styles.progressBarFailed,
                                                { width: model.status === 'completed' ? '100%' : '0%' }
                                            ]}
                                        />
                                    </View>
                                    <Text style={styles.progressText}>
                                        {model.status === 'completed' ? '100%' : model.status === 'pending' ? 'Đợi...' : '0%'}
                                    </Text>
                                </>
                            )}

                            {model.error && (
                                <Text style={styles.modelError}>{model.error}</Text>
                            )}
                        </View>
                    ))}

                    <Text style={styles.modelLoadingHint}>
                        💡 Lần đầu mất vài phút. Cần kết nối WiFi ổn định.
                    </Text>
                </View>
            )}

            {/* Model Loaded Success Banner - show briefly */}
            {modelLoadingStatus.loaded && !modelLoadingStatus.isLoading && (
                <View style={styles.modelLoadedBanner}>
                    <Text style={styles.modelLoadedText}>
                        ✅ Model dịch đã sẵn sàng ({modelLoadingStatus.total}/{modelLoadingStatus.total})
                    </Text>
                </View>
            )}

            {/* Mode Selector */}
            <View style={styles.modeSection}>
                <Text style={styles.sectionTitle}>🛠️ Chế độ dịch</Text>
                <View style={styles.modeContainer}>
                    {MODES.map((mode) => (
                        <TouchableOpacity
                            key={mode.id}
                            style={[
                                styles.modeButton,
                                translationMode === mode.id && styles.modeButtonActive
                            ]}
                            onPress={() => handleModeChange(mode.id)}
                        >
                            <Text style={[
                                styles.modeLabel,
                                translationMode === mode.id && styles.modeLabelActive
                            ]}>
                                {mode.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <Text style={styles.modeDescription}>
                    {MODES.find(m => m.id === translationMode)?.desc}
                </Text>

                {/* Selection Type - Only show for SELECTION mode */}
                {translationMode === 'SELECTION' && (
                    <View style={styles.selectionTypeContainer}>
                        <Text style={styles.selectionTypeLabel}>📌 Kiểu chọn:</Text>
                        <View style={styles.selectionTypeRow}>
                            <TouchableOpacity
                                style={[
                                    styles.selectionTypeBtn,
                                    selectionType === 'WORD' && styles.selectionTypeBtnActive
                                ]}
                                onPress={() => setSelectionType('WORD')}
                            >
                                <Text style={[
                                    styles.selectionTypeBtnText,
                                    selectionType === 'WORD' && styles.selectionTypeBtnTextActive
                                ]}>📝 Từ</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.selectionTypeBtn,
                                    selectionType === 'PARAGRAPH' && styles.selectionTypeBtnActive
                                ]}
                                onPress={() => setSelectionType('PARAGRAPH')}
                            >
                                <Text style={[
                                    styles.selectionTypeBtnText,
                                    selectionType === 'PARAGRAPH' && styles.selectionTypeBtnTextActive
                                ]}>📄 Đoạn văn</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.selectionTypeHint}>
                            {selectionType === 'WORD'
                                ? '💡 Chạm vào từ để dịch'
                                : '💡 Vẽ vùng chọn để dịch đoạn văn'}
                        </Text>
                    </View>
                )}

            </View>

            {/* Language Selector */}
            <View style={styles.languageSection}>
                <Text style={styles.sectionTitle}>🌐 Ngôn ngữ</Text>
                <View style={styles.languageRow}>
                    <TouchableOpacity
                        style={styles.languageButton}
                        onPress={() => setShowLanguageModal('source')}
                    >
                        <Text style={styles.languageLabel}>Nguồn</Text>
                        <Text style={styles.languageValue}>{sourceLang.label}</Text>
                    </TouchableOpacity>

                    <Text style={styles.arrow}>➡️</Text>

                    <TouchableOpacity
                        style={styles.languageButton}
                        onPress={() => setShowLanguageModal('target')}
                    >
                        <Text style={styles.languageLabel}>Đích</Text>
                        <Text style={styles.languageValue}>{targetLang.label}</Text>
                    </TouchableOpacity>
                </View>
            </View>


            {/* Screen Capture Controls - Only show for REALTIME mode */}
            {translationMode === 'REALTIME' && (
                <View style={styles.captureSection}>
                    <Text style={styles.sectionTitle}>🎥 Screen Capture</Text>

                    {/* Status Display */}
                    <View style={styles.statusContainer}>
                        <View style={styles.statusRow}>
                            <Text style={styles.statusLabel}>Nguồn:</Text>
                            <Text style={[
                                styles.statusValue,
                                permissionGranted ? styles.statusSuccess : styles.statusError
                            ]}>
                                {permissionGranted ? '✅ Đã chọn' : '❌ Chưa chọn'}
                            </Text>
                        </View>
                        <View style={styles.statusRow}>
                            <Text style={styles.statusLabel}>Trạng thái:</Text>
                            <View style={styles.statusValueContainer}>
                                {isCapturing && <View style={styles.pulsingDot} />}
                                <Text style={[
                                    styles.statusValue,
                                    isCapturing ? styles.statusSuccess : styles.statusError
                                ]}>
                                    {isCapturing ? 'Đang capture' : 'Đã dừng'}
                                </Text>
                            </View>
                        </View>
                        {isCapturing && (
                            <View style={styles.statusRow}>
                                <Text style={styles.statusLabel}>Thời gian:</Text>
                                <Text style={styles.statusValue}>⏱️ {duration}</Text>
                            </View>
                        )}
                    </View>

                    {/* Step 1: Select App Button - Show when no permission */}
                    {!permissionGranted && !isCapturing && (
                        <TouchableOpacity
                            style={styles.buttonPrimary}
                            onPress={handleSelectApp}
                        >
                            <Text style={styles.buttonText}>
                                {androidInfo?.supportsAppSelection
                                    ? '🎯 Chọn App để Capture'
                                    : '📺 Cấp quyền Capture'}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {/* Step 2: Control Buttons - Show after app selected */}
                    {permissionGranted && (
                        <>
                            <View style={styles.buttonRow}>
                                <TouchableOpacity
                                    style={[styles.buttonStart, isCapturing && styles.buttonDisabled]}
                                    onPress={handleStartCapture}
                                    disabled={isCapturing}
                                >
                                    <Text style={styles.buttonText}>▶️ Bắt đầu</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.buttonStop, !isCapturing && styles.buttonDisabled]}
                                    onPress={handleStopCapture}
                                    disabled={!isCapturing}
                                >
                                    <Text style={styles.buttonText}>⏹️ Dừng</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Change App Button - Only show on Android 14+ */}
                            {androidInfo?.supportsAppSelection && (
                                <TouchableOpacity
                                    style={styles.buttonChangeApp}
                                    onPress={handleChangeApp}
                                >
                                    <Text style={styles.buttonChangeAppText}>
                                        🔄 Đổi App Capture
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </>
                    )}


                </View>
            )}



            {/* Logout Button */}
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutText}>🚪 Đăng xuất</Text>
            </TouchableOpacity>

            {renderLanguageModal()}
            {renderResultModal()}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        padding: 16,
    },
    userSection: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        alignItems: 'center',
    },
    userName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    userEmail: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
    },
    infoSection: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 12,
    },
    infoText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    infoTextSuccess: {
        color: '#34A853',
        fontWeight: '600',
    },
    infoTextSmall: {
        fontSize: 12,
        color: '#888',
        marginTop: 4,
        fontStyle: 'italic',
    },
    modelLoadingBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1976d2',
        padding: 14,
        borderRadius: 12,
        marginBottom: 16,
    },
    modelLoadingTextContainer: {
        marginLeft: 12,
        flex: 1,
    },
    modelLoadingText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    modelLoadingSubtext: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        marginTop: 2,
    },
    // NEW: Detailed model loading card
    modelLoadingCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    modelLoadingHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    modelLoadingTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1976d2',
    },
    modelLoadingSubtitle: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    modelItem: {
        marginBottom: 14,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    modelItemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    modelEmoji: {
        fontSize: 18,
        marginRight: 8,
    },
    modelName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        flex: 1,
    },
    modelStatus: {
        fontSize: 12,
        color: '#888',
        fontWeight: '500',
    },
    modelStatusCompleted: {
        color: '#4caf50',
    },
    modelStatusDownloading: {
        color: '#1976d2',
    },
    modelStatusFailed: {
        color: '#f44336',
    },
    progressBarContainer: {
        height: 8,
        backgroundColor: '#e0e0e0',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 4,
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#90caf9',
        borderRadius: 4,
    },
    progressBarCompleted: {
        backgroundColor: '#4caf50',
    },
    progressBarDownloading: {
        backgroundColor: '#1976d2',
    },
    progressBarFailed: {
        backgroundColor: '#f44336',
    },
    downloadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
    },
    elapsedText: {
        fontSize: 12,
        color: '#1976d2',
        marginLeft: 8,
        fontWeight: '500',
    },
    progressText: {
        fontSize: 11,
        color: '#888',
        textAlign: 'right',
    },
    modelError: {
        fontSize: 11,
        color: '#f44336',
        marginTop: 4,
        fontStyle: 'italic',
    },
    modelLoadingHint: {
        fontSize: 12,
        color: '#888',
        textAlign: 'center',
        marginTop: 8,
        fontStyle: 'italic',
    },
    modelLoadedBanner: {
        backgroundColor: '#e8f5e9',
        padding: 12,
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#c8e6c9',
    },
    modelLoadedText: {
        color: '#2e7d32',
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
    },
    captureSection: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    statusContainer: {
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    statusLabel: {
        fontSize: 14,
        color: '#666',
        width: 80,
    },
    statusValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    statusValueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusSuccess: {
        color: '#34A853',
    },
    statusError: {
        color: '#EA4335',
    },
    pulsingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#34A853',
        marginRight: 6,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        backgroundColor: '#e3f2fd',
        borderRadius: 8,
        marginBottom: 12,
    },
    loadingText: {
        marginLeft: 8,
        color: '#1976d2',
        fontSize: 14,
    },
    buttonPrimary: {
        backgroundColor: '#4285F4',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 12,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 12,
    },
    buttonStart: {
        backgroundColor: '#34A853',
        padding: 16,
        borderRadius: 8,
        flex: 1,
        marginRight: 8,
        alignItems: 'center',
    },
    buttonStop: {
        backgroundColor: '#EA4335',
        padding: 16,
        borderRadius: 8,
        flex: 1,
        marginLeft: 8,
        alignItems: 'center',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    buttonChangeApp: {
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#4285F4',
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 8,
    },
    buttonChangeAppText: {
        color: '#4285F4',
        fontSize: 15,
        fontWeight: '600',
    },
    logoutButton: {
        backgroundColor: '#666',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 32,
    },
    logoutText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    // Mode Selector Styles
    modeSection: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    modeContainer: {
        flexDirection: 'row',
        backgroundColor: '#f1f3f4',
        borderRadius: 8,
        padding: 4,
        marginBottom: 8,
    },
    modeButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 6,
    },
    modeButtonActive: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 2,
    },
    modeLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#666',
    },
    modeLabelActive: {
        color: '#4285F4',
        fontWeight: '700',
    },
    modeDescription: {
        fontSize: 12,
        color: '#888',
        fontStyle: 'italic',
        textAlign: 'center',
    },
    // Language Selector Styles
    languageSection: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    languageRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    languageButton: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#eee',
    },
    languageLabel: {
        fontSize: 12,
        color: '#888',
        marginBottom: 4,
    },
    languageValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    arrow: {
        fontSize: 20,
        marginHorizontal: 12,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 16,
        maxHeight: '50%',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
        color: '#333',
    },
    languageOption: {
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    languageOptionText: {
        fontSize: 16,
        color: '#333',
    },
    checkMark: {
        color: '#4285F4',
        fontSize: 18,
        fontWeight: 'bold',
    },
    closeButtonText: {
        fontSize: 16,
        color: '#333',
        fontWeight: '600',
    },
    // Result Panel Styles
    buttonTest: {
        backgroundColor: '#673AB7',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 12,
    },
    resultPanel: {
        backgroundColor: '#fff',
        marginHorizontal: 20,
        marginBottom: 40,
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 20,
    },
    resultHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        paddingBottom: 10,
    },
    resultTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    closeIcon: {
        fontSize: 24,
        color: '#999',
        padding: 4,
    },
    resultContent: {
        maxHeight: 200,
    },
    translatedTextContent: {
        fontSize: 16,
        lineHeight: 24,
        color: '#444',
    },
    resultFooter: {
        marginTop: 15,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        paddingTop: 10,
    },
    resultMeta: {
        fontSize: 12,
        color: '#888',
        fontStyle: 'italic',
    },
    // Selection Type Styles
    selectionTypeContainer: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    selectionTypeLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        marginBottom: 8,
    },
    selectionTypeRow: {
        flexDirection: 'row',
        gap: 12,
    },
    selectionTypeBtn: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 10,
        backgroundColor: '#f5f5f5',
        borderWidth: 2,
        borderColor: 'transparent',
        alignItems: 'center',
    },
    selectionTypeBtnActive: {
        backgroundColor: '#e3f2fd',
        borderColor: '#2196F3',
    },
    selectionTypeBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
    },
    selectionTypeBtnTextActive: {
        color: '#2196F3',
    },
    selectionTypeHint: {
        fontSize: 12,
        color: '#888',
        marginTop: 10,
        textAlign: 'center',
        fontStyle: 'italic',
    },
});