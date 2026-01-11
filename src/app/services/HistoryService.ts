import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { TranslationRequest, TranslationResponse } from './RemoteTranslationService';

interface HistoryItem {
    userId: string;
    sourceText: string;
    translatedText: string;
    sourceLanguage: string;
    targetLanguage: string;
    timestamp: number;
    appName?: string;
    strategy: string;
}

class HistoryService {
    private collectionRef = firestore().collection('translations');

    async save(request: TranslationRequest, response: TranslationResponse, strategy: string): Promise<void> {
        const user = auth().currentUser;
        if (!user) {
            console.log('HistoryService: No user logged in, skipping history save');
            return;
        }

        try {
            // Handle Batch vs Dictionary vs Simple
            // For now, assume simple text or simple batch
            // Flatten batch results for history? Or save as one batch?
            // "Dịch theo vùng chọn (Qwen + lưu lịch sử dịch)" implies likely single text blocks or one entry.
            // If it's a batch, we probably want to save individual known good translations or the whole session.
            // Let's iterate if it's a batch of independent items.

            if (response.results) {
                const batch = firestore().batch();
                response.results.forEach(item => {
                    const sourceItem = request.items?.find(i => i.id === item.id);
                    if (sourceItem) {
                        const docRef = this.collectionRef.doc();
                        batch.set(docRef, {
                            userId: user.uid,
                            sourceText: sourceItem.text,
                            translatedText: item.t,
                            sourceLanguage: 'auto', // or from request if available
                            targetLanguage: request.targetLanguage,
                            timestamp: Date.now(),
                            appName: request.appName,
                            strategy: strategy
                        });
                    }
                });
                await batch.commit();
            } else if (response.translatedText && request.text) {
                await this.collectionRef.add({
                    userId: user.uid,
                    sourceText: request.text,
                    translatedText: response.translatedText,
                    sourceLanguage: 'auto',
                    targetLanguage: request.targetLanguage,
                    timestamp: Date.now(),
                    appName: request.appName,
                    strategy: strategy
                });
            }
            console.log('HistoryService: Saved translation to history');
        } catch (error) {
            console.error('HistoryService: Failed to save history', error);
        }
    }

    // Add retrieval methods later if needed
}

export default new HistoryService();
