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
    const [isChangingApp, setIsChangingApp] = useState(false);
    const [duration, setDuration] = useState('00:00');
    const [translationMode, setTranslationMode] = useState('REALTIME'); // 'REALTIME' | 'SELECTION' | 'CAMERA'

    // Language Selection State
    const [sourceLang, setSourceLang] = useState(LANGUAGES.source[0]);
    const [targetLang, setTargetLang] = useState(LANGUAGES.target[0]);
    const [showLanguageModal, setShowLanguageModal] = useState(null); // 'source' | 'target' | null

    const MODES = [
        { id: 'REALTIME', label: '⚡ Realtime', desc: 'Dịch trực tiếp (ML Kit)' },
        { id: 'SELECTION', label: '🖐️ Selection', desc: 'Chọn vùng dịch (Qwen)' },
        { id: 'CAMERA', label: '📷 Camera', desc: 'Dịch qua Camera' },
    ];

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

        // Cleanup on unmount
        return () => {
            unsubscribe();
            screenCaptureService.cleanup();
        };
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

            console.error(`MainScreen: Starting pipelines (Mode: ${translationMode}, Lang: ${sourceLang.code} -> ${targetLang.code})`);

            // Start duration timer
            interval = setInterval(() => {
                setDuration(screenCaptureService.formatDuration());
            }, 1000);

            const script = ['zh', 'ja', 'ko'].includes(sourceLang.code) ? 'chinese' : 'latin';

            if (translationMode === 'REALTIME') {
                console.error('MainScreen: --> Realtime Pipeline Start');
                realtimePipelineService.start({
                    script,
                    sourceLanguage: sourceLang.code,
                    targetLanguage: targetLang.code,
                    debounceMs: 250,
                    maxPendingOCR: 2,
                    maxPendingTranslation: 2,
                });
            } else {
                console.error('MainScreen: --> OCR Pipeline Start (Selection Mode)');
                ocrPipelineService.start(script);
            }
        };

        if (captureState.isCapturing) {
            startPipelines();
        } else {
            realtimePipelineService.stop();
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
                ocrPipelineService.stop();
            }
        };
    }, [captureState.isCapturing, translationMode, sourceLang.code, targetLang.code]);



    const handleLogout = async () => {
        try {
            screenCaptureService.cleanup();
            await auth().signOut();
            if (onLogout) onLogout();
        } catch (error) {
            Alert.alert('Lỗi', 'Không thể đăng xuất');
        }
    };

    // Chọn app để capture
    const handleSelectApp = async (isChanging = false) => {
        try {
            if (isChanging) setIsChangingApp(true);

            const granted = await screenCaptureService.selectApp();

            if (!granted) {
                Alert.alert(
                    'Quyền bị từ chối',
                    isChanging
                        ? 'Bạn đã hủy việc đổi app.'
                        : 'Bạn cần cấp quyền để capture màn hình.',
                    [{ text: 'OK' }]
                );
            } else {
                // Tự động bắt đầu capture sau khi chọn app
                try {
                    await screenCaptureService.startCapture({ intervalMs: 1000 }); // Slower interval for realtime to avoid backlog
                    // Không hiện alert - để user tiếp tục dùng app đã chọn
                } catch (captureError) {
                    Alert.alert('Lỗi', captureError.message || 'Không thể bắt đầu capture');
                }
            }
        } catch (error) {
            const isPermissionDenied = error.message?.includes('PERMISSION_DENIED');
            Alert.alert('Lỗi', isPermissionDenied ? 'Bạn đã hủy việc chọn app.' : error.message);
        } finally {
            setIsChangingApp(false);
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
                    { text: 'Đổi App', onPress: () => handleSelectApp(true) }
                ]
            );
        } else {
            Alert.alert('Không hỗ trợ', 'Cần Android 14+ để chọn app cụ thể.', [{ text: 'OK' }]);
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


    // Destructure state for easier access
    const { isCapturing, permissionGranted, latestFrame, androidInfo } = captureState;

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
                            onPress={() => setTranslationMode(mode.id)}
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


            {/* Screen Capture Controls - Only show for REALTIME or SELECTION */}
            {translationMode !== 'CAMERA' && (
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

                    {/* Loading indicator when changing app */}
                    {isChangingApp && (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color="#4285F4" />
                            <Text style={styles.loadingText}>Đang đổi app...</Text>
                        </View>
                    )}

                    {/* Step 1: Select App Button - Show when no permission */}
                    {!permissionGranted && !isCapturing && !isChangingApp && (
                        <TouchableOpacity
                            style={styles.buttonPrimary}
                            onPress={() => handleSelectApp(false)}
                        >
                            <Text style={styles.buttonText}>
                                {androidInfo?.supportsAppSelection
                                    ? '🎯 Chọn App để Capture'
                                    : '📺 Cấp quyền Capture'}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {/* Step 2: Control Buttons - Show after app selected */}
                    {permissionGranted && !isChangingApp && (
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

            {/* Live Preview */}
            {latestFrame && (
                <View style={styles.framesSection}>
                    <Text style={styles.sectionTitle}>📺 Live Preview</Text>
                    <View style={styles.previewContainer}>
                        <Image
                            key={latestFrame.timestamp}
                            source={{ uri: `file://${latestFrame.path}?t=${latestFrame.timestamp}` }}
                            style={styles.livePreviewImage}
                            resizeMode="contain"
                        />
                        <View style={styles.previewOverlay}>
                            <View style={styles.liveIndicator}>
                                <View style={styles.liveDot} />
                                <Text style={styles.liveText}>LIVE</Text>
                            </View>
                        </View>
                    </View>
                    <Text style={styles.timestampText}>
                        🕐 Cập nhật: {new Date(latestFrame.timestamp).toLocaleTimeString('vi-VN')}
                    </Text>
                    <Text style={styles.infoTextSmall}>
                        💡 Preview tự động cập nhật khi nội dung thay đổi
                    </Text>
                </View>
            )}

            {/* Logout Button */}
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutText}>🚪 Đăng xuất</Text>
            </TouchableOpacity>

            {renderLanguageModal()}
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
    framesSection: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    previewContainer: {
        position: 'relative',
    },
    previewOverlay: {
        position: 'absolute',
        top: 8,
        right: 8,
    },
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(234, 67, 53, 0.9)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#fff',
        marginRight: 4,
    },
    liveText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    livePreviewImage: {
        width: '100%',
        height: 400,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#4285F4',
        backgroundColor: '#000',
    },
    timestampText: {
        fontSize: 12,
        color: '#888',
        textAlign: 'center',
        marginTop: 8,
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
    closeButton: {
        marginTop: 16,
        backgroundColor: '#f1f3f4',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    closeButtonText: {
        fontSize: 16,
        color: '#333',
        fontWeight: '600',
    },
});