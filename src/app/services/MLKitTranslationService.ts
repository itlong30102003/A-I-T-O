import TranslateText, { TranslateLanguage } from '@react-native-ml-kit/translate-text';
import { TranslationRequest, TranslationResponse } from './RemoteTranslationService';

class MLKitTranslationService {
    /**
     * Translate text using Google ML Kit (On-device NMT)
     */
    async translate(request: TranslationRequest): Promise<TranslationResponse> {
        const startTime = Date.now();
        const isBatch = !!request.items && request.items.length > 0;

        // Map target language string to ML Kit TranslateLanguage enum
        // ML Kit uses ISO 639-1 codes (e.g., 'vi' for Vietnamese)
        let targetLang = TranslateLanguage.VIETNAMESE;
        if (request.targetLanguage.toLowerCase().includes('en')) {
            targetLang = TranslateLanguage.ENGLISH;
        } else if (request.targetLanguage.toLowerCase().includes('vi')) {
            targetLang = TranslateLanguage.VIETNAMESE;
        }
        // Add more mappings as needed

        try {
            if (isBatch) {
                console.log(`MLKitTranslationService: Starting batch translation of ${request.items!.length} items...`);

                // ML Kit Translate doesn't support batching natively in the same call (wrapper level),
                // so we process items. 
                // Note: ML Kit is very fast, but 20+ parallel calls might be heavy.
                // However, it's safer for now to use Promise.all.
                const results = await Promise.all(
                    request.items!.map(async (item) => {
                        const translated = (await TranslateText.translate({
                            text: item.text,
                            sourceLanguage: TranslateLanguage.ENGLISH, // Defaulting to English source
                            targetLanguage: targetLang,
                            downloadModelIfNeeded: true,
                        })) as unknown as string;
                        return { id: item.id, t: translated };
                    })
                );

                const latencyMs = Date.now() - startTime;
                console.log(`MLKitTranslationService: Batch translation completed in ${latencyMs}ms`);

                return {
                    results,
                    source: 'local',
                    latencyMs,
                };
            } else {
                console.log(`MLKitTranslationService: Translating single text: "${request.text?.substring(0, 20)}..."`);
                const translatedText = (await TranslateText.translate({
                    text: request.text!,
                    sourceLanguage: TranslateLanguage.ENGLISH,
                    targetLanguage: targetLang,
                    downloadModelIfNeeded: true,
                })) as unknown as string;

                const latencyMs = Date.now() - startTime;
                console.log(`MLKitTranslationService: Translation completed in ${latencyMs}ms`);

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
