import React, { memo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Smartphone, Cpu, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';

const CircularProgress = ({ progress, size = 16, strokeWidth = 2, color = '#fff', trackColor = '#eee' }: any) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = Math.max(0, circumference - (Math.max(0, Math.min(100, progress)) / 100) * circumference);

    return (
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center', transform: [{ rotate: '-90deg' }] }}>
            <Svg width={size} height={size}>
                <Circle
                    stroke={trackColor}
                    fill="none"
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    strokeWidth={strokeWidth}
                />
                <Circle
                    stroke={color}
                    fill="none"
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                />
            </Svg>
        </View>
    );
};

interface AndroidInfo {
    androidVersion?: string;
    sdkVersion?: number;
    supportsAppSelection?: boolean;
}

interface ModelStatus {
    id: string;
    name: string;
    emoji: string;
    status: 'pending' | 'downloading' | 'completed' | 'failed';
    progress: number;
    error?: string;
}

interface ModelLoadingStatus {
    isLoading: boolean;
    loaded: boolean;
    progress: number;
    total: number;
    models?: ModelStatus[];
}

interface DeviceInfoSectionProps {
    androidInfo: AndroidInfo | null;
    modelStatus: ModelLoadingStatus;
    colors: any;
}

const DeviceInfoSection: React.FC<DeviceInfoSectionProps> = memo(({ androidInfo, modelStatus, colors }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Calculate model loading progress
    const readyModels = modelStatus.models?.filter(m => m.status === 'completed').length || 0;
    const totalModels = modelStatus.total || 4;
    const isAllReady = modelStatus.loaded || readyModels === totalModels;
    const progressPercent = Math.max(0, Math.min(100, (readyModels / totalModels) * 100));

    return (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
                style={styles.header}
                onPress={() => setIsExpanded(!isExpanded)}
                activeOpacity={0.7}
            >
                <View style={styles.headerLeft}>
                    <View style={[styles.iconBox, { backgroundColor: colors.accent + '1A' }]}>
                        <Smartphone size={16} color={colors.accent} />
                    </View>
                    <Text style={[styles.title, { color: colors.foreground }]}>Thiết bị</Text>
                </View>
                {isExpanded ? (
                    <ChevronUp size={20} color={colors.mutedForeground} />
                ) : (
                    <ChevronDown size={20} color={colors.mutedForeground} />
                )}
            </TouchableOpacity>

            {isExpanded && (
                <View style={styles.content}>
                    <View style={[styles.row, { backgroundColor: colors.secondary + '80' }]}>
                        <Cpu size={16} color={colors.mutedForeground} />
                        <View style={styles.rowTextContainer}>
                            <Text style={[styles.label, { color: colors.mutedForeground }]}>Hệ điều hành</Text>
                            <Text style={[styles.value, { color: colors.foreground }]}>
                                {androidInfo ? `Android ${androidInfo.androidVersion || 'N/A'} (API ${androidInfo.sdkVersion})` : 'Đang tải...'}
                            </Text>
                        </View>
                    </View>

                    <View style={[styles.row, { backgroundColor: colors.secondary + '80' }]}>
                        {androidInfo?.supportsAppSelection ? (
                            <CheckCircle2 size={16} color={colors.success} />
                        ) : (
                            <AlertCircle size={16} color={colors.warning} />
                        )}
                        <View style={styles.rowTextContainer}>
                            <Text style={[styles.label, { color: colors.mutedForeground }]}>
                                {androidInfo?.supportsAppSelection ? 'Hỗ trợ App cụ thể (Android 14+)' : 'Chế độ Full Screen (Android < 14)'}
                            </Text>
                            {androidInfo?.supportsAppSelection && (
                                <Text style={[styles.subLabel, { color: colors.mutedForeground }]}>
                                    Bạn có thể chọn capture chỉ 1 app cụ thể
                                </Text>
                            )}
                        </View>
                    </View>

                    <View style={[styles.progressBox, { backgroundColor: colors.secondary + '80' }]}>
                        <View style={styles.progressHeader}>
                            <Text style={[styles.label, { color: colors.mutedForeground }]}>Model dịch</Text>
                            <Text style={[styles.progressRatio, { color: colors.primary }]}>
                                {readyModels}/{totalModels}
                            </Text>
                        </View>

                        {modelStatus.models && modelStatus.models.length > 0 ? (
                            <View style={styles.modelsList}>
                                {modelStatus.models.map((m, idx) => (
                                    <View key={m.id || idx} style={styles.modelItem}>
                                        <Text style={[styles.modelName, { color: colors.foreground }]} numberOfLines={1}>
                                            {m.emoji || '📦'} {m.name}
                                        </Text>
                                        <View style={styles.modelStatusRight}>
                                            {m.status === 'completed' ? (
                                                <CheckCircle2 size={16} color={colors.success} />
                                            ) : m.status === 'failed' ? (
                                                <AlertCircle size={16} color={colors.destructive} />
                                            ) : (
                                                <View style={styles.progressRingWrapper}>
                                                    <Text style={[styles.progressText, { color: colors.primary }]}>
                                                        {Math.round(m.progress)}%
                                                    </Text>
                                                    <CircularProgress
                                                        progress={m.progress}
                                                        size={16}
                                                        strokeWidth={2}
                                                        color={colors.primary}
                                                        trackColor={colors.border}
                                                    />
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <View style={styles.emptyModelsContainer}>
                                <Text style={[styles.progressStatusText, { color: isAllReady ? colors.success : colors.warning }]}>
                                    {isAllReady ? "Tất cả model đã sẵn sàng" : "Đang khởi tạo danh sách model..."}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            )}
        </View>
    );
});

DeviceInfoSection.displayName = 'DeviceInfoSection';

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
        justifyContent: 'space-between',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
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
        marginTop: 16,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
    },
    rowTextContainer: {
        flex: 1,
    },
    label: {
        fontSize: 12,
    },
    value: {
        fontSize: 14,
        fontWeight: '500',
        marginTop: 2,
    },
    subLabel: {
        fontSize: 11,
        opacity: 0.7,
        marginTop: 2,
    },
    progressBox: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    progressRatio: {
        fontSize: 12,
        fontWeight: '600',
    },
    modelsList: {
        gap: 8,
        marginTop: 4,
    },
    modelItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    modelName: {
        fontSize: 13,
        flex: 1,
    },
    modelStatusRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    progressRingWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    progressText: {
        fontSize: 11,
        fontWeight: '500',
        width: 30,
        textAlign: 'right',
    },
    emptyModelsContainer: {
        marginTop: 4,
    },
    progressStatusText: {
        fontSize: 11,
        fontWeight: '500',
    },
});

export default DeviceInfoSection;
