import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Alert,
    StyleSheet,
    ScrollView,
    Image,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import ScreenCapture from '../native/ScreenCapture';

export default function MainScreen({ onLogout }) {
    const [user, setUser] = useState(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [latestFrame, setLatestFrame] = useState(null); // Single latest frame for live preview
    const [androidInfo, setAndroidInfo] = useState(null);
    const [permissionGranted, setPermissionGranted] = useState(false);

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

        // Get Android version info
        ScreenCapture.getAndroidVersion().then(info => {
            setAndroidInfo(info);
        });

        // Cleanup on unmount
        return () => {
            ScreenCapture.stopCapture().catch(() => { });
        };
    }, []);

    const handleLogout = async () => {
        try {
            await ScreenCapture.stopCapture();
            await auth().signOut();
            if (onLogout) onLogout();
        } catch (error) {
            Alert.alert('Lỗi', 'Không thể đăng xuất');
        }
    };

    // Step 1: Select app to capture (shows Android dialog)
    const handleSelectApp = async () => {
        try {
            const granted = await ScreenCapture.requestPermission();
            if (!granted) {
                Alert.alert('Thông báo', 'Bạn đã từ chối cấp quyền');
                return;
            }
            setPermissionGranted(true);
            Alert.alert('Thành công', 'Đã chọn nguồn capture! Nhấn "Bắt đầu" để xem live preview.');
        } catch (error) {
            Alert.alert('Lỗi', error.message || 'Không thể chọn app');
        }
    };

    // Step 2: Start capture after app is selected
    const handleStartCapture = async () => {
        if (!permissionGranted) {
            Alert.alert('Thông báo', 'Vui lòng chọn app trước!');
            return;
        }

        try {
            // Subscribe to frame events - update live preview
            const subscription = ScreenCapture.onFrameCaptured((event) => {
                console.log('Frame captured:', event.imagePath);
                setLatestFrame({
                    path: event.imagePath,
                    timestamp: Date.now()
                });
            });

            // Start capturing
            await ScreenCapture.startCapture({ intervalMs: 500 });
            setIsCapturing(true);

        } catch (error) {
            Alert.alert('Lỗi', error.message || 'Không thể bắt đầu capture');
        }
    };

    const handleStopCapture = async () => {
        try {
            await ScreenCapture.stopCapture();
            setIsCapturing(false);
            setLatestFrame(null);
            // Reset permission so user can select different app next time
            setPermissionGranted(false);
        } catch (error) {
            Alert.alert('Lỗi', error.message || 'Không thể dừng capture');
        }
    };

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
                <Text style={styles.infoText}>
                    Android SDK: {androidInfo?.sdkVersion || 'Loading...'}
                </Text>
                <Text style={styles.infoText}>
                    Hỗ trợ chọn App: {androidInfo?.supportsAppSelection ? '✅ Có (Android 14+)' : '❌ Không'}
                </Text>
            </View>

            {/* Screen Capture Controls */}
            <View style={styles.captureSection}>
                <Text style={styles.sectionTitle}>🎥 Screen Capture</Text>

                <Text style={styles.statusText}>
                    Nguồn: {permissionGranted ? '✅ Đã chọn' : '❌ Chưa chọn app'}
                </Text>
                <Text style={styles.statusText}>
                    Trạng thái: {isCapturing ? '🟢 Đang capture' : '🔴 Đã dừng'}
                </Text>

                {/* Step 1: Select App Button */}
                {!permissionGranted && !isCapturing && (
                    <TouchableOpacity
                        style={styles.buttonPrimary}
                        onPress={handleSelectApp}
                    >
                        <Text style={styles.buttonText}>📱 Chọn App để Capture</Text>
                    </TouchableOpacity>
                )}

                {/* Step 2: Start/Stop Buttons - Only show after app selected */}
                {permissionGranted && (
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
                )}
            </View>

            {/* Live Preview - Updates every second */}
            {latestFrame && (
                <View style={styles.framesSection}>
                    <Text style={styles.sectionTitle}>📺 Live Preview</Text>
                    <Image
                        key={latestFrame.timestamp}
                        source={{ uri: `file://${latestFrame.path}?t=${latestFrame.timestamp}` }}
                        style={styles.livePreviewImage}
                        resizeMode="contain"
                    />
                    <Text style={styles.timestampText}>
                        Cập nhật: {new Date(latestFrame.timestamp).toLocaleTimeString()}
                    </Text>
                </View>
            )}

            {/* Logout Button */}
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutText}>🚪 Đăng xuất</Text>
            </TouchableOpacity>
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
    captureSection: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    statusText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8,
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
    framesSection: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    frameImage: {
        width: 150,
        height: 250,
        marginRight: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ddd',
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
});