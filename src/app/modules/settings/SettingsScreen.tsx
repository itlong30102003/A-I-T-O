import React, { memo, useMemo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useSettings, OverlayStyle, ThemeMode, AppLanguage } from './SettingsContext';

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

    const colors = useMemo(() => ({
        bg: isDark ? '#1a1a2e' : '#f5f5f5',
        card: isDark ? '#16213e' : '#fff',
        text: isDark ? '#e0e0e0' : '#333',
        subtext: isDark ? '#a0a0a0' : '#666',
        border: isDark ? '#2a2a4a' : '#eee',
        accent: '#4285F4',
        activeBtn: '#4285F4',
        inactiveBtn: isDark ? '#2a2a4a' : '#f1f3f4',
        activeBtnText: '#fff',
        inactiveBtnText: isDark ? '#a0a0a0' : '#666',
    }), [isDark]);

    const previewBg = overlayStyle === 'dark'
        ? 'rgba(0,0,0,0.78)'
        : 'rgba(255,255,255,0.9)';
    const previewText = overlayStyle === 'dark' ? '#fff' : '#000';

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.bg }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.card }]}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <Text style={[styles.backText, { color: colors.accent }]}>
                        {t('settings.back')}
                    </Text>
                </TouchableOpacity>
                <Text style={[styles.title, { color: colors.text }]}>
                    {t('settings.title')}
                </Text>
            </View>

            {/* Section 1: Overlay Style */}
            <View style={[styles.section, { backgroundColor: colors.card }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('settings.overlayStyle')}
                </Text>
                <View style={styles.toggleRow}>
                    <TouchableOpacity
                        style={[
                            styles.toggleBtn,
                            { backgroundColor: overlayStyle === 'dark' ? colors.activeBtn : colors.inactiveBtn },
                        ]}
                        onPress={() => setOverlayStyle('dark')}
                    >
                        <Text style={[
                            styles.toggleText,
                            { color: overlayStyle === 'dark' ? colors.activeBtnText : colors.inactiveBtnText },
                        ]}>
                            {t('settings.overlayStyle.dark')}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.toggleBtn,
                            { backgroundColor: overlayStyle === 'light' ? colors.activeBtn : colors.inactiveBtn },
                        ]}
                        onPress={() => setOverlayStyle('light')}
                    >
                        <Text style={[
                            styles.toggleText,
                            { color: overlayStyle === 'light' ? colors.activeBtnText : colors.inactiveBtnText },
                        ]}>
                            {t('settings.overlayStyle.light')}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Preview */}
                <View style={styles.previewContainer}>
                    <Text style={[styles.previewLabel, { color: colors.subtext }]}>
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
            <View style={[styles.section, { backgroundColor: colors.card }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('settings.theme')}
                </Text>
                <View style={styles.toggleRow}>
                    <TouchableOpacity
                        style={[
                            styles.toggleBtn,
                            { backgroundColor: theme === 'light' ? colors.activeBtn : colors.inactiveBtn },
                        ]}
                        onPress={() => setTheme('light')}
                    >
                        <Text style={[
                            styles.toggleText,
                            { color: theme === 'light' ? colors.activeBtnText : colors.inactiveBtnText },
                        ]}>
                            {t('settings.theme.light')}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.toggleBtn,
                            { backgroundColor: theme === 'dark' ? colors.activeBtn : colors.inactiveBtn },
                        ]}
                        onPress={() => setTheme('dark')}
                    >
                        <Text style={[
                            styles.toggleText,
                            { color: theme === 'dark' ? colors.activeBtnText : colors.inactiveBtnText },
                        ]}>
                            {t('settings.theme.dark')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Section 3: Text Size */}
            <View style={[styles.section, { backgroundColor: colors.card }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('settings.textSize')}
                </Text>
                <View style={styles.sliderRow}>
                    <Text style={[styles.sliderLabel, { color: colors.subtext }]}>
                        {t('settings.textSize.small')}
                    </Text>
                    <Slider
                        style={styles.slider}
                        minimumValue={0.8}
                        maximumValue={1.5}
                        step={0.1}
                        value={overlayTextSize}
                        onValueChange={setOverlayTextSize}
                        minimumTrackTintColor={colors.accent}
                        maximumTrackTintColor={colors.border}
                        thumbTintColor={colors.accent}
                    />
                    <Text style={[styles.sliderLabel, { color: colors.subtext }]}>
                        {t('settings.textSize.large')}
                    </Text>
                </View>
                <Text style={[styles.sliderValue, { color: colors.text }]}>
                    {(overlayTextSize * 100).toFixed(0)}%
                </Text>
            </View>

            {/* Section 4: App Language */}
            <View style={[styles.section, { backgroundColor: colors.card }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('settings.language')}
                </Text>
                <View style={styles.toggleRow}>
                    <TouchableOpacity
                        style={[
                            styles.toggleBtn,
                            { backgroundColor: appLanguage === 'vi' ? colors.activeBtn : colors.inactiveBtn },
                        ]}
                        onPress={() => setAppLanguage('vi')}
                    >
                        <Text style={[
                            styles.toggleText,
                            { color: appLanguage === 'vi' ? colors.activeBtnText : colors.inactiveBtnText },
                        ]}>
                            🇻🇳 Tiếng Việt
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.toggleBtn,
                            { backgroundColor: appLanguage === 'en' ? colors.activeBtn : colors.inactiveBtn },
                        ]}
                        onPress={() => setAppLanguage('en')}
                    >
                        <Text style={[
                            styles.toggleText,
                            { color: appLanguage === 'en' ? colors.activeBtnText : colors.inactiveBtnText },
                        ]}>
                            🇺🇸 English
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={{ height: 40 }} />
        </ScrollView>
    );
});

SettingsScreen.displayName = 'SettingsScreen';

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    backBtn: { marginRight: 12 },
    backText: { fontSize: 16, fontWeight: '600' },
    title: { fontSize: 20, fontWeight: 'bold' },
    section: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
    toggleRow: {
        flexDirection: 'row',
        backgroundColor: 'transparent',
        borderRadius: 8,
        overflow: 'hidden',
        gap: 8,
    },
    toggleBtn: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 8,
    },
    toggleText: { fontSize: 14, fontWeight: '600' },
    previewContainer: { marginTop: 16 },
    previewLabel: { fontSize: 12, marginBottom: 6 },
    previewBox: {
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
    },
    previewText: { textAlign: 'center' },
    sliderRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    slider: { flex: 1, marginHorizontal: 8 },
    sliderLabel: { fontSize: 12 },
    sliderValue: { textAlign: 'center', fontSize: 14, fontWeight: '600', marginTop: 4 },
});

export default SettingsScreen;
