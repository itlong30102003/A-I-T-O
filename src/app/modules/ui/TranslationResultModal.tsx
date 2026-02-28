import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { useSettings } from '../settings/SettingsContext';

interface TranslationResultModalProps {
    visible: boolean;
    selectedText: string;
    onClose: () => void;
    colors: {
        subtext: string;
    };
    isDark: boolean;
}

const TranslationResultModal: React.FC<TranslationResultModalProps> = memo(({
    visible,
    selectedText,
    onClose,
    colors,
    isDark
}) => {
    const { t } = useSettings();

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={onClose}
            >
                <View style={styles.resultPanel}>
                    <View style={styles.resultHeader}>
                        <Text style={styles.resultTitle}>📝 Bản dịch</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Text style={[styles.closeIcon, { color: isDark ? '#aaa' : '#999' }]}>✕</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.resultContent}>
                        <Text style={styles.translatedTextContent}>{selectedText}</Text>
                    </ScrollView>
                    <View style={styles.resultFooter}>
                        <Text style={[styles.resultMeta, { color: colors.subtext }]}>{t('main.model')}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        </Modal>
    );
});

TranslationResultModal.displayName = 'TranslationResultModal';

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end'
    },
    resultPanel: {
        backgroundColor: '#fff',
        marginHorizontal: 20,
        marginBottom: 40,
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 20
    },
    resultHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        paddingBottom: 10
    },
    resultTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333'
    },
    closeIcon: {
        fontSize: 24,
        padding: 4
    },
    resultContent: {
        maxHeight: 200
    },
    translatedTextContent: {
        fontSize: 16,
        lineHeight: 24,
        color: '#444'
    },
    resultFooter: {
        marginTop: 15,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        paddingTop: 10
    },
    resultMeta: {
        fontSize: 12,
        fontStyle: 'italic'
    },
});

export default TranslationResultModal;
