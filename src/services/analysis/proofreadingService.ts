/**
 * Amharic text proofreading service using Gemini API
 */
import { Settings, ProofreadingSuggestion } from '@/types';
import { extractJsonFromText, containsEthiopic, enforceEthiopicPunctuationAndQuotes } from '@/utils/textUtils';
import { ensureNonTiffImage, toInlineImagePartFromDataUrl } from '@/utils/imageUtils';
import { proofreadAmharicWithMetaEdge } from '@/services/edge/edgeLLMService';
import { buildLexiconHint } from '@/utils/lexicon';
import {
  DEFAULT_GEMINI_MODEL,
  getGeminiModel,
  resolvePreferredModel,
} from '@/services/ai/geminiClient';

export async function proofreadAmharicWithMeta(
  text: string,
  settings: Settings,
  opts?: { modelOverride?: string; maxSuggestions?: number; imageBase64?: string }
): Promise<{ suggestions: ProofreadingSuggestion[]; source: 'gemini-1.5-pro' | 'gemini-1.5-flash' | 'gemini-2.5-pro' | 'local' }> {
  // Prefer Edge LLM when enabled and no image context is required
  if (settings.edgeLLMEnabled && !opts?.imageBase64) {
    const edge = await proofreadAmharicWithMetaEdge(text, settings, { maxSuggestions: opts?.maxSuggestions });
    if (edge.source !== 'unavailable' && edge.suggestions.length > 0) {
      const filtered = postFilterSuggestions(text, edge.suggestions, settings, opts?.maxSuggestions);
      if (filtered.length > 0) {
        // Coerce source type union by returning Gemini-compatible tag only in name
        return { suggestions: filtered, source: 'gemini-1.5-flash' } as any;
      }
    }
  }
  if (!settings.apiKey) throw new Error('API key required for proofreading');
  const preferModel = resolvePreferredModel(opts?.modelOverride || settings.model, DEFAULT_GEMINI_MODEL);
  const fallbackCandidate = resolvePreferredModel(settings.fallbackModel, 'gemini-1.5-flash');
  const fallbackOrder = [fallbackCandidate, 'gemini-1.5-flash'].filter((model, index, arr) => {
    return model && model !== preferModel && arr.indexOf(model) === index;
  });
  const generationConfig = {
    temperature: 0.1,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 4096,
  } as any;

  const getModel = (m: string) => getGeminiModel(settings.apiKey as string, { model: m, generationConfig });

  // Enhanced system prompt for semantic understanding
  const prompt = `You are an expert Amharic language proofreader with deep understanding of Ethiopian literature, culture, and context.

Your task: Analyze the OCR'd Amharic text and provide intelligent corrections based on:
1. SEMANTIC UNDERSTANDING - Understand the meaning and context of each sentence
2. LINGUISTIC PATTERNS - Apply Amharic grammar, spelling, and syntax rules
3. CONTEXTUAL COHERENCE - Ensure sentences flow logically and meaningfully
${opts?.imageBase64 ? '4. IMAGE REFERENCE - Cross-check the text against the provided original image' : ''}

CRITICAL RULES:
- Understand the MEANING of each line before suggesting corrections
- Fix OCR errors that break semantic meaning or grammatical structure
- Correct common Amharic OCR mistakes:
  * Similar-looking characters (ሀ/ኀ, ሰ/ሠ, ፀ/ጸ, አ/ዐ)
  * Missing or wrong vowel marks
  * Word boundary errors
  * Punctuation errors (። vs : or ፤ vs ;)
  * Mixed scripts (Latin letters appearing in Amharic words)
- Preserve proper names and technical terms
- Keep original meaning intact - never change the author's intent
${settings.enableLexiconHints ? buildLexiconHint() : ''}

COMMON AMHARIC OCR ERRORS TO WATCH FOR:
1. Character confusion:
   - ሀ often misread as ኀ or vice versa
   - ሰ confused with ሠ
   - ፀ confused with ጸ
   - አ confused with ዐ
   - ተ confused with ቶ

2. Vowel mark errors:
   - Missing or wrong vowel marks (ከ vs ኪ vs ኬ)
   - Extra vowel marks added

3. Word boundaries:
   - Words incorrectly merged: "የኢትዮጵያ" might appear as "የኢት ዮጵያ"
   - Words incorrectly split

4. Punctuation:
   - Amharic period ። confused with colon :
   - Amharic comma ፤ confused with semicolon ;

5. Mixed scripts:
   - Latin letters appearing randomly: "ሰላም" might appear as "ሰላm"

Output format:
Return ONLY a JSON array of correction suggestions. Each suggestion should be:
{
  "original": "the exact text to replace",
  "suggestion": "the corrected text",
  "reason": "explanation in Amharic about why this correction is needed",
  "confidence": 0.0-1.0 (how confident you are in this correction)
}

Focus on HIGH-VALUE corrections that fix actual errors, not stylistic preferences.
Limit to ${opts?.maxSuggestions || 20} most important corrections.

Text to proofread:
${text}`;

  const runOnce = async (modelId: string): Promise<ProofreadingSuggestion[] | null> => {
    try {
      const content: any[] = [prompt];
      if (opts?.imageBase64) {
        const prepared = await ensureNonTiffImage(opts.imageBase64);
        const imagePart = toInlineImagePartFromDataUrl(prepared);
        content.push(imagePart);
      }
      const result = await getModel(modelId).generateContent(content);
      const response = await result.response;
      const responseText = response.text();

      try {
        const jsonText = extractJsonFromText(responseText);
        const parsed = JSON.parse(jsonText);
        if (!Array.isArray(parsed)) return [];
        return parsed
          .filter((s: any) => s && typeof s.original === 'string' && typeof s.suggestion === 'string' && s.original !== s.suggestion && s.original.trim() && s.suggestion.trim())
          .map((s: any) => ({ original: s.original, suggestion: s.suggestion, reason: s.reason || 'የጽሁፍ ስህተት ማረሚያ', confidence: typeof s.confidence === 'number' ? s.confidence : 0.7 }))
          .sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0))
          .slice(0, opts?.maxSuggestions || 20);
      } catch {
        return [];
      }
    } catch (err: any) {
      // Bubble up to evaluate fallback
      throw err;
    }
  };

  // Primary attempt: preferred model
  try {
    const suggestions = await runOnce(preferModel);
    const filtered = postFilterSuggestions(text, suggestions || [], settings, opts?.maxSuggestions);
    return { suggestions: filtered, source: (preferModel as any) };
  } catch (e) {
    for (const alt of fallbackOrder) {
      try {
        const suggestions = await runOnce(alt);
        const filtered = postFilterSuggestions(text, suggestions || [], settings, opts?.maxSuggestions);
        return { suggestions: filtered, source: alt as any };
      } catch (altErr) {
        console.error(`Proofreading fallback model ${alt} failed:`, altErr);
      }
    }
  }

  // Fallback to simpler local corrections if API fails or rate limited
  const localSuggestions: ProofreadingSuggestion[] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const asciiNoiseMatches = line.matchAll(/([\u1200-\u137F])[#;:\/\\|`~^*_=+]+([\u1200-\u137F])/g);
    for (const match of asciiNoiseMatches) {
      if (match[0]) localSuggestions.push({ original: match[0], suggestion: match[1] + ' ' + match[2], reason: 'የ ASCII ጫጫታ ማስወገጃ', confidence: 0.9 });
    }
    const latinInAmharic = line.matchAll(/([\u1200-\u137F]+)[a-zA-Z]+([\u1200-\u137F]+)/g);
    for (const match of latinInAmharic) {
      if (match[0]) localSuggestions.push({ original: match[0], suggestion: match[1] + match[2], reason: 'የላቲን ፊደላት በአማርኛ ቃል ውስጥ', confidence: 0.8 });
    }
  }
  const filteredLocal = postFilterSuggestions(text, localSuggestions, settings, opts?.maxSuggestions);
  return { suggestions: filteredLocal, source: 'local' };
}

// Backward-compatible wrapper
export async function proofreadAmharic(
  text: string,
  settings: Settings,
  opts?: { modelOverride?: string; maxSuggestions?: number; imageBase64?: string }
): Promise<ProofreadingSuggestion[]> {
  const { suggestions } = await proofreadAmharicWithMeta(text, settings, opts);
  return suggestions;
}

function postFilterSuggestions(
  sourceText: string,
  suggestions: ProofreadingSuggestion[],
  settings: Settings,
  max?: number
): ProofreadingSuggestion[] {
  const isEth = settings.forceAmharic || containsEthiopic(sourceText);
  const clean = (s: string): string => {
    let out = s || '';
    // Remove zero-width / BOM
    out = out.replace(/[\u200B-\u200D\uFEFF]/g, '');
    // ASCII noise between Ethiopic chars -> replace with single space
    out = out.replace(/([\u1200-\u137F])[#;:\/\\|`~^*_=+]+([\u1200-\u137F])/g, '$1 $2');
    // Latin letters embedded within Ethiopic words -> drop Latin
    out = out.replace(/([\u1200-\u137F]+)[A-Za-z]+([\u1200-\u137F]+)/g, '$1$2');
    // Normalize excessive ASCII punctuation
    out = out.replace(/[!]{2,}/g, '!').replace(/[\?]{2,}/g, '?');
    // Enforce Ethiopic punctuation/quotes
    out = enforceEthiopicPunctuationAndQuotes(out);
    // Collapse spaces
    out = out.replace(/ {2,}/g, ' ').trim();
    return out;
  };
  const dropLatinIfEth = (s: string): boolean => {
    if (!isEth) return false;
    return /[A-Za-z]/.test(s) && !/[\u1200-\u137F\u1380-\u139F\u2D80-\u2DDF]/.test(s);
  };

  const filtered = suggestions
    .map((s) => ({
      original: clean(s.original),
      suggestion: clean(s.suggestion),
      reason: s.reason,
      confidence: s.confidence,
    }))
    .filter((s) => s.original && s.suggestion && s.original !== s.suggestion)
    .filter((s) => !dropLatinIfEth(s.suggestion))
    .slice(0, max || 20);

  return filtered;
}
