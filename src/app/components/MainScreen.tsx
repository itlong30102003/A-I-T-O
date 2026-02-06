/**
 * MainScreen - Refactored as Coordinator
 * 
 * This file now only orchestrates the display of modules based on app state.
 * All business logic has been extracted to:
 * - modules/core: AppContext, constants, hooks
 * - modules/ui: Reusable UI components
 * - modules/selection: Selection mode components
 * 
 * Safety: Business logic preserved, only structural refactoring.
 */
import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Alert,
    StyleSheet,
    ScrollView,
    Modal,
} from 'react-native';

// Core module imports
import { LANGUAGES, MODES, TranslationMode, SelectionType, LanguageItem } from '../modules/core';
import { useAuth } from '../modules/core/hooks/useAuth';
import { useCaptureState } from '../modules/core/hooks/useCaptureState';

// UI module imports
import { LanguageModal, DeviceInfoSection, ModelLoadingCard } from '../modules/ui';

// Selection module imports
import { SelectionTypeSelector } from '../modules/selection';

// Services (unchanged - preserving business logic)
import { screenCaptureService } from '../services/ScreenCaptureService';
import { ocrPipelineService } from '../services/OCRPipelineService';
import { overlayService } from '../services/OverlayService';
import { realtimePipelineService } from '../services/RealtimePipelineService';
import { selectionPipelineService } from '../services/SelectionPipelineService';
import { mlKitTranslationService } from '../services/MLKitTranslationService';
import LiveTranslationScreen from '../screens/LiveTranslationScreen';
import ResourceScreen from '../screens/ResourceScreen';

interface MainScreenProps {
    onLogout?: () => void;
}

/**
 * MainScreen Coordinator Component
 * Uses React.memo for optimization
 */
const MainScreen: React.FC<MainScreenProps> = memo(({ onLogout }) => {
    // Hooks
    const { user, logout } = useAuth();
    const {
        captureState,
        duration,
        handleSelectApp,
        handleSelectEntireScreen,
        handleStartCapture,
        handleStopCapture,
        handleChangeApp,
    } = useCaptureState();

    // Local state
    const [translationMode, setTranslationMode] = useState<TranslationMode>('REALTIME');
    const [selectionType, setSelectionType] = useState<SelectionType>('WORD');
    const [sourceLang, setSourceLang] = useState<LanguageItem>(LANGUAGES.source[0]);
    const [targetLang, setTargetLang] = useState<LanguageItem>(LANGUAGES.target[0]);
    const [showCameraScreen, setShowCameraScreen] = useState(false);
    const [showLanguageModal, setShowLanguageModal] = useState<'source' | 'target' | null>(null);
    const [showResultModal, setShowResultModal] = useState(false);
    const [selectedText, setSelectedText] = useState('Nội dung sẽ được dịch ở đây...');

    // Model Loading State
    const [modelLoadingStatus, setModelLoadingStatus] = useState({
        isLoading: false,
        loaded: mlKitTranslationService.modelsLoaded,
        progress: 0,
        total: 4,
        models: [],
    });

    // Handle mode change - useCallback for optimization
    const handleModeChange = useCallback((modeId: TranslationMode) => {
        if (modeId === 'CAMERA') {
            setShowCameraScreen(true);
        } else {
            setTranslationMode(modeId);
            setShowCameraScreen(false);
        }
    }, []);

    // Handle logout - useCallback
    const handleLogout = useCallback(async () => {
        try {
            screenCaptureService.cleanup();
            await logout();
            if (onLogout) onLogout();
        } catch (error) {
            Alert.alert('Lỗi', 'Không thể đăng xuất');
        }
    }, [logout, onLogout]);

    // Handle language selection
    const handleLanguageSelect = useCallback((lang: LanguageItem) => {
        if (showLanguageModal === 'source') {
            setSourceLang(lang);
        } else {
            setTargetLang(lang);
        }
    }, [showLanguageModal]);

    // Subscribe to overlay events
    useEffect(() => {
        const unsubsLogo = overlayService.onLogoClick(() => {
            console.log('MainScreen: Logo clicked, current mode:', translationMode);
            if (translationMode === 'SELECTION') {
                selectionPipelineService.toggleOverlay();
            } else {
                overlayService.toggleNavbar();
            }
        });

        const unsubsSourceLang = overlayService.onSourceLangClick(() => {
            setShowLanguageModal('source');
        });

        const unsubsTargetLang = overlayService.onTargetLangClick(() => {
            setShowLanguageModal('target');
        });

        return () => {
            unsubsLogo();
            unsubsSourceLang();
            unsubsTargetLang();
        };
    }, [translationMode]);

    // Auto-start Selection Mode
    useEffect(() => {
        if (translationMode !== 'SELECTION') return;
        if (captureState.isCapturing || captureState.permissionGranted) return;

        console.log('MainScreen: Auto-starting Selection Mode...');
        handleSelectEntireScreen();
    }, [translationMode, captureState.isCapturing, captureState.permissionGranted, handleSelectEntireScreen]);

    // Preload ML Kit models
    useEffect(() => {
        const unsubscribe = mlKitTranslationService.onStatusChange((status: any) => {
            setModelLoadingStatus(status);
        });

        if (!mlKitTranslationService.modelsLoaded && !mlKitTranslationService.isModelLoading) {
            console.log('MainScreen: Starting ML Kit model preload...');
            mlKitTranslationService.preloadModels().catch((err: Error) => {
                console.warn('MainScreen: Model preload failed:', err);
            });
        }

        return () => unsubscribe();
    }, []);

    // Pipeline management
    useEffect(() => {
        if (!captureState.isCapturing) {
            realtimePipelineService.stop();
            selectionPipelineService.stop();
            ocrPipelineService.stop();
            overlayService.stop();
            return;
        }

        const startPipelines = async () => {
            console.log(`MainScreen: Starting pipelines (Mode: ${translationMode})`);
            const script = ['zh', 'ja', 'ko'].includes(sourceLang.code) ? 'chinese' : 'latin';

            await overlayService.start('[]');
            overlayService.showLogo();
            overlayService.setNavbarConfig(translationMode, sourceLang.label, targetLang.label);

            if (translationMode === 'REALTIME') {
                realtimePipelineService.start({
                    script,
                    sourceLanguage: sourceLang.code,
                    targetLanguage: targetLang.code,
                });
            } else if (translationMode === 'SELECTION') {
                selectionPipelineService.start(selectionType, {
                    sourceLanguage: sourceLang.code,
                    targetLanguage: targetLang.code,
                    script,
                });
            } else {
                ocrPipelineService.start(script);
            }
        };

        startPipelines();

        return () => {
            if (!screenCaptureService.state.isCapturing) {
                realtimePipelineService.stop();
                selectionPipelineService.stop();
                ocrPipelineService.stop();
            }
        };
    }, [captureState.isCapturing, translationMode, selectionType, sourceLang, targetLang]);

    // Sync navbar config
    useEffect(() => {
        overlayService.setNavbarConfig(translationMode, sourceLang.label, targetLang.label);
    }, [translationMode, sourceLang.label, targetLang.label]);

    // Destructure state
    const { isCapturing, permissionGranted, androidInfo } = captureState;

    // Memoize current mode description
    const currentModeDesc = useMemo(() => {
        return MODES.find(m => m.id === translationMode)?.desc || '';
    }, [translationMode]);

    // Early return for Camera mode
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
        <View style={{ flex: 1 }}>
            <ScrollView style={styles.container}>
                {/* User Info */}
                <View style={styles.userSection}>
                    <Text style={styles.userName}>
                        {user?.displayName || user?.email || 'Chưa có tên'}
                    </Text>
                    <Text style={styles.userEmail}>{user?.email}</Text>
                </View>

                {/* Device Info - Using extracted component */}
                <DeviceInfoSection androidInfo={androidInfo} />

                {/* Model Loading - Using extracted component */}
                <ModelLoadingCard status={modelLoadingStatus} />

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
                                onPress={() => handleModeChange(mode.id as TranslationMode)}
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
                    <Text style={styles.modeDescription}>{currentModeDesc}</Text>

                    {/* Selection Type - Using extracted component */}
                    {translationMode === 'SELECTION' && (
                        <SelectionTypeSelector
                            selectionType={selectionType}
                            onTypeChange={setSelectionType}
                        />
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
                            <Text style={styles.languageLabel}>Nguồn</Text>
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

                {/* Screen Capture Controls - Only for REALTIME mode */}
                {translationMode === 'REALTIME' && (
                    <View style={styles.captureSection}>
                        <Text style={styles.sectionTitle}>🎥 Screen Capture</Text>

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
            </ScrollView>

            {/* Language Modal - Using extracted component */}
            <LanguageModal
                visible={!!showLanguageModal}
                type={showLanguageModal}
                currentSourceLang={sourceLang}
                currentTargetLang={targetLang}
                onSelect={handleLanguageSelect}
                onClose={() => setShowLanguageModal(null)}
            />

            {/* Result Modal */}
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


        </View>
    );
});

MainScreen.displayName = 'MainScreen';

// Styles - Kept from original for consistency
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
    userSection: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 16, alignItems: 'center' },
    userName: { fontSize: 20, fontWeight: 'bold', color: '#333' },
    userEmail: { fontSize: 14, color: '#666', marginTop: 4 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12 },
    modeSection: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 16 },
    modeContainer: { flexDirection: 'row', backgroundColor: '#f1f3f4', borderRadius: 8, padding: 4, marginBottom: 8 },
    modeButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
    modeButtonActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1, elevation: 2 },
    modeLabel: { fontSize: 13, fontWeight: '600', color: '#666' },
    modeLabelActive: { color: '#4285F4', fontWeight: '700' },
    modeDescription: { fontSize: 12, color: '#888', fontStyle: 'italic', textAlign: 'center' },
    languageSection: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 16 },
    languageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    languageButton: { flex: 1, backgroundColor: '#f8f9fa', padding: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#eee' },
    languageLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
    languageValue: { fontSize: 16, fontWeight: '600', color: '#333' },
    arrow: { fontSize: 20, marginHorizontal: 12 },
    captureSection: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 16 },
    statusContainer: { backgroundColor: '#f8f9fa', borderRadius: 8, padding: 12, marginBottom: 12 },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    statusLabel: { fontSize: 14, color: '#666', width: 80 },
    statusValue: { fontSize: 14, fontWeight: '600', color: '#333' },
    statusValueContainer: { flexDirection: 'row', alignItems: 'center' },
    statusSuccess: { color: '#34A853' },
    statusError: { color: '#EA4335' },
    pulsingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34A853', marginRight: 6 },
    buttonPrimary: { backgroundColor: '#4285F4', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 12 },
    buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
    buttonStart: { backgroundColor: '#34A853', padding: 16, borderRadius: 8, flex: 1, marginRight: 8, alignItems: 'center' },
    buttonStop: { backgroundColor: '#EA4335', padding: 16, borderRadius: 8, flex: 1, marginLeft: 8, alignItems: 'center' },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    buttonChangeApp: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#4285F4', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
    buttonChangeAppText: { color: '#4285F4', fontSize: 15, fontWeight: '600' },
    logoutButton: { backgroundColor: '#666', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 32 },
    logoutText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    resultPanel: { backgroundColor: '#fff', marginHorizontal: 20, marginBottom: 40, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 20 },
    resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 10 },
    resultTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
    closeIcon: { fontSize: 24, color: '#999', padding: 4 },
    resultContent: { maxHeight: 200 },
    translatedTextContent: { fontSize: 16, lineHeight: 24, color: '#444' },
    resultFooter: { marginTop: 15, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 10 },
    resultMeta: { fontSize: 12, color: '#888', fontStyle: 'italic' },
    tabBar: { flexDirection: 'row', height: 60, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', paddingBottom: 5 },
    tabItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    tabItemActive: { borderTopWidth: 2, borderTopColor: '#4285F4' },
    tabLabel: { fontSize: 12, color: '#666', marginTop: 4 },
    tabLabelActive: { color: '#4285F4', fontWeight: 'bold' },
    modeSectionHeader: { position: 'absolute', top: 16, left: 16 },
    backButton: { backgroundColor: 'rgba(255,255,255,0.9)', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
    backButtonText: { fontSize: 14, fontWeight: 'bold', color: '#4285F4' },
});

export default MainScreen;
