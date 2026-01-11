import MLKitTranslationService from './MLKitTranslationService';
import { TranslationRequest, TranslationResponse } from './RemoteTranslationService';

export type TranslationStrategy = 'MLKIT' | 'QWEN';

class TranslationManager {
    private strategy: TranslationStrategy = 'MLKIT';
    private activeStrategy: 'MLKIT' = 'MLKIT';
    private isInitialized = false;

    /**
     * Initialize the manager and force MLKIT usage
     */
    async initialize(preferredStrategy: TranslationStrategy = 'MLKIT') {
        this.strategy = 'MLKIT';
        this.activeStrategy = 'MLKIT';
        console.log('TranslationManager: Initialized with MLKIT as the exclusive strategy');
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
            const strategy = request.strategy || this.activeStrategy;

            let response: TranslationResponse;
            if (strategy === 'QWEN') {
                const LocalTranslationService = require('./LocalTranslationService').default;
                response = await LocalTranslationService.translate(request);
            } else {
                response = await MLKitTranslationService.translate(request);
            }

            if (request.saveHistory) {
                const HistoryService = require('./HistoryService').default;
                // No await here -> Fire and Forget to not block UI? 
                // Alternatively await if we want to ensure it saves. Fire and forget is better for UX latency.
                HistoryService.save(request, response, strategy).catch((err: any) =>
                    console.error('TranslationManager: Background history save failed', err)
                );
            }

            return response;
        } catch (error) {
            console.error(`TranslationManager: Translation failed for strategy ${request.strategy}`, error);
            throw error;
        }
    }

    getActiveStrategy(): string {
        return this.activeStrategy;
    }
}

export default new TranslationManager();
