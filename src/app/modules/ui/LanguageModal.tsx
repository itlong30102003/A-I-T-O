import React, { memo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    FlatList,
    StyleSheet,
} from 'react-native';
import { LANGUAGES, LanguageItem } from '../core/constants';

interface LanguageModalProps {
    visible: boolean;
    type: 'source' | 'target' | null;
    currentSourceLang: LanguageItem;
    currentTargetLang: LanguageItem;
    onSelect: (lang: LanguageItem) => void;
    onClose: () => void;
}

/**
 * Reusable Language Selection Modal.
 * Uses React.memo to prevent unnecessary re-renders.
 */
const LanguageModal: React.FC<LanguageModalProps> = memo(({
    visible,
    type,
    currentSourceLang,
    currentTargetLang,
    onSelect,
    onClose,
}) => {
    // Early return if not visible
    if (!visible || !type) return null;

    const data = type === 'source' ? LANGUAGES.source : LANGUAGES.target;
    const currentLang = type === 'source' ? currentSourceLang : currentTargetLang;

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>
                        {type === 'source' ? 'Chọn ngôn ngữ nguồn' : 'Chọn ngôn ngữ đích'}
                    </Text>
                    <FlatList
                        data={data}
                        keyExtractor={(item) => item.code}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.languageOption}
                                onPress={() => {
                                    onSelect(item);
                                    onClose();
                                }}
                            >
                                <Text style={styles.languageOptionText}>{item.label}</Text>
                                {currentLang.code === item.code && (
                                    <Text style={styles.checkMark}>✓</Text>
                                )}
                            </TouchableOpacity>
                        )}
                    />
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Text style={styles.closeButtonText}>Đóng</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
});

LanguageModal.displayName = 'LanguageModal';

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: '60%',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 16,
        textAlign: 'center',
    },
    languageOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    languageOptionText: {
        fontSize: 16,
        color: '#333',
    },
    checkMark: {
        fontSize: 18,
        color: '#1976d2',
        fontWeight: 'bold',
    },
    closeButton: {
        marginTop: 16,
        padding: 14,
        backgroundColor: '#f5f5f5',
        borderRadius: 10,
        alignItems: 'center',
    },
    closeButtonText: {
        fontSize: 16,
        color: '#666',
    },
});

export default LanguageModal;
