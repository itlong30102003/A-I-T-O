import React, { memo, useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
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
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        setLoading(true);
        const unsubscribe = historyService.subscribeToHistory(
            strategy,
            (newItems) => {
                setItems(newItems);
                setLoading(false);
                setRefreshing(false);
            }
        );

        return () => unsubscribe();
    }, [strategy]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        // Re-subscription will happen automatically if strategy changes, 
        // but for manual refresh we can just let the subscription handle updates.
        // If we want to force re-fetch, we might need a way to trigger it in the service,
        // but with onSnapshot it's usually not needed.
        // For now, just simulate a quick refresh to show UI feedback
        setTimeout(() => setRefreshing(false), 500);
    }, []);

    const renderItem = useCallback(({ item }: { item: HistoryItem }) => (
        <View style={styles.itemContainer}>
            <Text style={styles.sourceText} numberOfLines={2}>{item.sourceText}</Text>
            <Text style={styles.translatedText} numberOfLines={2}>{item.translatedText}</Text>
            <Text style={styles.timestamp}>
                {new Date(item.timestamp).toLocaleString('vi-VN')}
            </Text>
        </View>
    ), []);

    const keyExtractor = useCallback((item: HistoryItem, index: number) => item.id || `${index}`, []);

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
            <FlatList
                data={items}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                style={styles.list}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4285F4']} />
                }
                showsVerticalScrollIndicator={false}
            />
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
        maxHeight: 200,
    },
    itemContainer: {
        backgroundColor: '#f8f9fa',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
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
});

export default HistoryList;
