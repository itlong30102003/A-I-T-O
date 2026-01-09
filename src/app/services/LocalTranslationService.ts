import { initLlama, LlamaContext, getBackendDevicesInfo } from 'llama.rn';
import { TranslationRequest, TranslationResponse } from './RemoteTranslationService';

class LocalTranslationService {
    private context: LlamaContext | null = null;
    private isLoading = false;
    // Model is pushed via ADB to /data/local/tmp/models/ (not bundled in APK)
    private modelPath = '/data/local/tmp/models/qwen2.5-1.5b-instruct-q4_k_m.gguf';

    /**
     * Load the GGUF model into memory
     */
    async loadModel(): Promise<void> {
        if (this.context || this.isLoading) return;

        this.isLoading = true;
        console.log('LocalTranslationService: Starting to load model...');
        const loadStart = Date.now();
        try {
            const devices = await getBackendDevicesInfo();
            console.log('LocalTranslationService: Available backend devices:', JSON.stringify(devices, null, 2));

            this.context = await initLlama({
                model: this.modelPath,
                use_mlock: true,
                n_ctx: 512,
                n_gpu_layers: 100,
                n_threads: 4, // 4 Big cores are faster and cooler than 8 mixed cores
                flash_attn: true,
                // Explicitly targeting the backend found in logs
                devices: ['GPUOpenCL'],
            });
            console.log('LocalTranslationService: Model loaded. Check Logcat for "gpu" or "vulkan" to confirm hardware acceleration.');
            const loadTime = Date.now() - loadStart;
            console.log(`LocalTranslationService: Model loaded successfully in ${loadTime}ms`);
        } catch (error) {
            console.error('LocalTranslationService: Failed to load model:', error);
            throw error;
        } finally {
            this.isLoading = false;
        }
    }

    /**
   * Translate text using llama.rn with Advanced "Pro" Prompting
   */
    async translate(request: TranslationRequest): Promise<TranslationResponse> {
        if (!this.context) {
            await this.loadModel();
        }

        const startTime = Date.now();
        const isBatch = !!request.items && request.items.length > 0;

        // 1. Context & Rules (Localization Expert)
        const contextInfo = request.appName ? `App Name: "${request.appName}"` : "General Application";
        const categoryInfo = request.appCategory ? `Category/Genre: "${request.appCategory}"` : "General Utility";

        const systemInstruction = `Dịch sang ${request.targetLanguage}. KHÔNG giải thích.`;

        // 2. Simple Prompt Construction
        let prompt = "";
        if (isBatch) {
            prompt = `<|im_start|>system\n${systemInstruction}\nCấu trúc: [{"id": "...", "t": "..."}]\n<|im_end|>\n<|im_start|>user\n${JSON.stringify(request.items!.map(item => ({ id: item.id, text: item.text })))}\n<|im_end|>\n<|im_start|>assistant\n[`;
        } else {
            prompt = `<|im_start|>user\n"${request.text}"\nDịch sang ${request.targetLanguage}. Chỉ trả về kết quả.\n<|im_end|>\n<|im_start|>assistant\n`;
        }

        try {
            console.log('LocalTranslationService: Starting inference with simplified prompt...');
            const inferenceStart = Date.now();
            const result = await this.context!.completion({
                prompt: prompt,
                n_predict: 128, // Small prediction window for speed
                stop: ['<|im_end|>', '<|im_start|>', '\n'],
                temperature: 0.1,
            });
            const inferenceTime = Date.now() - inferenceStart;
            console.log(`LocalTranslationService: Inference completed in ${inferenceTime}ms`);

            let content = result.text.trim();

            if (isBatch) {
                // 3. Post-processing (The "Cleaning" Stage)
                if (!content.startsWith("[")) {
                    content = "[" + content;
                }

                // Remove markdown garbage
                content = content.replace(/```json/g, "").replace(/```/g, "").trim();

                try {
                    // Extract purely the JSON part
                    const jsonMatch = content.match(/\[.*\]/s);
                    const results = JSON.parse(jsonMatch ? jsonMatch[0] : content);
                    return {
                        results,
                        source: 'local',
                        latencyMs: Date.now() - startTime,
                    };
                } catch (e) {
                    console.error('LocalTranslationService: JSON Parse Failed. Raw:', content);
                    throw new Error('AI returned invalid JSON format');
                }
            } else {
                return {
                    translatedText: content,
                    source: 'local',
                    latencyMs: Date.now() - startTime,
                };
            }
        } catch (error) {
            console.error('LocalTranslationService: Inference error:', error);
            throw error;
        }
    }

    async isModelLoaded(): Promise<boolean> {
        return this.context !== null;
    }

    async release(): Promise<void> {
        if (this.context) {
            await this.context.release();
            this.context = null;
        }
    }
}

export default new LocalTranslationService();
