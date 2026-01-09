import TranslationManager from './TranslationManager';
import { TranslationRequest, TranslationResponse } from './RemoteTranslationService';

export interface BenchmarkResult {
    id: number;
    text: string;
    length: number;
    latencyMs: number;
    translatedText: string;
    cps: number; // Characters per second
}

class BenchmarkService {
    private testCases = [
        {
            text: "Hello, traveler! Welcome to our village.",
            appName: "Fantasy RPG",
            appCategory: "Role Playing Game"
        },
        {
            text: "You have received 100 gold and a rusty sword. Level up to unlock more skills.",
            appName: "Hero Quest",
            appCategory: "Action RPG"
        },
        {
            text: "The ancient dragon awakes from its slumber in the deep caves of the North. Only the chosen one with the Sacred Blade can seal it again. Are you ready to face your destiny?",
            appName: "Legend of Dragon",
            appCategory: "Adventure"
        },
        {
            text: "System Alert: Your energy is low. Please use a potion or rest at the inn to recover. If you die in the dungeon, you will lose all items collected in this run.",
            appName: "Hardcore Rogue",
            appCategory: "Roguelike"
        }
    ];

    async runTests(onProgress: (result: BenchmarkResult) => void): Promise<void> {
        // 1. Warm-up / Ensure Model is Loaded (Don't time this as inference)
        console.log('Benchmark: Loading model if needed...');
        await TranslationManager.initialize();
        const dummyRequest: TranslationRequest = {
            text: "Hi",
            targetLanguage: "Vietnamese",
            appName: "Benchmark",
            appCategory: "Utility"
        };
        await TranslationManager.translate(dummyRequest);
        console.log('Benchmark: Model loaded and warmed up.');

        // 2. Run actual tests
        for (let i = 0; i < this.testCases.length; i++) {
            const testCase = this.testCases[i];
            const request: TranslationRequest = {
                text: testCase.text,
                targetLanguage: "Vietnamese",
                appName: testCase.appName,
                appCategory: testCase.appCategory
            };

            const startTime = Date.now();
            const response = await TranslationManager.executeTranslation(request); // Use direct execute to avoid queue overhead
            const endTime = Date.now();
            const latencyMs = endTime - startTime;

            const translatedText = response.translatedText || "";
            const length = testCase.text.length;
            const cps = latencyMs > 0 ? (length / (latencyMs / 1000)) : 0;

            onProgress({
                id: i + 1,
                text: testCase.text,
                length,
                latencyMs,
                translatedText,
                cps: parseFloat(cps.toFixed(2))
            });
        }
    }
}

export default new BenchmarkService();
