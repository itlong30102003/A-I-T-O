import React, { useMemo, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MODES, TranslationMode } from '../core';
import { useSettings } from '../settings/SettingsContext';

interface ModeSelectorProps {
    translationMode: TranslationMode;
    onModeChange: (modeId: TranslationMode) => void;
    colors: {
        card: string;
        text: string;
        buttonBg: string;
        subtext: string;
    };
    children?: React.ReactNode;
}

const ModeSelector: React.FC<ModeSelectorProps> = memo(({ translationMode, onModeChange, colors, children }) => {
    const { t } = useSettings();

    const currentModeDesc = useMemo(() => {
        return MODES.find(m => m.id === translationMode)?.desc || '';
    }, [translationMode]);

    return (
        <View style={[styles.modeSection, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('main.translationMode')}</Text>
            <View style={[styles.modeContainer, { backgroundColor: colors.buttonBg }]}>
                {MODES.map((mode) => (
                    <TouchableOpacity
                        key={mode.id}
                        style={[
                            styles.modeButton,
                            translationMode === mode.id && styles.modeButtonActive
                        ]}
                        onPress={() => onModeChange(mode.id as TranslationMode)}
                    >
                        <Text style={[
                            styles.modeLabel,
                            translationMode === mode.id && styles.modeLabelActive
                        ]}>
                            {mode.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
            <Text style={[styles.modeDescription, { color: colors.subtext }]}>{currentModeDesc}</Text>

            {children}
        </View>
    );
});

ModeSelector.displayName = 'ModeSelector';

const styles = StyleSheet.create({
    modeSection: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 16
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12
    },
    modeContainer: {
        flexDirection: 'row',
        borderRadius: 8,
        padding: 4,
        marginBottom: 8
    },
    modeButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 6
    },
    modeButtonActive: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 2
    },
    modeLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#666'
    },
    modeLabelActive: {
        color: '#4285F4',
        fontWeight: '700'
    },
    modeDescription: {
        fontSize: 12,
        fontStyle: 'italic',
        textAlign: 'center',
        marginBottom: 8
    }
});

export default ModeSelector;
