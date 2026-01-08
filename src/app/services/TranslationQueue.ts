import { TranslationRequest, TranslationResponse } from './RemoteTranslationService';
import TranslationManager from './TranslationManager';

interface QueueItem {
    request: TranslationRequest;
    resolve: (value: TranslationResponse | PromiseLike<TranslationResponse>) => void;
    reject: (reason?: any) => void;
}

class TranslationQueue {
    private queue: QueueItem[] = [];
    private isProcessing = false;
    private maxBatchSize = 1; // For now, process one by one to save RAM

    /**
     * Add a translation request to the queue
     */
    async enqueue(request: TranslationRequest): Promise<TranslationResponse> {
        return new Promise((resolve, reject) => {
            // If we have too many pending items, drop the oldest ones (LIFO for real-time)
            if (this.queue.length > 5) {
                const dropped = this.queue.shift();
                dropped?.reject('Request dropped: Queue full (Real-time priority)');
            }

            this.queue.push({ request, resolve, reject });
            this.processNext();
        });
    }

    private async processNext() {
        if (this.isProcessing || this.queue.length === 0) return;

        this.isProcessing = true;
        const item = this.queue.shift();

        if (item) {
            try {
                const result = await TranslationManager.executeTranslation(item.request);
                item.resolve(result);
            } catch (error) {
                item.reject(error);
            }
        }

        this.isProcessing = false;
        this.processNext();
    }
}

export default new TranslationQueue();
