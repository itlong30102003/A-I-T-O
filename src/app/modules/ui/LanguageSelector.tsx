import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Languages, ArrowRightLeft, Sparkles } from 'lucide-react-native';

interface LanguageItem {
    code: string;
    label: string;
    flag?: string;
}

interface LanguageSelectorProps {
    sourceLang: LanguageItem;
    targetLang: LanguageItem;
    onSourcePress: () => void;
    onTargetPress: () => void;
    onSwap: () => void;
    colors: any;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = memo(({
    sourceLang, targetLang, onSourcePress, onTargetPress, onSwap, colors
}) => {
    return (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.header}>
                <View style={[styles.iconBox, { backgroundColor: colors.accent + '1A' }]}>
                    <Languages size={16} color={colors.accent} />
                </View>
                <Text style={[styles.title, { color: colors.foreground }]}>Ngôn ngữ</Text>
            </View>

            <View style={styles.row}>
                <TouchableOpacity
                    style={[styles.langButton, { backgroundColor: colors.secondary + '80' }]}
                    onPress={onSourcePress}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.langLabel, { color: colors.mutedForeground }]}>NGUỒN</Text>
                    <View style={styles.langValueBox}>
                        {sourceLang.code === 'auto' ? (
                            <Sparkles size={14} color={colors.primary} />
                        ) : null}
                        <Text style={[styles.langValue, { color: colors.foreground }]} numberOfLines={1}>
                            {sourceLang.label}
                        </Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.swapButton, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                    onPress={onSwap}
                    disabled={sourceLang.code === 'auto'}
                    activeOpacity={0.7}
                >
                    <ArrowRightLeft
                        size={16}
                        color={sourceLang.code === 'auto' ? colors.mutedForeground : colors.foreground}
                    />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.langButton, { backgroundColor: colors.secondary + '80' }]}
                    onPress={onTargetPress}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.langLabel, { color: colors.mutedForeground }]}>ĐÍCH</Text>
                    <View style={styles.langValueBox}>
                        <Text style={[styles.langValue, { color: colors.foreground }]} numberOfLines={1}>
                            {targetLang.label}
                        </Text>
                    </View>
                </TouchableOpacity>
            </View>
        </View>
    );
});

LanguageSelector.displayName = 'LanguageSelector';

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
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    langButton: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 8,
        borderRadius: 12,
        gap: 8,
    },
    langLabel: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1,
    },
    langValueBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    langValue: {
        fontSize: 14,
        fontWeight: '600',
    },
    swapButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    }
});

export default LanguageSelector;
