import { ProofreadingSuggestion, Settings } from '@/types';
import { enforceEthiopicPunctuationAndQuotes } from '@/utils/textUtils';

type Source = 'edge-webllm' | 'edge-ollama' | 'unavailable';

let webllmEngine: any = null;
let webllmLoading: Promise<boolean> | null = null;
let webllmProgress = 0;

function loadScriptOnce(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[data-webllm="${src}"]`)) return resolve();
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.defer = true;
        s.dataset.webllm = src;
        s.onload = () => resolve();
        s.onerror = (e) => reject(e);
        document.head.appendChild(s);
    });
}

export function getEdgeProgress(): number { return webllmProgress; }

export async function ensureEdgeModel(settings: Settings): Promise<boolean> {
    if (!settings.edgeLLMEnabled) return false;
    const isProd = typeof import.meta !== 'undefined' && (import.meta as any).env?.PROD;
    if (settings.edgeLLMProvider === 'ollama') {
        if (isProd) return false; // disable Ollama in production builds
        // Assume local Ollama is reachable; optionally ping
        try {
            const endpoint = (settings.edgeLLMEndpoint || 'http://localhost:11434').replace(/\/$/, '');
            const resp = await fetch(`${endpoint}/api/tags`, { method: 'GET' });
            return resp.ok;
        } catch {
            return false;
        }
    }
    if (settings.edgeLLMProvider !== 'webllm') return false;
    if (!('gpu' in navigator)) return false; // quick WebGPU check
    try {
        if (webllmEngine) return true;
        if (!webllmLoading) {
            webllmLoading = (async () => {
                // Load WebLLM library via CDN (no bundler dependency)
                const cdn = 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm/dist/webllm.min.js';
                try { await loadScriptOnce(cdn); } catch { return false; }
                const g: any = (window as any);
                if (!g.webllm || !g.webllm.CreateMLCEngine) return false;

                const modelId = settings.edgeLLMModel || 'gemma-3-1b-q4';
                const baseUrl = settings.edgeLLMBaseUrl || '';

                // Build init config; if baseUrl provided, point to custom artifacts
                const initConfig: any = {};
                if (baseUrl) initConfig.model_url = baseUrl.replace(/\/$/, '') + '/';

                webllmProgress = 0;
                const progress = (report: any) => {
                    const p = Number(report?.progress || 0);
                    if (!Number.isNaN(p)) webllmProgress = Math.max(0, Math.min(100, Math.round(p * 100)));
                };

                try {
                    webllmEngine = await g.webllm.CreateMLCEngine(modelId, initConfig, progress);
                    return true;
                } catch {
                    webllmEngine = null; return false;
                }
            })();
        }
        return await webllmLoading;
    } catch {
        return false;
    }
}

export async function proofreadAmharicWithMetaEdge(
    _text: string,
    settings: Settings,
    _opts?: { maxSuggestions?: number }
): Promise<{ suggestions: ProofreadingSuggestion[]; source: Source }> {
    const ok = await ensureEdgeModel(settings);
    if (!ok) return { suggestions: [], source: 'unavailable' };
    if (settings.edgeLLMProvider === 'ollama') {
        try {
            const endpoint = (settings.edgeLLMEndpoint || 'http://localhost:11434').replace(/\/$/, '');
            const model = settings.edgeLLMModel || 'gemma:2b';
            const prompt = `You are an expert Amharic proofreader. Return ONLY a JSON array with items like\n[{"original":"...","suggestion":"...","reason":"...","confidence":0.0}]\nRules:\n- Amharic (Ethiopic) only, preserve meaning; no English/Latin letters.\n- Correct OCR errors: mixed scripts, vowel marks, punctuation (። ፣), word splits.\n- Limit to 20 high-value suggestions.\nText:\n` + _text;

            const res = await fetch(`${endpoint}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    prompt,
                    stream: false,
                    options: { temperature: 0, top_p: 0.9, num_predict: 512 }
                })
            });
            if (!res.ok) return { suggestions: [], source: 'edge-ollama' };
            const data = await res.json();
            const out: string = data?.response || '';
            const jsonText = extractJson(out);
            if (!jsonText) return { suggestions: [], source: 'edge-ollama' };
            const arr = JSON.parse(jsonText);
            if (!Array.isArray(arr)) return { suggestions: [], source: 'edge-ollama' };
            const suggestions: ProofreadingSuggestion[] = arr
                .filter((s: any) => s && typeof s.original === 'string' && typeof s.suggestion === 'string' && s.original.trim() && s.suggestion.trim() && s.original !== s.suggestion)
                .map((s: any) => ({ original: s.original, suggestion: s.suggestion, reason: s.reason || 'አማርኛ ማረሚያ', confidence: typeof s.confidence === 'number' ? s.confidence : 0.7 }))
                .slice(0, (_opts?.maxSuggestions ?? 20));
            const cleaned = suggestions.map((s) => ({
                ...s,
                original: postClean(s.original),
                suggestion: postClean(s.suggestion),
            })).filter((s) => s.original && s.suggestion && s.original !== s.suggestion);
            return { suggestions: cleaned, source: 'edge-ollama' };
        } catch {
            return { suggestions: [], source: 'unavailable' };
        }
    }
    try {
        const engine: any = webllmEngine;
        if (!engine) return { suggestions: [], source: 'unavailable' };

        const prompt = `You are an expert Amharic proofreader.
Return ONLY a JSON array with items like:
[{"original":"...","suggestion":"...","reason":"...","confidence":0.0}]
Rules:
- Amharic (Ethiopic) only, preserve meaning; no English/Latin letters.
- Correct OCR errors: mixed scripts, vowel marks, punctuation (። ፣), word splits.
- Limit to 20 high-value suggestions.
Text:\n` + _text;

        // Try OpenAI-style interface if available
        let out: string | null = null;
        if (engine.chat?.completions?.create) {
            const res = await engine.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                temperature: 0,
            } as any);
            out = res?.choices?.[0]?.message?.content ?? null;
        } else if (engine.generate) {
            out = String(await engine.generate(prompt));
        } else {
            return { suggestions: [], source: 'unavailable' };
        }

        if (!out || typeof out !== 'string') return { suggestions: [], source: 'edge-webllm' };
        const jsonText = extractJson(out);
        if (!jsonText) return { suggestions: [], source: 'edge-webllm' };
        const arr = JSON.parse(jsonText);
        if (!Array.isArray(arr)) return { suggestions: [], source: 'edge-webllm' };
        const suggestions: ProofreadingSuggestion[] = arr
            .filter((s: any) => s && typeof s.original === 'string' && typeof s.suggestion === 'string' && s.original.trim() && s.suggestion.trim() && s.original !== s.suggestion)
            .map((s: any) => ({ original: s.original, suggestion: s.suggestion, reason: s.reason || 'አማርኛ ማረሚያ', confidence: typeof s.confidence === 'number' ? s.confidence : 0.7 }))
            .slice(0, (_opts?.maxSuggestions ?? 20));
        const cleaned = suggestions.map((s) => ({
            ...s,
            original: postClean(s.original),
            suggestion: postClean(s.suggestion),
        })).filter((s) => s.original && s.suggestion && s.original !== s.suggestion);
        return { suggestions: cleaned, source: 'edge-webllm' };
    } catch {
        return { suggestions: [], source: 'unavailable' };
    }
}

function extractJson(text: string): string | null {
    // Try to extract first JSON array in text
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start >= 0 && end > start) {
        try { JSON.parse(text.slice(start, end + 1)); return text.slice(start, end + 1); } catch { }
    }
    return null;
}

function postClean(input: string): string {
    let out = input || '';
    out = out.replace(/[\u200B-\u200D\uFEFF]/g, '');
    out = out.replace(/([\u1200-\u137F])[#;:\/\\|`~^*_=+]+([\u1200-\u137F])/g, '$1 $2');
    out = out.replace(/([\u1200-\u137F]+)[A-Za-z]+([\u1200-\u137F]+)/g, '$1$2');
    out = out.replace(/[!]{2,}/g, '!').replace(/[\?]{2,}/g, '?');
    out = enforceEthiopicPunctuationAndQuotes(out);
    out = out.replace(/ {2,}/g, ' ').trim();
    return out;
}
