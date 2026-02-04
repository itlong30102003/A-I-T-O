import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { LANGUAGES, MODES, TranslationMode, SelectionType, LanguageItem } from './constants';

// App-wide state interface
interface AppState {
    // Translation settings
    translationMode: TranslationMode;
    selectionType: SelectionType;
    sourceLang: LanguageItem;
    targetLang: LanguageItem;

    // UI state
    showCameraScreen: boolean;
    showLanguageModal: 'source' | 'target' | null;
    showResultModal: boolean;
    selectedText: string;
}

// Context actions interface
interface AppActions {
    setTranslationMode: (mode: TranslationMode) => void;
    setSelectionType: (type: SelectionType) => void;
    setSourceLang: (lang: LanguageItem) => void;
    setTargetLang: (lang: LanguageItem) => void;
    setShowCameraScreen: (show: boolean) => void;
    setShowLanguageModal: (modal: 'source' | 'target' | null) => void;
    setShowResultModal: (show: boolean) => void;
    setSelectedText: (text: string) => void;
    handleModeChange: (modeId: TranslationMode) => void;
}

// Combined context type
interface AppContextType extends AppState, AppActions { }

// Create context with default values
const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider component
interface AppProviderProps {
    children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
    // State
    const [translationMode, setTranslationMode] = useState<TranslationMode>('REALTIME');
    const [selectionType, setSelectionType] = useState<SelectionType>('WORD');
    const [sourceLang, setSourceLang] = useState<LanguageItem>(LANGUAGES.source[0]);
    const [targetLang, setTargetLang] = useState<LanguageItem>(LANGUAGES.target[0]);
    const [showCameraScreen, setShowCameraScreen] = useState(false);
    const [showLanguageModal, setShowLanguageModal] = useState<'source' | 'target' | null>(null);
    const [showResultModal, setShowResultModal] = useState(false);
    const [selectedText, setSelectedText] = useState('Nội dung sẽ được dịch ở đây...');

    // Handle mode change with camera special case - using useCallback for optimization
    const handleModeChange = useCallback((modeId: TranslationMode) => {
        if (modeId === 'CAMERA') {
            setShowCameraScreen(true);
        } else {
            setTranslationMode(modeId);
            setShowCameraScreen(false);
        }
    }, []);

    // Memoize context value to prevent unnecessary re-renders
    const contextValue = useMemo<AppContextType>(() => ({
        // State
        translationMode,
        selectionType,
        sourceLang,
        targetLang,
        showCameraScreen,
        showLanguageModal,
        showResultModal,
        selectedText,
        // Actions
        setTranslationMode,
        setSelectionType,
        setSourceLang,
        setTargetLang,
        setShowCameraScreen,
        setShowLanguageModal,
        setShowResultModal,
        setSelectedText,
        handleModeChange,
    }), [
        translationMode,
        selectionType,
        sourceLang,
        targetLang,
        showCameraScreen,
        showLanguageModal,
        showResultModal,
        selectedText,
        handleModeChange,
    ]);

    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    );
};

// Custom hook to use the context
export const useAppContext = (): AppContextType => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};

export default AppContext;
