/**
 * Advanced word-level analysis service for OCR text
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Settings, ProofreadingSuggestion } from '@/types';
import { extractJsonFromText } from '@/utils/textUtils';
import { ensureNonTiffImage, toInlineImagePartFromDataUrl } from '@/utils/imageUtils';

export async function analyzeWordsWithConfidence(
  text: string,
  settings: Settings,
  opts?: { modelOverride?: string; imageBase64?: string }
): Promise<{
  wordAnalysis: Array<{
    word: string;
    position: { start: number; end: number };
    confidence: number;
    issues?: string[];
    suggestions?: string[];
  }>;
  suggestions: ProofreadingSuggestion[];
  source: 'gemini-1.5-pro' | 'gemini-1.5-flash' | 'gemini-2.5-pro' | 'local';
}> {
  if (!settings.apiKey) throw new Error('API key required for word analysis');
  const genAI = new GoogleGenerativeAI(settings.apiKey);
  // Use 1.5 Pro as default for word analysis if 2.5 Pro is selected (may not be available yet)
  let preferModel = opts?.modelOverride || settings.model || 'gemini-1.5-pro';
  if (preferModel === 'gemini-2.5-pro') {
    console.log('Note: Gemini 2.5 Pro may not be available for word analysis yet, will try and fallback if needed');
  }

  const generationConfig = {
    temperature: 0.1,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 4096,
    responseMimeType: 'application/json'
  } as any;

  const getModel = (m: string) => genAI.getGenerativeModel({ model: m, generationConfig } as any);

  // Enhanced prompt for aggressive OCR error detection
  const prompt = `You are an expert Amharic OCR analysis system with deep knowledge of Ethiopian religious texts, manuscripts, and liturgical language. Your job is to be VERY AGGRESSIVE at finding OCR errors.

CRITICAL: Focus on finding OBVIOUS OCR errors and garbled text. Be much more critical than usual.

Examples of texts that should be flagged as LOW CONFIDENCE:
- "457ፐ" (numbers mixed with Amharic) 
- "ዐ#ተ" (special chars in words)
- "M77" or "NC" (Latin abbreviations in Amharic context)
- "ጰ#ተ#ተ" (fragmented/corrupted text)
- Very short fragments like "ፐ" or "ተ" alone
- Text that looks like OCR corruption: "የመድኘነኃ..." vs proper "የመድኃኔዓለም"

IMPORTANT CLUES for Ethiopian religious texts:
- "የመድኃኔዓለም እናት" = Virgin Mary, Mother of the World
- "ጸሎት ቤት" = prayer house
- "ቫቲካን" = Vatican
- Religious terms should be spelled correctly

${opts?.imageBase64 ? 'CRITICAL: You have the original image. Use it to verify suspicious text against what you actually see in the image. If text looks garbled but the image shows clear text, flag it as OCR error.' : ''}

Your task: Analyze EVERY word and be AGGRESSIVE about finding errors:
1. VERY LOW CONFIDENCE (0.1-0.3) for obviously corrupted text
2. LOW CONFIDENCE (0.3-0.6) for suspicious fragments, mixed scripts
3. MEDIUM CONFIDENCE (0.6-0.8) for minor character confusion
4. HIGH CONFIDENCE (0.8-1.0) only for clearly correct words

Don't skip markdown syntax like ##, but focus on the actual content words.

Return ONLY valid JSON with this exact structure:
{
  "wordAnalysis": [
    {
      "word": "exact word as it appears",
      "position": {"start": 0, "end": 5},
      "confidence": 0.95,
      "issues": ["character confusion", "missing vowel mark"],
      "suggestions": ["corrected word 1", "corrected word 2"]
    }
  ],
  "suggestions": [
    {
      "original": "problematic phrase or word",
      "suggestion": "corrected version", 
      "reason": "explanation in Amharic",
      "confidence": 0.8
    }
  ]
}

Text to analyze:
${text}`;

  const runAnalysis = async (modelId: string) => {
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

      const jsonText = extractJsonFromText(responseText);
      const parsed = JSON.parse(jsonText);

      // Validate structure
      if (!parsed.wordAnalysis || !Array.isArray(parsed.wordAnalysis)) {
        throw new Error('Invalid response structure');
      }

      // Process and validate word analysis
      const processedAnalysis = parsed.wordAnalysis.map((item: any) => {
        return {
          word: item.word || '',
          position: item.position || { start: 0, end: 0 },
          confidence: typeof item.confidence === 'number' ? item.confidence : 0.5,
          issues: Array.isArray(item.issues) ? item.issues : [],
          suggestions: Array.isArray(item.suggestions) ? item.suggestions : []
        };
      });

      return {
        wordAnalysis: processedAnalysis,
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        source: modelId as any
      };
    } catch (err: any) {
      throw err;
    }
  };

  // Try primary model
  try {
    console.log(`Running word analysis with model: ${preferModel}`);
    const result = await runAnalysis(preferModel);
    console.log(`Success! Analyzed ${result.wordAnalysis.length} words with ${preferModel}`);
    return { ...result, source: (preferModel as any) };
  } catch (e) {
    console.error(`Word analysis failed with ${preferModel}:`, e);
    // If preferred is Pro, try Flash next
    if (/(1\.5-pro|2\.5-pro)/.test(preferModel)) {
      try {
        console.log('Rate limited, trying Flash model...');
        const result = await runAnalysis('gemini-1.5-flash');
        console.log(`Flash success! Analyzed ${result.wordAnalysis.length} words`);
        return { ...result, source: 'gemini-1.5-flash' };
      } catch (e2) {
        console.error('Flash model also failed:', e2);
        // Fall through to basic analysis
      }
    }
  }

  // Fallback to basic word analysis - only highlight problematic words
  const words = text.split(/\s+/);
  const basicAnalysis = words.map((word, idx) => {
    let position = 0;
    for (let i = 0; i < idx; i++) {
      position += words[i].length + 1; // +1 for space
    }
    const start = position;
    const end = position + word.length;

    const hasEthiopic = /[\u1200-\u137F]/.test(word);
    const hasLatin = /[a-zA-Z]/.test(word);
    const mixedScript = hasEthiopic && hasLatin;
    const hasSpecialChars = /[#;:\/\\|`~^*_=+]/.test(word);
    const hasNumbers = /\d/.test(word);
    const isAllNumbers = /^\d+$/.test(word);
    const isLatinAbbrev = /^[A-Z]{2,}$/.test(word); // Like "M77", "NC", "PIAL"
    const hasNumbersInAmharic = hasNumbers && hasEthiopic;

    // Skip markdown syntax - don't analyze markup
    if (/^#{1,6}$/.test(word) || /^[*_`]+$/.test(word)) {
      return null; // Skip markdown syntax
    }

    // Enhanced OCR error detection
    const issues = [];
    let confidence = 0.95; // Start with high confidence

    // Mixed scripts (Latin + Amharic) - very problematic
    if (mixedScript) {
      issues.push('mixed script (Latin + Amharic)');
      confidence = 0.1; // Very low confidence
    }

    // Special characters that shouldn't be in words
    if (hasSpecialChars) {
      issues.push('special characters detected');
      confidence = Math.min(confidence, 0.2);
    }

    // Numbers mixed with Amharic - OCR corruption
    if (hasNumbersInAmharic) {
      issues.push('numbers mixed with Amharic text');
      confidence = Math.min(confidence, 0.1);
    }

    // Latin abbreviations in Amharic context (M77, NC, PIAL)
    if (isLatinAbbrev && !isAllNumbers) {
      issues.push('Latin abbreviation in Amharic context');
      confidence = Math.min(confidence, 0.2);
    }

    // Suspicious patterns that look like OCR errors
    if (/[ፐፑፒፓፔፕፖ][0-9]/.test(word)) {
      issues.push('suspicious character-number sequence');
      confidence = Math.min(confidence, 0.1);
    }

    // Suspicious character sequences (common OCR errors)
    if (/[አ-ፚ][0-9]+[አ-ፚ]/.test(word)) {
      issues.push('numbers breaking Amharic words');
      confidence = Math.min(confidence, 0.3);
    }

    // Very short Amharic fragments (often OCR errors)
    if (hasEthiopic && word.length <= 2 && !/^[እ-ኧ]$/.test(word)) {
      issues.push('suspicious short Amharic fragment');
      confidence = Math.min(confidence, 0.6);
    }

    // Repeated characters (OCR artifacts)
    if (/(.)\\1{3,}/.test(word)) {
      issues.push('repeated characters detected');
      confidence = Math.min(confidence, 0.3);
    }

    // Only return analysis for problematic words
    if (issues.length === 0) {
      return null; // Skip this word - it's fine
    }

    return {
      word,
      position: { start, end },
      confidence,
      issues,
      suggestions: mixedScript ? [word.replace(/[a-zA-Z]+/g, '')] : []
    };
  }).filter((item): item is NonNullable<typeof item> => item !== null); // Remove null entries

  console.log(`Fallback analysis: Found ${basicAnalysis.length} problematic words out of ${words.length} total words`);

  return {
    wordAnalysis: basicAnalysis,
    suggestions: [],
    source: 'local'
  };
}