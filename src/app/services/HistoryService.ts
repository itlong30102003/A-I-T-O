import { getAuth } from '@react-native-firebase/auth';
import { getFirestore, collection, doc, writeBatch, serverTimestamp, setDoc, addDoc, query, where, orderBy, limit, onSnapshot, getDocs } from '@react-native-firebase/firestore';
import { TranslationRequest, TranslationResponse } from './RemoteTranslationService';

export interface HistoryItem {
    id?: string;
    userId: string;
    sourceText: string;
    translatedText: string;
    sourceLanguage: string;
    targetLanguage: string;
    timestamp: number;
    strategy: string;
}

class HistoryService {
    private getCollection() {
        const db = getFirestore();
        return collection(db, 'translations');
    }

    async save(request: TranslationRequest, response: TranslationResponse, strategy: string): Promise<void> {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) {
            console.log('HistoryService: No user logged in, skipping history save');
            return;
        }

        try {
            const collectionRef = this.getCollection();
            const db = getFirestore();

            if (response.results) {
                const batch = writeBatch(db);
                response.results.forEach(item => {
                    const sourceItem = request.items?.find(i => i.id === item.id);
                    if (sourceItem) {
                        const docRef = doc(collectionRef);
                        batch.set(docRef, {
                            userId: user.uid,
                            sourceText: sourceItem.text,
                            translatedText: item.t,
                            sourceLanguage: 'auto',
                            targetLanguage: request.targetLanguage,
                            timestamp: Date.now(),
                            strategy: strategy
                        });
                    }
                });
                await batch.commit();
                console.log('HistoryService: Batch saved successfully');
            } else if (response.translatedText && request.text) {
                await addDoc(collectionRef, {
                    userId: user.uid,
                    sourceText: request.text,
                    translatedText: response.translatedText,
                    sourceLanguage: 'auto',
                    targetLanguage: request.targetLanguage,
                    timestamp: Date.now(),
                    strategy: strategy
                });
                console.log('HistoryService: Single item saved successfully');
            }
        } catch (error) {
            console.error('HistoryService: Error saving history', error);
        }
    }

    /**
     * Subscribe to history updates in real-time
     */
    subscribeToHistory(
        strategy: 'WORD' | 'PARAGRAPH',
        onUpdate: (items: HistoryItem[]) => void,
        limitCount: number = 20
    ): () => void {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) {
            console.log('HistoryService: No user logged in');
            onUpdate([]);
            return () => { };
        }

        console.log(`HistoryService: Subscribing to ${strategy} history...`);

        try {
            const q = query(
                this.getCollection(),
                where('userId', '==', user.uid),
                where('strategy', '==', strategy),
                orderBy('timestamp', 'desc'),
                limit(limitCount)
            );

            return onSnapshot(
                q,
                (snapshot) => {
                    const items = snapshot.docs.map((doc: any) => ({
                        id: doc.id,
                        ...doc.data(),
                    } as HistoryItem));
                    onUpdate(items);
                },
                (error) => {
                    console.error('HistoryService: Subscription error', error);
                }
            );
        } catch (error) {
            console.error('HistoryService: Error setting up subscription', error);
            return () => { };
        }
    }

    async getHistory(strategy: 'WORD' | 'PARAGRAPH', limitCount: number = 20): Promise<HistoryItem[]> {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) {
            console.log('HistoryService: No user logged in');
            return [];
        }

        try {
            const q = query(
                this.getCollection(),
                where('userId', '==', user.uid),
                where('strategy', '==', strategy),
                orderBy('timestamp', 'desc'),
                limit(limitCount)
            );

            const snapshot = await getDocs(q);

            return snapshot.docs.map((doc: any) => ({
                id: doc.id,
                ...doc.data(),
            } as HistoryItem));
        } catch (error) {
            console.error('HistoryService: Error fetching history', error);
            return [];
        }
    }
}

export default new HistoryService();
