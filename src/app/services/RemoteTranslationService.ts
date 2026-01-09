export interface BatchItem {
    id: string | number;
    text: string;
}

export interface TranslationRequest {
    text?: string;
    items?: BatchItem[]; // New: support for batch
    appName?: string;
    appCategory?: string;
    targetLanguage: string;
}

export interface TranslationResponse {
    translatedText?: string;
    results?: { id: string | number; t: string }[]; // Changed to 't' for consistency and token efficiency
    source: 'local' | 'remote';
    latencyMs: number;
}

class RemoteTranslationService {
    private readonly endpoint = 'http://YOUR_ORACLE_IP:8080/completion'; // TODO: Load from config
    private readonly apiKey = 'YOUR_SECRET';

    async translate(request: TranslationRequest): Promise<TranslationResponse> {
        const startTime = Date.now();
        const isBatch = !!request.items && request.items.length > 0;

        // 1. Context & Rules
        const contextInfo = request.appName ? `App Name: "${request.appName}"` : "General Application";
        const categoryInfo = request.appCategory ? `Category/Genre: "${request.appCategory}"` : "General Utility";

        const systemInstruction = `
ROLE: Bạn là chuyên gia bản địa hóa (Localization Expert) cho ứng dụng di động.
CONTEXT: 
- ${request.appName ? `App Name: "${request.appName}"` : "General Application"}
- ${request.appCategory ? `Category/Genre: "${request.appCategory}"` : "General Utility"}

RULES:
1. Dịch sang ${request.targetLanguage} một cách tự nhiên, phù hợp với ngữ cảnh game/truyện/app ở trên.
2. GIỮ NGUYÊN các biến đặc biệt (VD: {name}, %s, <br>, \\n), không được dịch chúng.
3. Nếu gặp tên riêng (nhân vật, skill đặc thù) mà không chắc chắn, hãy giữ nguyên hoặc phiên âm Hán Việt nếu là game Tiên hiệp.
4. KHÔNG giải thích, KHÔNG thêm lời dẫn. Chỉ trả về kết quả.
`;

        // 2. ChatML + Prefill (for Batch)
        let prompt = "";
        if (isBatch) {
            prompt = `<|im_start|>system
${systemInstruction}
OUTPUT FORMAT: Chỉ trả về 1 JSON Array hợp lệ, không Markdown, không text thừa.
Cấu trúc: [{"id": "...", "t": "..."}]
<|im_end|>
<|im_start|>user
Dịch các đoạn sau: ${JSON.stringify(request.items)}
<|im_end|>
<|im_start|>assistant
[`;
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
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    prompt: prompt,
                    n_predict: 1024,
                    temperature: 0.1,
                }),
            });

            const data = await response.json();
            let content = data.content.trim();

            if (isBatch) {
                // 3. Post-processing
                if (!content.startsWith("[")) content = "[" + content;
                content = content.replace(/```json/g, "").replace(/```/g, "").trim();

                try {
                    const jsonMatch = content.match(/\[.*\]/s);
                    const results = JSON.parse(jsonMatch ? jsonMatch[0] : content);
                    return {
                        results,
                        source: 'remote',
                        latencyMs: Date.now() - startTime,
                    };
                } catch (e) {
                    console.error('Remote: JSON Parse error:', content);
                    throw new Error('Invalid batch JSON');
                }
            } else {
                return {
                    translatedText: content,
                    source: 'remote',
                    latencyMs: Date.now() - startTime,
                };
            }
        } catch (error) {
            console.error('RemoteTranslationService error:', error);
            throw error;
        }
    }
}

export default new RemoteTranslationService();
