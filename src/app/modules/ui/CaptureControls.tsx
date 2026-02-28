import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSettings } from '../settings/SettingsContext';

interface CaptureControlsProps {
    isCapturing: boolean;
    permissionGranted: boolean;
    duration: string;
    androidInfo: any;
    onSelectApp: () => void;
    onChangeApp: () => void;
    colors: {
        card: string;
        text: string;
        subtext: string;
    };
    isDark: boolean;
}

const CaptureControls: React.FC<CaptureControlsProps> = memo(({
    isCapturing,
    permissionGranted,
    duration,
    androidInfo,
    onSelectApp,
    onChangeApp,
    colors,
    isDark
}) => {
    const { t } = useSettings();

    return (
        <View style={[styles.captureSection, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('main.screenCapture')}</Text>

            <View style={[styles.statusContainer, { backgroundColor: isDark ? '#1a1a2e' : '#f8f9fa' }]}>
                <View style={styles.statusRow}>
                    <Text style={[styles.statusLabel, { color: colors.subtext }]}>{t('main.captureSource')}</Text>
                    <Text style={[
                        styles.statusValue,
                        permissionGranted ? styles.statusSuccess : styles.statusError
                    ]}>
                        {permissionGranted ? t('main.selected') : t('main.notSelected')}
                    </Text>
                </View>
                <View style={styles.statusRow}>
                    <Text style={[styles.statusLabel, { color: colors.subtext }]}>{t('main.captureStatus')}</Text>
                    <View style={styles.statusValueContainer}>
                        {isCapturing && <View style={styles.pulsingDot} />}
                        <Text style={[
                            styles.statusValue,
                            isCapturing ? styles.statusSuccess : styles.statusError
                        ]}>
                            {isCapturing ? t('main.capturing') : t('main.stopped')}
                        </Text>
                    </View>
                </View>
                {isCapturing && (
                    <View style={styles.statusRow}>
                        <Text style={[styles.statusLabel, { color: colors.subtext }]}>{t('main.captureTime')}</Text>
                        <Text style={styles.statusValue}>⏱️ {duration}</Text>
                    </View>
                )}
            </View>

            {!permissionGranted && !isCapturing && (
                <TouchableOpacity
                    style={styles.buttonPrimary}
                    onPress={onSelectApp}
                >
                    <Text style={styles.buttonText}>
                        {androidInfo?.supportsAppSelection
                            ? t('main.selectApp')
                            : t('main.grantPermission')}
                    </Text>
                </TouchableOpacity>
            )}

            {permissionGranted && androidInfo?.supportsAppSelection && (
                <TouchableOpacity
                    style={styles.buttonChangeApp}
                    onPress={onChangeApp}
                >
                    <Text style={styles.buttonChangeAppText}>
                        {t('main.changeApp')}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
});

CaptureControls.displayName = 'CaptureControls';

const styles = StyleSheet.create({
    captureSection: { padding: 16, borderRadius: 12, marginBottom: 16 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
    statusContainer: { borderRadius: 8, padding: 12, marginBottom: 12 },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    statusLabel: { fontSize: 14, width: 80 },
    statusValue: { fontSize: 14, fontWeight: '600' },
    statusValueContainer: { flexDirection: 'row', alignItems: 'center' },
    statusSuccess: { color: '#34A853' },
    statusError: { color: '#EA4335' },
    pulsingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34A853', marginRight: 6 },
    buttonPrimary: { backgroundColor: '#4285F4', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 12 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    buttonChangeApp: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#4285F4', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
    buttonChangeAppText: { color: '#4285F4', fontSize: 15, fontWeight: '600' },
});

export default CaptureControls;
