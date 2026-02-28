import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MonitorSmartphone, CircleDot, X, Play, Square } from 'lucide-react-native';

// ... in the interface
interface CaptureControlsProps {
    isCapturing: boolean;
    permissionGranted: boolean;
    duration: string;
    androidInfo: any;
    onSelectApp: () => void;
    onChangeApp: () => void;
    onStartCapture: () => void;
    onStopCapture: () => void;
    colors: any;
    isDark: boolean;
    selectedApp?: string | null;
}

const CaptureControls: React.FC<CaptureControlsProps> = memo(({
    isCapturing, permissionGranted, duration, androidInfo,
    onSelectApp, onChangeApp, onStartCapture, onStopCapture,
    colors, isDark, selectedApp
}) => {
    const isRunning = isCapturing;
    const isReady = permissionGranted && !isCapturing;
    const isIdle = !permissionGranted && !isCapturing;

    return (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.header}>
                <View style={[styles.iconBox, { backgroundColor: colors.primary + '1A' }]}>
                    <MonitorSmartphone size={16} color={colors.primary} />
                </View>
                <Text style={[styles.title, { color: colors.foreground }]}>Screen Capture</Text>
            </View>

            <View style={styles.content}>
                <View style={[styles.row, { backgroundColor: colors.secondary + '80' }]}>
                    <CircleDot
                        size={16}
                        color={isRunning ? colors.success : isReady ? colors.warning : colors.mutedForeground}
                    />
                    <View style={styles.rowContent}>
                        <View style={styles.rowHeader}>
                            <Text style={[styles.label, { color: colors.mutedForeground }]}>Nguồn</Text>
                            {permissionGranted ? (
                                <View style={styles.sourceBox}>
                                    <Text style={[styles.sourceText, { color: colors.foreground }]}>
                                        {selectedApp || 'Đã cấp quyền'}
                                    </Text>
                                    <TouchableOpacity onPress={onChangeApp}>
                                        <X size={12} color={colors.mutedForeground} />
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <Text style={[styles.statusText, { color: colors.destructive }]}>Chưa chọn</Text>
                            )}
                        </View>
                    </View>
                </View>

                <View style={[styles.row, { backgroundColor: colors.secondary + '80' }]}>
                    <View style={[
                        styles.dot,
                        { backgroundColor: isRunning ? colors.success : isReady ? colors.warning : colors.mutedForeground }
                    ]} />
                    <View style={styles.rowContent}>
                        <View style={styles.rowHeader}>
                            <Text style={[styles.label, { color: colors.mutedForeground }]}>Trạng thái</Text>
                            <Text style={[
                                styles.statusText,
                                { color: isRunning ? colors.success : isReady ? colors.warning : colors.destructive }
                            ]}>
                                {isRunning ? `Đang chạy - ${duration}` : isReady ? 'Sẵn sàng' : 'Đã dừng'}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>

            <View style={styles.actionContainer}>
                {isIdle && (
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
                        onPress={onSelectApp}
                        activeOpacity={0.8}
                    >
                        <CircleDot size={16} color={colors.primaryForeground} />
                        <Text style={[styles.actionBtnText, { color: colors.primaryForeground }]}>
                            {androidInfo?.supportsAppSelection ? 'Chọn App để Capture' : 'Cấp quyền Capture'}
                        </Text>
                    </TouchableOpacity>
                )}

                {isReady && (
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
                        onPress={onStartCapture}
                        activeOpacity={0.8}
                    >
                        <Play size={16} color={colors.primaryForeground} />
                        <Text style={[styles.actionBtnText, { color: colors.primaryForeground }]}>Bắt đầu Capture</Text>
                    </TouchableOpacity>
                )}

                {isRunning && (
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: colors.destructive, shadowColor: colors.destructive }]}
                        onPress={onStopCapture}
                        activeOpacity={0.8}
                    >
                        <Square size={16} color={colors.destructiveForeground} />
                        <Text style={[styles.actionBtnText, { color: colors.destructiveForeground }]}>Dừng Capture</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
});

CaptureControls.displayName = 'CaptureControls';

const styles = StyleSheet.create({
    card: {
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
    },
    iconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 14,
        fontWeight: '600',
    },
    content: {
        gap: 12,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginLeft: 4,
        marginRight: 4,
    },
    rowContent: {
        flex: 1,
    },
    rowHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    label: {
        fontSize: 12,
    },
    sourceBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    sourceText: {
        fontSize: 12,
        fontWeight: '500',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '500',
    },
    actionContainer: {
        marginTop: 16,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 14,
        borderRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    actionBtnText: {
        fontSize: 14,
        fontWeight: '600',
    }
});

export default CaptureControls;
