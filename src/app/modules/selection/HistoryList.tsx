import React, { memo, useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Modal, ScrollView } from 'react-native';
import historyService, { HistoryItem } from '../../services/HistoryService';

interface HistoryListProps {
    strategy: 'WORD' | 'PARAGRAPH';
}

/**
 * HistoryList - Displays translation history filtered by strategy.
 * Uses React.memo for optimization.
 */
const HistoryList: React.FC<HistoryListProps> = memo(({ strategy }) => {
    const [items, setItems] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);

    useEffect(() => {
        setLoading(true);
        const unsubscribe = historyService.subscribeToHistory(
            strategy,
            (newItems) => {
                setItems(newItems);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [strategy]);

    const handleItemPress = useCallback((item: HistoryItem) => {
        setSelectedItem(item);
    }, []);

    const closeModal = useCallback(() => {
        setSelectedItem(null);
    }, []);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#4285F4" />
                <Text style={styles.loadingText}>Đang tải lịch sử...</Text>
            </View>
        );
    }

    if (items.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                    {strategy === 'WORD' ? '📝 Chưa có lịch sử dịch từ' : '📄 Chưa có lịch sử dịch đoạn văn'}
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>
                {strategy === 'WORD' ? '📝 Lịch sử dịch từ' : '📄 Lịch sử dịch đoạn văn'}
            </Text>
            <View style={styles.list}>
                {items.slice(0, 10).map((item, index) => (
                    <TouchableOpacity
                        key={item.id || index}
                        style={styles.itemContainer}
                        onPress={() => handleItemPress(item)}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.sourceText} numberOfLines={2}>{item.sourceText}</Text>
                        <Text style={styles.translatedText} numberOfLines={2}>{item.translatedText}</Text>
                        <Text style={styles.timestamp}>
                            {new Date(item.timestamp).toLocaleString('vi-VN')}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Detail Modal */}
            <Modal
                visible={!!selectedItem}
                transparent={true}
                animationType="fade"
                onRequestClose={closeModal}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={closeModal}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>📋 Chi tiết bản dịch</Text>
                            <TouchableOpacity onPress={closeModal}>
                                <Text style={styles.closeButton}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <Text style={styles.sectionLabel}>📄 Văn bản gốc:</Text>
                            <Text style={styles.sourceTextFull} selectable>
                                {selectedItem?.sourceText}
                            </Text>

                            <Text style={styles.sectionLabel}>🌐 Bản dịch:</Text>
                            <Text style={styles.translatedTextFull} selectable>
                                {selectedItem?.translatedText}
                            </Text>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <Text style={styles.footerText}>
                                🕐 {selectedItem && new Date(selectedItem.timestamp).toLocaleString('vi-VN')}
                            </Text>
                            <Text style={styles.footerText}>
                                🔤 {selectedItem?.sourceLanguage} → {selectedItem?.targetLanguage}
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
});

HistoryList.displayName = 'HistoryList';

const styles = StyleSheet.create({
    container: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    title: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    list: {
        maxHeight: 250,
    },
    itemContainer: {
        backgroundColor: '#f8f9fa',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#e8e8e8',
    },
    sourceText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    translatedText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1976d2',
        marginBottom: 4,
    },
    timestamp: {
        fontSize: 10,
        color: '#999',
        textAlign: 'right',
    },
    loadingContainer: {
        padding: 20,
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 12,
        color: '#666',
        marginTop: 8,
    },
    emptyContainer: {
        padding: 20,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 12,
        color: '#999',
        fontStyle: 'italic',
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 16,
        width: '100%',
        maxHeight: '80%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    closeButton: {
        fontSize: 24,
        color: '#999',
        padding: 4,
    },
    modalBody: {
        padding: 16,
        maxHeight: 300,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#888',
        marginBottom: 6,
        marginTop: 12,
    },
    sourceTextFull: {
        fontSize: 15,
        lineHeight: 22,
        color: '#444',
        backgroundColor: '#f5f5f5',
        padding: 12,
        borderRadius: 8,
    },
    translatedTextFull: {
        fontSize: 15,
        lineHeight: 22,
        color: '#1976d2',
        fontWeight: '500',
        backgroundColor: '#e3f2fd',
        padding: 12,
        borderRadius: 8,
    },
    modalFooter: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    footerText: {
        fontSize: 11,
        color: '#888',
    },
});

export default HistoryList;
