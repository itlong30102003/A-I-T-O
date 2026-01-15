import TranslateText, { TranslateLanguage } from '@react-native-ml-kit/translate-text';
import { TranslationRequest, TranslationResponse } from './RemoteTranslationService';

class MLKitTranslationService {
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

export default new MLKitTranslationService();
