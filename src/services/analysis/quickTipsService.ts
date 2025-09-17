import { Settings } from '@/types';

export async function getQuickTips(text: string, settings: Settings): Promise<string[]> {
    if (!settings.allowBasicLLMGuidance || !settings.apiKey) return [];
    try {
        const { getGeminiModel } = await import('@/services/ai/geminiClient');
        const model = getGeminiModel(settings.apiKey, {
            model: settings.fallbackModel || 'gemini-1.5-flash',
            generationConfig: { temperature: 0, topP: 0, topK: 1, maxOutputTokens: Math.min(256, settings.tipsMaxTokens || 256) },
            systemInstruction: { text: 'Return ONLY 3 short actionable tips for improving OCR readability. Output as a bullet list, one tip per line. No explanations.' } as any,
        });
        const res = await model.generateContent([text.slice(0, 4000)]);
        const out = (await res.response).text().trim();
        const lines = out.split(/\r?\n/).map(l => l.replace(/^[-•\*]\s*/, '').trim()).filter(Boolean);
        return lines.slice(0, 3);
    } catch {
        return [];
    }
}
