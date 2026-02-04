// Core constants extracted from MainScreen.js
// These are shared across all modules

export const LANGUAGES = {
    source: [
        { code: 'auto', label: '✨ Auto Detect' },
        { code: 'en', label: '🇺🇸 English' },
        { code: 'zh', label: '🇨🇳 Chinese' },
        { code: 'ja', label: '🇯🇵 Japanese' },
        { code: 'ko', label: '🇰🇷 Korean' },
        { code: 'vi', label: '🇻🇳 Vietnamese' },
    ],
    target: [
        { code: 'vi', label: '🇻🇳 Vietnamese' },
        { code: 'en', label: '🇺🇸 English' },
    ]
};

export const MODES = [
    { id: 'REALTIME', label: '⚡ Realtime', desc: 'Dịch trực tiếp (ML Kit)' },
    { id: 'SELECTION', label: '🖐️ Selection', desc: 'Chọn vùng dịch (ML Kit)' },
    { id: 'CAMERA', label: '📷 Camera', desc: 'Dịch qua Camera AR' },
];

export type TranslationMode = 'REALTIME' | 'SELECTION' | 'CAMERA';
export type SelectionType = 'WORD' | 'PARAGRAPH';

export interface LanguageItem {
    code: string;
    label: string;
}
