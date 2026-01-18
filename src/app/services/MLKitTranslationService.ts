import TranslateText, { TranslateLanguage } from '@react-native-ml-kit/translate-text';
import { TranslationRequest, TranslationResponse } from './RemoteTranslationService';

// Model loading status interface
export interface ModelLoadingStatus {
    isLoading: boolean;
    loaded: boolean;
    progress: number;
    total: number;
}

// Define language pairs to preload - most common combinations
const PRELOAD_LANGUAGE_PAIRS: Array<{ source: TranslateLanguage; target: TranslateLanguage }> = [
    { source: TranslateLanguage.ENGLISH, target: TranslateLanguage.VIETNAMESE },
    { source: TranslateLanguage.CHINESE, target: TranslateLanguage.VIETNAMESE },
    { source: TranslateLanguage.JAPANESE, target: TranslateLanguage.VIETNAMESE },
    { source: TranslateLanguage.KOREAN, target: TranslateLanguage.VIETNAMESE },
];

class MLKitTranslationService {
    private _isModelLoading = false;
    private _modelsLoaded = false;
    private _loadingProgress = 0;
    private _loadingTotal = PRELOAD_LANGUAGE_PAIRS.length;
    private _statusListeners: Array<(status: ModelLoadingStatus) => void> = [];

    get isModelLoading(): boolean {
        return this._isModelLoading;
    }

    get modelsLoaded(): boolean {
        return this._modelsLoaded;
    }

    get loadingProgress(): number {
        return this._loadingProgress;
    }

    get loadingTotal(): number {
        return this._loadingTotal;
    }

    /**
     * Subscribe to model loading status changes
     */
    onStatusChange(callback: (status: ModelLoadingStatus) => void): () => void {
        this._statusListeners.push(callback);
        return () => {
            this._statusListeners = this._statusListeners.filter(cb => cb !== callback);
        };
    }

    private notifyStatusChange(): void {
        const status: ModelLoadingStatus = {
            isLoading: this._isModelLoading,
            loaded: this._modelsLoaded,
            progress: this._loadingProgress,
            total: this._loadingTotal,
        };
        this._statusListeners.forEach(cb => cb(status));
    }

    /**
     * Pre-download translation models to avoid delay on first translation
     * Call this at app startup to ensure fast translations later
     */
    async preloadModels(): Promise<void> {
        if (this._modelsLoaded || this._isModelLoading) {
            console.log('MLKitTranslationService: Models already loaded or loading');
            return;
        }

        this._isModelLoading = true;
        this._loadingProgress = 0;
        this.notifyStatusChange();

        console.log(`MLKitTranslationService: Starting to preload ${PRELOAD_LANGUAGE_PAIRS.length} translation models...`);
        const startTime = Date.now();

        for (let i = 0; i < PRELOAD_LANGUAGE_PAIRS.length; i++) {
            const pair = PRELOAD_LANGUAGE_PAIRS[i];
            try {
                console.log(`MLKitTranslationService: Preloading model ${i + 1}/${PRELOAD_LANGUAGE_PAIRS.length} (${pair.source} -> ${pair.target})`);

                // Translate a simple text to trigger model download
                await TranslateText.translate({
                    text: 'Hello',
                    sourceLanguage: pair.source,
                    targetLanguage: pair.target,
                    downloadModelIfNeeded: true,
                });

                this._loadingProgress = i + 1;
                this.notifyStatusChange();
                console.log(`MLKitTranslationService: Model ${pair.source} -> ${pair.target} ready`);
            } catch (error) {
                console.warn(`MLKitTranslationService: Failed to preload ${pair.source} -> ${pair.target}:`, error);
            }
        }

        const duration = Date.now() - startTime;
        console.log(`MLKitTranslationService: All models preloaded in ${duration}ms`);

        this._isModelLoading = false;
        this._modelsLoaded = true;
        this.notifyStatusChange();
    }

    /**
     * Map language code string to ML Kit TranslateLanguage enum
     */
    private mapLanguageCode(code?: string): TranslateLanguage {
        if (!code) return TranslateLanguage.ENGLISH;

        const lowerCode = code.toLowerCase();
        // Common language mappings
        const languageMap: Record<string, TranslateLanguage> = {
            'en': TranslateLanguage.ENGLISH,
            'vi': TranslateLanguage.VIETNAMESE,
            'zh': TranslateLanguage.CHINESE,
            'ja': TranslateLanguage.JAPANESE,
            'ko': TranslateLanguage.KOREAN,
            'auto': TranslateLanguage.ENGLISH, // Default to English for auto-detect
        };

        return languageMap[lowerCode] || TranslateLanguage.ENGLISH;
    }

    /**
     * Translate text using Google ML Kit (On-device NMT)
     */
    async translate(request: TranslationRequest): Promise<TranslationResponse> {
        const startTime = Date.now();
        const isBatch = !!request.items && request.items.length > 0;

        // Map language codes to ML Kit enum
        const sourceLang = this.mapLanguageCode(request.sourceLanguage);
        const targetLang = this.mapLanguageCode(request.targetLanguage);

        try {
            if (isBatch) {
                console.log(`MLKitTranslationService: Batch ${request.items!.length} items (${request.sourceLanguage || 'auto'} -> ${request.targetLanguage})`);

                const results = await Promise.all(
                    request.items!.map(async (item) => {
                        const translated = (await TranslateText.translate({
                            text: item.text,
                            sourceLanguage: sourceLang,
                            targetLanguage: targetLang,
                            downloadModelIfNeeded: true,
                        })) as unknown as string;
                        return { id: item.id, t: translated };
                    })
                );

                const latencyMs = Date.now() - startTime;
                console.log(`MLKitTranslationService: Batch completed in ${latencyMs}ms`);

                return {
                    results,
                    source: 'local',
                    latencyMs,
                };
            } else {
                console.log(`MLKitTranslationService: Single text (${request.sourceLanguage || 'auto'} -> ${request.targetLanguage})`);
                const translatedText = (await TranslateText.translate({
                    text: request.text!,
                    sourceLanguage: sourceLang,
                    targetLanguage: targetLang,
                    downloadModelIfNeeded: true,
                })) as unknown as string;

                const latencyMs = Date.now() - startTime;
                console.log(`MLKitTranslationService: Completed in ${latencyMs}ms`);

                return {
                    translatedText,
                    source: 'local',
                    latencyMs,
                };
            }
        } catch (error) {
            console.error('MLKitTranslationService: Translation error:', error);
            throw error;
        }
    }
}

const mlKitTranslationService = new MLKitTranslationService();
export { mlKitTranslationService };
export default mlKitTranslationService;
