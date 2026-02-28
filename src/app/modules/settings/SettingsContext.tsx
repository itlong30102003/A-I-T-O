import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ========== Types ==========
export type OverlayStyle = 'dark' | 'light';
export type ThemeMode = 'dark' | 'light';
export type AppLanguage = 'vi' | 'en';

export interface SettingsState {
    overlayStyle: OverlayStyle;
    theme: ThemeMode;
    overlayTextSize: number; // scale 0.8 - 1.5
    appLanguage: AppLanguage;
}

// ========== i18n Translations ==========
const translations: Record<AppLanguage, Record<string, string>> = {
    vi: {
        // Settings Screen
        'settings.title': '⚙️ Cài đặt',
        'settings.overlayStyle': 'Kiểu hiển thị Overlay',
        'settings.overlayStyle.dark': '🌑 Nền đen',
        'settings.overlayStyle.light': '☀️ Nền trắng',
        'settings.theme': 'Giao diện',
        'settings.theme.dark': '🌙 Tối',
        'settings.theme.light': '☀️ Sáng',
        'settings.textSize': 'Cỡ chữ Overlay',
        'settings.textSize.small': 'Nhỏ',
        'settings.textSize.large': 'Lớn',
        'settings.language': 'Ngôn ngữ hiển thị',
        'settings.preview': 'Xem trước',
        'settings.back': '← Quay lại',

        // MainScreen
        'main.translationMode': '🛠️ Chế độ dịch',
        'main.language': '🌐 Ngôn ngữ',
        'main.source': 'Nguồn',
        'main.target': 'Đích',
        'main.screenCapture': '🎥 Screen Capture',
        'main.captureSource': 'Nguồn:',
        'main.captureStatus': 'Trạng thái:',
        'main.captureTime': 'Thời gian:',
        'main.selected': '✅ Đã chọn',
        'main.notSelected': '❌ Chưa chọn',
        'main.capturing': 'Đang capture',
        'main.stopped': 'Đã dừng',
        'main.selectApp': '🎯 Chọn App để Capture',
        'main.grantPermission': '📺 Cấp quyền Capture',
        'main.start': '▶️ Bắt đầu',
        'main.stop': '⏹️ Dừng',
        'main.changeApp': '🔄 Đổi App Capture',
        'main.logout': '🚪 Đăng xuất',
        'main.translation': '📝 Bản dịch',
        'main.model': '💡 Model: ML Kit (Local)',
        'main.noName': 'Chưa có tên',
        'main.logoutError': 'Không thể đăng xuất',
        'main.error': 'Lỗi',
    },
    en: {
        // Settings Screen
        'settings.title': '⚙️ Settings',
        'settings.overlayStyle': 'Overlay Style',
        'settings.overlayStyle.dark': '🌑 Dark BG',
        'settings.overlayStyle.light': '☀️ Light BG',
        'settings.theme': 'Theme',
        'settings.theme.dark': '🌙 Dark',
        'settings.theme.light': '☀️ Light',
        'settings.textSize': 'Overlay Text Size',
        'settings.textSize.small': 'Small',
        'settings.textSize.large': 'Large',
        'settings.language': 'Display Language',
        'settings.preview': 'Preview',
        'settings.back': '← Back',

        // MainScreen
        'main.translationMode': '🛠️ Translation Mode',
        'main.language': '🌐 Language',
        'main.source': 'Source',
        'main.target': 'Target',
        'main.screenCapture': '🎥 Screen Capture',
        'main.captureSource': 'Source:',
        'main.captureStatus': 'Status:',
        'main.captureTime': 'Time:',
        'main.selected': '✅ Selected',
        'main.notSelected': '❌ Not selected',
        'main.capturing': 'Capturing',
        'main.stopped': 'Stopped',
        'main.selectApp': '🎯 Select App to Capture',
        'main.grantPermission': '📺 Grant Capture Permission',
        'main.start': '▶️ Start',
        'main.stop': '⏹️ Stop',
        'main.changeApp': '🔄 Change Capture App',
        'main.logout': '🚪 Logout',
        'main.translation': '📝 Translation',
        'main.model': '💡 Model: ML Kit (Local)',
        'main.noName': 'No name',
        'main.logoutError': 'Cannot logout',
        'main.error': 'Error',
    },
};

// ========== Context ==========
interface SettingsContextType extends SettingsState {
    setOverlayStyle: (style: OverlayStyle) => void;
    setTheme: (theme: ThemeMode) => void;
    setOverlayTextSize: (size: number) => void;
    setAppLanguage: (lang: AppLanguage) => void;
    t: (key: string) => string;
}

const STORAGE_KEY = '@aito_settings';

const defaultSettings: SettingsState = {
    overlayStyle: 'dark',
    theme: 'dark',
    overlayTextSize: 1.0,
    appLanguage: 'vi',
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// ========== Provider ==========
interface SettingsProviderProps {
    children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
    const [settings, setSettings] = useState<SettingsState>(defaultSettings);

    // Load from AsyncStorage on mount
    useEffect(() => {
        AsyncStorage.getItem(STORAGE_KEY)
            .then(data => {
                if (data) {
                    const parsed = JSON.parse(data) as Partial<SettingsState>;
                    setSettings(prev => ({ ...prev, ...parsed }));
                }
            })
            .catch(err => console.warn('Failed to load settings:', err));
    }, []);

    // Persist on change
    const persist = useCallback((newSettings: SettingsState) => {
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings))
            .catch(err => console.warn('Failed to save settings:', err));
    }, []);

    const setOverlayStyle = useCallback((style: OverlayStyle) => {
        setSettings(prev => {
            const next = { ...prev, overlayStyle: style };
            persist(next);
            return next;
        });
    }, [persist]);

    const setTheme = useCallback((theme: ThemeMode) => {
        setSettings(prev => {
            const next = { ...prev, theme };
            persist(next);
            return next;
        });
    }, [persist]);

    const setOverlayTextSize = useCallback((size: number) => {
        setSettings(prev => {
            const next = { ...prev, overlayTextSize: size };
            persist(next);
            return next;
        });
    }, [persist]);

    const setAppLanguage = useCallback((lang: AppLanguage) => {
        setSettings(prev => {
            const next = { ...prev, appLanguage: lang };
            persist(next);
            return next;
        });
    }, [persist]);

    const t = useCallback((key: string): string => {
        return translations[settings.appLanguage]?.[key] || key;
    }, [settings.appLanguage]);

    const value = useMemo<SettingsContextType>(() => ({
        ...settings,
        setOverlayStyle,
        setTheme,
        setOverlayTextSize,
        setAppLanguage,
        t,
    }), [settings, setOverlayStyle, setTheme, setOverlayTextSize, setAppLanguage, t]);

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
};

// ========== Hook ==========
export const useSettings = (): SettingsContextType => {
    const ctx = useContext(SettingsContext);
    if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
    return ctx;
};

export default SettingsContext;
