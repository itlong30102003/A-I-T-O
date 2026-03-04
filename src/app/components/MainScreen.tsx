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
    StyleSheet,
    ScrollView,
    Alert,
} from 'react-native';

// Core module imports
import { LANGUAGES, MODES, TranslationMode, SelectionType, LanguageItem } from '../modules/core';
import { useAuth } from '../modules/core/hooks/useAuth';
import { useCaptureState } from '../modules/core/hooks/useCaptureState';

// UI module imports
import {
    LanguageModal,
    DeviceInfoSection,
    UserHeader,
    ModeSelector,
    CaptureControls,
    TranslationResultModal,
    AppHeader,
    LanguageSelector
} from '../modules/ui';
import { getTheme } from '../modules/ui/theme';

// Selection module imports
import SelectionTypeSelector from '../modules/selection/SelectionTypeSelector';
import HistoryList from '../modules/selection/HistoryList';

// Settings module imports
import { useSettings } from '../modules/settings/SettingsContext';
import SettingsScreen from '../modules/settings/SettingsScreen';

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
    const settings = useSettings();
    const { t, overlayStyle, overlayTextSize, theme } = settings;
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
    const [showSettings, setShowSettings] = useState(false);
    const [isRealtimeActive, setIsRealtimeActive] = useState(false);

    // Theme colors
    const isDark = theme === 'dark';
    const colors = useMemo(() => getTheme(isDark), [isDark]);

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
        if (modeId === 'RESOURCE') {
            Alert.alert(
                'Tính năng sắp ra mắt',
                'Tính năng dịch tài liệu (PDF, Word, Ảnh) đang được phát triển và sẽ cập nhật trong phiên bản tới.'
            );
            return;
        }
        if (modeId === 'CAMERA') {
            setShowCameraScreen(true);
        } else {
            setTranslationMode(modeId);
            setShowCameraScreen(false);
        }
    }, [t]);

    // Handle logout - useCallback
    const handleLogout = useCallback(async () => {
        try {
            screenCaptureService.cleanup();
            await logout();
            if (onLogout) onLogout();
        } catch (error) {
            console.error(t('main.error'), ':', t('main.logoutError'), error);
        }
    }, [logout, onLogout, t]);

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
        const unsubsLanguageSelected = overlayService.onLanguageSelected((isSource, code) => {
            console.log('MainScreen: onLanguageSelected', isSource, code);
            const langList = isSource ? LANGUAGES.source : LANGUAGES.target;
            const selectedLang = langList.find(l => l.code === code);
            if (selectedLang) {
                if (isSource) {
                    setSourceLang(selectedLang);
                } else {
                    setTargetLang(selectedLang);
                }
            }
        });

        const unsubsTranslate = overlayService.onTranslateClick(() => {
            if (translationMode === 'SELECTION') {
                console.log('MainScreen: Selection trigger clicked');
                selectionPipelineService.toggleOverlay();
            } else {
                const isAuto = realtimePipelineService.getAutoMode();
                if (isAuto) {
                    // Auto mode: toggle Start/Stop via React state
                    setIsRealtimeActive(prev => {
                        const next = !prev;
                        console.log(`MainScreen: ${next ? 'Start' : 'Stop'} auto translation`);
                        overlayService.setTranslating(next);
                        return next;
                    });
                } else {
                    // Manual mode: trigger one-shot translate
                    console.log('MainScreen: Manual translate triggered');
                    realtimePipelineService.triggerManualTranslate();
                }
            }
        });

        const unsubsAutoMode = overlayService.onAutoModeClick(() => {
            if (translationMode === 'SELECTION') {
                // Toggle between Word and Paragraph in Selection mode
                setSelectionType(prev => {
                    const newType = prev === 'WORD' ? 'PARAGRAPH' : 'WORD';
                    console.log('MainScreen: Selection Type toggled to', newType);
                    selectionPipelineService.setSelectionType(newType);
                    // Sync native UI (true = WORD, false = PARAGRAPH)
                    overlayService.setAutoMode(newType === 'WORD');
                    return newType;
                });
            } else {
                const newMode = !realtimePipelineService.getAutoMode();
                console.log('MainScreen: AutoMode toggled to', newMode ? 'AUTO' : 'MANUAL');
                realtimePipelineService.setAutoMode(newMode);
                // Reset overlay state — keep pipeline running so frames are still received
                setIsRealtimeActive(false);
                realtimePipelineService.setOverlayEnabled(false);
                overlayService.setTranslating(false);
                overlayService.hideTranslation();
            }
        });

        const unsubsClose = overlayService.onCloseClick(() => {
            console.log('MainScreen: Close button clicked - stopping everything');
            setIsRealtimeActive(false);
            realtimePipelineService.stop();
            selectionPipelineService.stop();
            ocrPipelineService.stop();
            overlayService.stop();
            handleStopCapture();
        });

        return () => {
            unsubsLanguageSelected();
            unsubsTranslate();
            unsubsAutoMode();
            unsubsClose();
        };
    }, [translationMode, handleStopCapture]);

    // No auto-start Selection Mode -> User must press start in CaptureControls


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

    // Pipeline management — setup overlay + auto-start pipeline (pre-warm)
    useEffect(() => {
        console.log(`MainScreen: [PIPELINE-EFFECT] isCapturing: ${captureState.isCapturing} | mode: ${translationMode}`);
        if (!captureState.isCapturing) {
            console.log('MainScreen: [PIPELINE-EFFECT] Not capturing, stopping all');
            realtimePipelineService.stop();
            selectionPipelineService.stop();
            ocrPipelineService.stop();
            overlayService.stop();
            setIsRealtimeActive(false);
            return;
        }

        const startPipelines = async () => {
            console.log(`MainScreen: [PIPELINE-EFFECT] Starting pipelines (Mode: ${translationMode})`);
            const script = ['zh', 'ja', 'ko'].includes(sourceLang.code) ? 'chinese' : 'latin';

            console.log('MainScreen: [PIPELINE-EFFECT] Calling overlayService.startImmediate...');
            overlayService.startImmediate('[]');
            console.log('MainScreen: [PIPELINE-EFFECT] overlayService.startImmediate done');

            if (translationMode === 'REALTIME') {
                console.log('MainScreen: [PIPELINE-EFFECT] REALTIME branch — setting up navbar + starting pipeline');
                overlayService.setNavbarConfig(translationMode, sourceLang.label, targetLang.label);
                overlayService.showNavbar();

                realtimePipelineService.start({
                    script,
                    sourceLanguage: sourceLang.code,
                    targetLanguage: targetLang.code,
                });
                realtimePipelineService.setOverlayEnabled(false);
                overlayService.setTranslating(false);
                console.log('MainScreen: [PIPELINE-EFFECT] REALTIME pipeline started, overlay disabled, waiting for Start');
            } else if (translationMode === 'SELECTION') {
                overlayService.setNavbarConfig(translationMode, sourceLang.label, targetLang.label);
                // Set initial AutoMode true for WORD, false for PARAGRAPH
                overlayService.setAutoMode(selectionType === 'WORD');
                overlayService.showNavbar();
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

    // Realtime overlay toggle — driven by navbar Start/Stop button
    useEffect(() => {
        if (!captureState.isCapturing || translationMode !== 'REALTIME') return;

        realtimePipelineService.setOverlayEnabled(isRealtimeActive);
        overlayService.setTranslating(isRealtimeActive);
    }, [isRealtimeActive]);

    // Sync overlay style & text size to native
    useEffect(() => {
        overlayService.setOverlayStyle(overlayStyle);
    }, [overlayStyle]);

    useEffect(() => {
        overlayService.setOverlayTextSize(overlayTextSize);
    }, [overlayTextSize]);

    // Sync navbar config
    useEffect(() => {
        overlayService.setNavbarConfig(translationMode, sourceLang.label, targetLang.label);
        if (translationMode === 'SELECTION') {
            overlayService.setAutoMode(selectionType === 'WORD');
        } else {
            overlayService.setAutoMode(realtimePipelineService.getAutoMode());
        }
    }, [translationMode, sourceLang.label, targetLang.label, selectionType]);

    // Destructure state
    const { isCapturing, permissionGranted, androidInfo } = captureState;

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

    // Early return for Settings
    if (showSettings) {
        return <SettingsScreen onBack={() => setShowSettings(false)} />;
    }
    return (
        <View style={{ flex: 1 }}>
            <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: 40 }}>
                <AppHeader colors={colors} />

                <UserHeader
                    colors={colors}
                    onSettingsPress={() => setShowSettings(true)}
                    onLogoutPress={handleLogout}
                />

                <DeviceInfoSection
                    androidInfo={androidInfo}
                    modelStatus={modelLoadingStatus}
                    colors={colors}
                />

                <ModeSelector
                    translationMode={translationMode}
                    onModeChange={handleModeChange}
                    colors={colors}
                >
                    {translationMode === 'SELECTION' && (
                        <>
                            <SelectionTypeSelector
                                selectionType={selectionType}
                                onTypeChange={setSelectionType}
                            />
                            <HistoryList strategy={selectionType} />
                        </>
                    )}
                </ModeSelector>

                <LanguageSelector
                    sourceLang={sourceLang}
                    targetLang={targetLang}
                    onSourcePress={() => setShowLanguageModal('source')}
                    onTargetPress={() => setShowLanguageModal('target')}
                    onSwap={() => {
                        if (sourceLang.code !== 'auto') {
                            setSourceLang(targetLang);
                            setTargetLang(sourceLang);
                        }
                    }}
                    colors={colors}
                />

                {(translationMode === 'REALTIME' || translationMode === 'SELECTION') && (
                    <CaptureControls
                        isCapturing={isCapturing}
                        permissionGranted={permissionGranted}
                        duration={duration}
                        androidInfo={androidInfo}
                        onSelectApp={handleSelectApp}
                        onChangeApp={handleChangeApp}
                        onStartCapture={handleStartCapture}
                        onStopCapture={handleStopCapture}
                        colors={colors}
                        isDark={isDark}
                        selectedApp={null}
                    />
                )}
            </ScrollView>

            <LanguageModal
                visible={!!showLanguageModal}
                type={showLanguageModal}
                currentSourceLang={sourceLang}
                currentTargetLang={targetLang}
                onSelect={handleLanguageSelect}
                onClose={() => setShowLanguageModal(null)}
            />

            {/* Result Modal */}
            <TranslationResultModal
                visible={showResultModal}
                selectedText={selectedText}
                onClose={() => setShowResultModal(false)}
                colors={colors}
                isDark={isDark}
            />


        </View>
    );
});

MainScreen.displayName = 'MainScreen';

// Styles - Kept from original for consistency
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12 },
    languageSection: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 16 },
    languageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    languageButton: { flex: 1, backgroundColor: '#f8f9fa', padding: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#eee' },
    languageLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
    languageValue: { fontSize: 16, fontWeight: '600', color: '#333' },
    arrow: { fontSize: 20, marginHorizontal: 12 },
    logoutButton: { backgroundColor: '#666', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 32 },
    logoutText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    tabBar: { flexDirection: 'row', height: 60, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', paddingBottom: 5 },
    tabItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    tabItemActive: { borderTopWidth: 2, borderTopColor: '#4285F4' },
    tabLabel: { fontSize: 12, color: '#666', marginTop: 4 },
    tabLabelActive: { color: '#4285F4', fontWeight: 'bold' },
    modeSectionHeader: { position: 'absolute', top: 16, left: 16 },
    backButton: { backgroundColor: 'rgba(255,255,255,0.9)', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
    backButtonText: { fontSize: 14, fontWeight: 'bold', color: '#4285F4' },
    settingsBtn: { padding: 8, borderRadius: 8 },
});

export default MainScreen;
