import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface AndroidInfo {
    androidVersion?: string;
    sdkVersion?: number;
    supportsAppSelection?: boolean;
}

interface DeviceInfoSectionProps {
    androidInfo: AndroidInfo | null;
}

/**
 * Device information display section.
 * Uses React.memo to prevent unnecessary re-renders.
 */
const DeviceInfoSection: React.FC<DeviceInfoSectionProps> = memo(({ androidInfo }) => {
    return (
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
    );
});

DeviceInfoSection.displayName = 'DeviceInfoSection';

const styles = StyleSheet.create({
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
    },
    infoTextSmall: {
        fontSize: 12,
        color: '#999',
        fontStyle: 'italic',
    },
});

export default DeviceInfoSection;
