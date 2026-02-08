import MLKitTranslationService from './MLKitTranslationService';
import { TranslationRequest, TranslationResponse } from './RemoteTranslationService';

export type TranslationStrategy = 'MLKIT';

class TranslationManager {
    private isInitialized = false;

    /**
     * Initialize the manager
     */
    async initialize() {
        console.log('TranslationManager: Initialized with ML Kit');
        this.isInitialized = true;
    }

    /**
    * Main entry point for translation (Microservice API)
    */
    async translate(request: TranslationRequest): Promise<TranslationResponse> {
        const TranslationQueue = require('./TranslationQueue').default;
        return await TranslationQueue.enqueue(request);
    }

    /**
     * Private execution logic called by the Queue
     */
    async executeTranslation(request: TranslationRequest): Promise<TranslationResponse> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            const response = await MLKitTranslationService.translate(request);

            if (request.saveHistory && request.selectionMode) {
                const HistoryService = require('./HistoryService').default;
                HistoryService.save(request, response, request.selectionMode).catch((err: any) =>
                    console.error('TranslationManager: Background history save failed', err)
                );
            }

            return response;
        } catch (error) {
            console.error('TranslationManager: Translation failed', error);
            throw error;
        }
    }

    getActiveStrategy(): string {
        return 'MLKIT';
    }
}

export default new TranslationManager();
