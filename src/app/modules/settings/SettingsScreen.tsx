import React, { memo, useMemo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { ArrowLeft, Palette, Sun, Moon, Type, Globe } from 'lucide-react-native';
import { useSettings, OverlayStyle, ThemeMode, AppLanguage } from './SettingsContext';
import { getTheme } from '../ui/theme';

interface SettingsScreenProps {
    onBack: () => void;
}

const SettingsScreen: React.FC<SettingsScreenProps> = memo(({ onBack }) => {
    const {
        overlayStyle,
        theme,
        overlayTextSize,
        appLanguage,
        setOverlayStyle,
        setTheme,
        setOverlayTextSize,
        setAppLanguage,
        t,
    } = useSettings();

    const isDark = theme === 'dark';
    const colors = useMemo(() => getTheme(isDark), [isDark]);

    const previewBg = overlayStyle === 'dark'
        ? 'rgba(0,0,0,0.78)'
        : 'rgba(255,255,255,0.9)';
    const previewText = overlayStyle === 'dark' ? '#fff' : '#000';

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: colors.background }]}
            contentContainerStyle={{ paddingBottom: 40 }}
        >
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={onBack}
                    style={[styles.backBtn, { backgroundColor: colors.secondary }]}
                    activeOpacity={0.7}
                >
                    <ArrowLeft size={20} color={colors.foreground} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.foreground }]}>
                    {t('settings.title')}
                </Text>
            </View>

            {/* Section 1: Overlay Style */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.sectionHeader}>
                    <View style={[styles.iconBox, { backgroundColor: colors.accent + '1A' }]}>
                        <Palette size={16} color={colors.accent} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                        {t('settings.overlayStyle')}
                    </Text>
                </View>
                <View style={styles.toggleRow}>
                    <TouchableOpacity
                        style={[
                            styles.toggleBtn,
                            {
                                backgroundColor: overlayStyle === 'dark' ? colors.primary : colors.secondary + '80',
                                elevation: overlayStyle === 'dark' ? 4 : 0,
                                shadowColor: overlayStyle === 'dark' ? colors.primary : 'transparent',
                            },
                        ]}
                        onPress={() => setOverlayStyle('dark')}
                        activeOpacity={0.7}
                    >
                        <Moon size={16} color={overlayStyle === 'dark' ? colors.primaryForeground : colors.mutedForeground} />
                        <Text style={[
                            styles.toggleText,
                            { color: overlayStyle === 'dark' ? colors.primaryForeground : colors.mutedForeground },
                        ]}>
                            {t('settings.overlayStyle.dark')}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.toggleBtn,
                            {
                                backgroundColor: overlayStyle === 'light' ? colors.primary : colors.secondary + '80',
                                elevation: overlayStyle === 'light' ? 4 : 0,
                                shadowColor: overlayStyle === 'light' ? colors.primary : 'transparent',
                            },
                        ]}
                        onPress={() => setOverlayStyle('light')}
                        activeOpacity={0.7}
                    >
                        <Sun size={16} color={overlayStyle === 'light' ? colors.primaryForeground : colors.mutedForeground} />
                        <Text style={[
                            styles.toggleText,
                            { color: overlayStyle === 'light' ? colors.primaryForeground : colors.mutedForeground },
                        ]}>
                            {t('settings.overlayStyle.light')}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Preview */}
                <View style={styles.previewContainer}>
                    <Text style={[styles.previewLabel, { color: colors.mutedForeground }]}>
                        {t('settings.preview')}
                    </Text>
                    <View style={[styles.previewBox, { backgroundColor: previewBg, borderColor: colors.border }]}>
                        <Text style={[
                            styles.previewText,
                            { color: previewText, fontSize: 16 * overlayTextSize },
                        ]}>
                            Hello World → Xin chào Thế giới
                        </Text>
                    </View>
                </View>
            </View>

            {/* Section 2: UI Theme */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.sectionHeader}>
                    <View style={[styles.iconBox, { backgroundColor: colors.primary + '1A' }]}>
                        {isDark ? <Moon size={16} color={colors.primary} /> : <Sun size={16} color={colors.primary} />}
                    </View>
                    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                        {t('settings.theme')}
                    </Text>
                </View>
                <View style={styles.toggleRow}>
                    <TouchableOpacity
                        style={[
                            styles.toggleBtn,
                            {
                                backgroundColor: theme === 'light' ? colors.primary : colors.secondary + '80',
                                elevation: theme === 'light' ? 4 : 0,
                                shadowColor: theme === 'light' ? colors.primary : 'transparent',
                            },
                        ]}
                        onPress={() => setTheme('light')}
                        activeOpacity={0.7}
                    >
                        <Sun size={16} color={theme === 'light' ? colors.primaryForeground : colors.mutedForeground} />
                        <Text style={[
                            styles.toggleText,
                            { color: theme === 'light' ? colors.primaryForeground : colors.mutedForeground },
                        ]}>
                            {t('settings.theme.light')}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.toggleBtn,
                            {
                                backgroundColor: theme === 'dark' ? colors.primary : colors.secondary + '80',
                                elevation: theme === 'dark' ? 4 : 0,
                                shadowColor: theme === 'dark' ? colors.primary : 'transparent',
                            },
                        ]}
                        onPress={() => setTheme('dark')}
                        activeOpacity={0.7}
                    >
                        <Moon size={16} color={theme === 'dark' ? colors.primaryForeground : colors.mutedForeground} />
                        <Text style={[
                            styles.toggleText,
                            { color: theme === 'dark' ? colors.primaryForeground : colors.mutedForeground },
                        ]}>
                            {t('settings.theme.dark')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Section 3: Text Size */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.sectionHeader}>
                    <View style={[styles.iconBox, { backgroundColor: colors.success + '1A' }]}>
                        <Type size={16} color={colors.success} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                        {t('settings.textSize')}
                    </Text>
                </View>
                <View style={[styles.sliderContainer, { backgroundColor: colors.secondary + '80' }]}>
                    <View style={styles.sliderRow}>
                        <Text style={[styles.sliderLabel, { color: colors.mutedForeground }]}>
                            {t('settings.textSize.small')}
                        </Text>
                        <Slider
                            style={styles.slider}
                            minimumValue={0.8}
                            maximumValue={1.5}
                            step={0.1}
                            value={overlayTextSize}
                            onValueChange={setOverlayTextSize}
                            minimumTrackTintColor={colors.primary}
                            maximumTrackTintColor={colors.border}
                            thumbTintColor={colors.primary}
                        />
                        <Text style={[styles.sliderLabel, { color: colors.mutedForeground }]}>
                            {t('settings.textSize.large')}
                        </Text>
                    </View>
                    <Text style={[styles.sliderValue, { color: colors.primary }]}>
                        {(overlayTextSize * 100).toFixed(0)}%
                    </Text>
                </View>
            </View>

            {/* Section 4: App Language */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.sectionHeader}>
                    <View style={[styles.iconBox, { backgroundColor: colors.warning + '1A' }]}>
                        <Globe size={16} color={colors.warning} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                        {t('settings.language')}
                    </Text>
                </View>
                <View style={styles.toggleRow}>
                    <TouchableOpacity
                        style={[
                            styles.toggleBtn,
                            {
                                backgroundColor: appLanguage === 'vi' ? colors.primary : colors.secondary + '80',
                                elevation: appLanguage === 'vi' ? 4 : 0,
                                shadowColor: appLanguage === 'vi' ? colors.primary : 'transparent',
                            },
                        ]}
                        onPress={() => setAppLanguage('vi')}
                        activeOpacity={0.7}
                    >
                        <Text style={[
                            styles.toggleText,
                            { color: appLanguage === 'vi' ? colors.primaryForeground : colors.mutedForeground },
                        ]}>
                            🇻🇳 Tiếng Việt
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.toggleBtn,
                            {
                                backgroundColor: appLanguage === 'en' ? colors.primary : colors.secondary + '80',
                                elevation: appLanguage === 'en' ? 4 : 0,
                                shadowColor: appLanguage === 'en' ? colors.primary : 'transparent',
                            },
                        ]}
                        onPress={() => setAppLanguage('en')}
                        activeOpacity={0.7}
                    >
                        <Text style={[
                            styles.toggleText,
                            { color: appLanguage === 'en' ? colors.primaryForeground : colors.mutedForeground },
                        ]}>
                            🇺🇸 English
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
    );
});

SettingsScreen.displayName = 'SettingsScreen';

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 16,
        marginBottom: 8,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: -0.5,
    },
    card: {
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 16,
    },
    sectionHeader: {
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
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
    },
    toggleRow: {
        flexDirection: 'row',
        gap: 8,
    },
    toggleBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        gap: 6,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    toggleText: {
        fontSize: 13,
        fontWeight: '500',
    },
    previewContainer: {
        marginTop: 16,
    },
    previewLabel: {
        fontSize: 11,
        fontWeight: '500',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    previewBox: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    previewText: {
        textAlign: 'center',
    },
    sliderContainer: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 12,
    },
    sliderRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    slider: {
        flex: 1,
        marginHorizontal: 8,
    },
    sliderLabel: {
        fontSize: 11,
        fontWeight: '500',
    },
    sliderValue: {
        textAlign: 'center',
        fontSize: 13,
        fontWeight: '600',
        marginTop: 6,
    },
});

export default SettingsScreen;
