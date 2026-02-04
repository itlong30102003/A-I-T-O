import React, { memo } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

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
    models: ModelStatus[];
}

interface ModelLoadingCardProps {
    status: ModelLoadingStatus;
}

/**
 * Model loading progress card.
 * Uses React.memo and Early Return for optimization.
 */
const ModelLoadingCard: React.FC<ModelLoadingCardProps> = memo(({ status }) => {
    // Early return: Don't render if models are loaded
    if (status.loaded && !status.isLoading) {
        return (
            <View style={styles.modelLoadedBanner}>
                <Text style={styles.modelLoadedText}>
                    ✅ Model dịch đã sẵn sàng ({status.total}/{status.total})
                </Text>
            </View>
        );
    }

    // Early return: Don't render if not loading and no models
    if (!status.isLoading && (!status.models || status.models.length === 0)) {
        return null;
    }

    return (
        <View style={styles.modelLoadingCard}>
            <View style={styles.modelLoadingHeader}>
                <Text style={styles.modelLoadingTitle}>📥 Đang tải Model dịch</Text>
                <Text style={styles.modelLoadingSubtitle}>
                    {status.progress}/{status.total} hoàn thành
                </Text>
            </View>

            {status.models?.map((model) => (
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
    );
});

ModelLoadingCard.displayName = 'ModelLoadingCard';

const styles = StyleSheet.create({
    modelLoadingCard: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e3f2fd',
    },
    modelLoadingHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    modelLoadingTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1976d2',
    },
    modelLoadingSubtitle: {
        fontSize: 14,
        color: '#666',
    },
    modelItem: {
        backgroundColor: '#f8f9fa',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
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
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
        color: '#333',
    },
    modelStatus: {
        fontSize: 12,
        color: '#666',
    },
    modelStatusCompleted: {
        color: '#34A853',
    },
    modelStatusDownloading: {
        color: '#1976d2',
    },
    modelStatusFailed: {
        color: '#EA4335',
    },
    downloadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    elapsedText: {
        fontSize: 12,
        color: '#666',
    },
    progressBarContainer: {
        height: 6,
        backgroundColor: '#e0e0e0',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#1976d2',
    },
    progressBarCompleted: {
        backgroundColor: '#34A853',
    },
    progressBarFailed: {
        backgroundColor: '#EA4335',
    },
    progressText: {
        fontSize: 11,
        color: '#999',
        marginTop: 4,
        textAlign: 'right',
    },
    modelError: {
        fontSize: 11,
        color: '#EA4335',
        marginTop: 4,
    },
    modelLoadingHint: {
        fontSize: 12,
        color: '#999',
        fontStyle: 'italic',
        marginTop: 8,
    },
    modelLoadedBanner: {
        backgroundColor: '#e8f5e9',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    modelLoadedText: {
        fontSize: 14,
        color: '#34A853',
        fontWeight: '500',
        textAlign: 'center',
    },
});

export default ModelLoadingCard;
