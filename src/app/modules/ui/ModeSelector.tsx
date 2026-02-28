import React, { useMemo, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MODES, TranslationMode } from '../core';
import { useSettings } from '../settings/SettingsContext';
import { Zap, MousePointer2, Camera, FolderOpen } from 'lucide-react-native';

interface ModeSelectorProps {
    translationMode: TranslationMode;
    onModeChange: (modeId: TranslationMode) => void;
    colors: any;
    children?: React.ReactNode;
}

const getIconForMode = (modeId: string, color: string, isActive: boolean) => {
    const size = 18;
    switch (modeId) {
        case 'REALTIME':
            return <Zap size={size} color={isActive ? color : color + '80'} />;
        case 'SELECTION':
            return <MousePointer2 size={size} color={isActive ? color : color + '80'} />;
        case 'CAMERA':
            return <Camera size={size} color={isActive ? color : color + '80'} />;
        case 'RESOURCE':
            return <FolderOpen size={size} color={isActive ? color : color + '80'} />;
        default:
            return <Zap size={size} color={isActive ? color : color + '80'} />;
    }
};

const ModeSelector: React.FC<ModeSelectorProps> = memo(({ translationMode, onModeChange, colors, children }) => {
    const { t } = useSettings();

    const currentModeDesc = useMemo(() => {
        return MODES.find(m => m.id === translationMode)?.desc || '';
    }, [translationMode]);

    return (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.header}>
                <View style={[styles.iconBox, { backgroundColor: colors.primary + '1A' }]}>
                    <Zap size={16} color={colors.primary} />
                </View>
                <Text style={[styles.title, { color: colors.foreground }]}>{t('main.translationMode')}</Text>
            </View>

            <View style={styles.grid}>
                {MODES.map((mode) => {
                    const isActive = translationMode === mode.id;
                    return (
                        <TouchableOpacity
                            key={mode.id}
                            style={[
                                styles.modeButton,
                                {
                                    backgroundColor: isActive ? colors.primary : colors.secondary + '80',
                                    shadowColor: isActive ? colors.primary : 'transparent',
                                    elevation: isActive ? 4 : 0,
                                }
                            ]}
                            onPress={() => onModeChange(mode.id as TranslationMode)}
                            activeOpacity={0.7}
                        >
                            {getIconForMode(mode.id, isActive ? colors.primaryForeground : colors.mutedForeground, isActive)}
                            <Text style={[
                                styles.modeLabel,
                                { color: isActive ? colors.primaryForeground : selectedColor(colors.mutedForeground, isActive) }
                            ]} numberOfLines={1}>
                                {mode.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <View style={[styles.descContainer, { backgroundColor: colors.secondary + '4D' }]}>
                <View style={[styles.pulseDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.modeDescription, { color: colors.mutedForeground }]}>{currentModeDesc}</Text>
            </View>

            {children && (
                <View style={styles.childrenContainer}>
                    {children}
                </View>
            )}
        </View>
    );

    function selectedColor(c: string, isActive: boolean) {
        return isActive ? '#ffffff' : c;
    }
});

ModeSelector.displayName = 'ModeSelector';

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
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    modeButton: {
        flexBasis: '23%', // approx 4 cols
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 4,
        borderRadius: 12,
        gap: 6,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    modeLabel: {
        fontSize: 11,
        fontWeight: '500',
        textAlign: 'center',
    },
    descContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 8,
        marginTop: 12,
        gap: 6,
    },
    pulseDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    modeDescription: {
        fontSize: 12,
    },
    childrenContainer: {
        marginTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0', // Fallback, handled by parent
        paddingTop: 16,
    }
});

export default ModeSelector;
