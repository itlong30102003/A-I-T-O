import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SelectionType } from '../core/constants';

interface SelectionTypeSelectorProps {
    selectionType: SelectionType;
    onTypeChange: (type: SelectionType) => void;
}

/**
 * Selection type selector (Word/Paragraph).
 * Uses React.memo and useCallback for optimization.
 */
const SelectionTypeSelector: React.FC<SelectionTypeSelectorProps> = memo(({
    selectionType,
    onTypeChange,
}) => {
    const handleWordPress = useCallback(() => onTypeChange('WORD'), [onTypeChange]);
    const handleParagraphPress = useCallback(() => onTypeChange('PARAGRAPH'), [onTypeChange]);

    return (
        <View style={styles.selectionTypeContainer}>
            <Text style={styles.selectionTypeLabel}>📌 Kiểu chọn:</Text>
            <View style={styles.selectionTypeRow}>
                <TouchableOpacity
                    style={[
                        styles.selectionTypeBtn,
                        selectionType === 'WORD' && styles.selectionTypeBtnActive
                    ]}
                    onPress={handleWordPress}
                >
                    <Text style={[
                        styles.selectionTypeBtnText,
                        selectionType === 'WORD' && styles.selectionTypeBtnTextActive
                    ]}>📝 Từ</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.selectionTypeBtn,
                        selectionType === 'PARAGRAPH' && styles.selectionTypeBtnActive
                    ]}
                    onPress={handleParagraphPress}
                >
                    <Text style={[
                        styles.selectionTypeBtnText,
                        selectionType === 'PARAGRAPH' && styles.selectionTypeBtnTextActive
                    ]}>📄 Đoạn văn</Text>
                </TouchableOpacity>
            </View>
            <Text style={styles.selectionTypeHint}>
                {selectionType === 'WORD'
                    ? '💡 Chạm vào từ để dịch'
                    : '💡 Vẽ vùng chọn để dịch đoạn văn'}
            </Text>
        </View>
    );
});

SelectionTypeSelector.displayName = 'SelectionTypeSelector';

const styles = StyleSheet.create({
    selectionTypeContainer: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    selectionTypeLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    selectionTypeRow: {
        flexDirection: 'row',
        gap: 10,
    },
    selectionTypeBtn: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#f5f5f5',
        alignItems: 'center',
    },
    selectionTypeBtnActive: {
        backgroundColor: '#1976d2',
    },
    selectionTypeBtnText: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    selectionTypeBtnTextActive: {
        color: '#fff',
    },
    selectionTypeHint: {
        fontSize: 12,
        color: '#999',
        fontStyle: 'italic',
        marginTop: 8,
    },
});

export default SelectionTypeSelector;
