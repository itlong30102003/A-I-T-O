import MLKitTranslationService from './MLKitTranslationService';
import { TranslationRequest, TranslationResponse } from './RemoteTranslationService';

export type TranslationStrategy = 'MLKIT';

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
            // Only use ML Kit as requested
            return await MLKitTranslationService.translate(request);
        } catch (error) {
            console.error(`TranslationManager: MLKIT translation failed`, error);
            throw error;
        }
    }

    getActiveStrategy(): string {
        return this.activeStrategy;
    }
}

export default new TranslationManager();
