import { initLlama, LlamaContext } from 'llama.rn';
import { TranslationRequest, TranslationResponse } from './RemoteTranslationService';

class LocalTranslationService {
    private context: LlamaContext | null = null;
    private isLoading = false;
    private modelPath = 'models/qwen2.5-1.5b-instruct-q4_k_m.gguf'; // Path relative to assets

    /**
     * Load the GGUF model into memory
     */
    async loadModel(): Promise<void> {
        if (this.context || this.isLoading) return;

        this.isLoading = true;
        console.log('LocalTranslationService: Loading model from assets...');
        try {
            this.context = await initLlama({
                model: this.modelPath,
                use_mlock: true,
                n_ctx: 2048,
                n_gpu_layers: 0, // Force CPU for stability on varied devices
            });
            console.log('LocalTranslationService: Model loaded successfully');
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

        const systemInstruction = `
ROLE: Bạn là chuyên gia bản địa hóa (Localization Expert) cho ứng dụng di động.
CONTEXT: 
- ${contextInfo}
- ${categoryInfo}

RULES:
1. Dịch sang ${request.targetLanguage} một cách tự nhiên, phù hợp với ngữ cảnh game/truyện/app ở trên.
2. GIỮ NGUYÊN các biến đặc biệt (VD: {name}, %s, <br>, \\n), không được dịch chúng.
3. Nếu gặp tên riêng (nhân vật, skill đặc thù) mà không chắc chắn, hãy giữ nguyên hoặc phiên âm Hán Việt.
4. KHÔNG giải thích, KHÔNG thêm lời dẫn. Chỉ trả về kết quả.
`;

        // 2. ChatML Construction with Prefill
        let prompt = "";
        if (isBatch) {
            prompt = `<|im_start|>system
${systemInstruction}
OUTPUT FORMAT: Chỉ trả về 1 JSON Array hợp lệ, không Markdown, không text thừa.
Cấu trúc: [{"id": "...", "t": "..."}]
<|im_end|>
<|im_start|>user
Dịch danh sách này:
${JSON.stringify(request.items!.map(item => ({ id: item.id, text: item.text })))}
<|im_end|>
<|im_start|>assistant
[`; // Prefill for JSON
        } else {
            prompt = `<|im_start|>system
${systemInstruction}
<|im_end|>
<|im_start|>user
"${request.text}"
<|im_end|>
<|im_start|>assistant
`;
        }

        try {
            const result = await this.context!.completion({
                prompt: prompt,
                n_predict: 1024,
                stop: ['<|im_end|>', '<|im_start|>', '\n\n'],
                temperature: 0.1,
            });

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
