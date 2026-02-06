import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
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
    private getCollection() {
        return firestore().collection('translations');
    }

    async save(request: TranslationRequest, response: TranslationResponse, strategy: string): Promise<void> {
        const user = auth().currentUser;
        if (!user) {
            console.log('HistoryService: No user logged in, skipping history save');
            return;
        }

        try {
            const collectionRef = this.getCollection();
            if (response.results) {
                const batch = firestore().batch();
                response.results.forEach(item => {
                    const sourceItem = request.items?.find(i => i.id === item.id);
                    if (sourceItem) {
                        const docRef = collectionRef.doc();
                        batch.set(docRef, {
                            userId: user.uid,
                            sourceText: sourceItem.text,
                            translatedText: item.t,
                            sourceLanguage: 'auto',
                            targetLanguage: request.targetLanguage,
                            timestamp: Date.now(),
                            appName: request.appName,
                            strategy: strategy
                        });
                    }
                });
                await batch.commit();
            } else if (response.translatedText && request.text) {
                await collectionRef.add({
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
            // Add retrieval methods later if needed
        } catch (error) {
            console.error('HistoryService: Error saving history', error);
        }
    }
}

export default new HistoryService();
