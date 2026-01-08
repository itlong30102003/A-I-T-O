import DeviceService from './DeviceService';
import LocalTranslationService from './LocalTranslationService';
import RemoteTranslationService, { TranslationRequest, TranslationResponse } from './RemoteTranslationService';

export type TranslationStrategy = 'LOCAL' | 'REMOTE' | 'AUTO';

class TranslationManager {
    private strategy: TranslationStrategy = 'AUTO';
    private activeStrategy: 'LOCAL' | 'REMOTE' = 'REMOTE';
    private isInitialized = false;

    /**
     * Initialize the manager and decide the strategy
     */
    async initialize(preferredStrategy: TranslationStrategy = 'AUTO') {
        this.strategy = preferredStrategy;

        if (this.strategy === 'AUTO') {
            const totalRam = await DeviceService.getTotalRam();
            console.log(`TranslationManager: Detected ${totalRam.toFixed(2)}GB RAM`);

            // Threshold: 4GB RAM for Local Inference
            if (totalRam >= 4) {
                this.activeStrategy = 'LOCAL';
                console.log('TranslationManager: Choosing LOCAL strategy');
            } else {
                this.activeStrategy = 'REMOTE';
                console.log('TranslationManager: Choosing REMOTE strategy (Fallback for low RAM)');
            }
        } else {
            this.activeStrategy = this.strategy as 'LOCAL' | 'REMOTE';
        }

        this.isInitialized = true;
    }

    /**
   * Main entry point for translation (Microservice API)
   * All requests go through the queue
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
            if (this.activeStrategy === 'LOCAL') {
                return await LocalTranslationService.translate(request);
            } else {
                return await RemoteTranslationService.translate(request);
            }
        } catch (error) {
            console.error(`TranslationManager: ${this.activeStrategy} failed, trying fallback...`);

            // Fallback logic
            if (this.activeStrategy === 'LOCAL') {
                return await RemoteTranslationService.translate(request);
            } else {
                throw error; // If remote fails, let the caller handle it or retry
            }
        }
    }

    getActiveStrategy(): string {
        return this.activeStrategy;
    }
}

export default new TranslationManager();
