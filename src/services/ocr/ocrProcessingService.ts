/**
 * Core OCR processing service using Gemini and Tesseract
 */
import { OCRFile, OCRResult, Settings } from '@/types';
import { fileToBase64, toInlineImagePartFromDataUrl, ensureNonTiffImage } from '@/utils/imageUtils';
import { extractJsonFromText, stripFences, enforceEthiopicPunctuationAndQuotes, normalizeLangCode, clamp01, containsEthiopic, stripPageNumbers } from '@/utils/textUtils';
import { buildLexiconHint } from '@/utils/lexicon';
import { validateOCRPayload, checkAvailableApiKeys } from '@/utils/validationUtils';
import { analyzeAmharicOCRQuality, generateAmharicQualityReport } from '@/utils/amharicHelpers';
import { decideRoute } from '@/services/router/router';
import {
  DEFAULT_GEMINI_MODEL,
  decodeModelIdentifier,
  getGeminiModel,
  resolvePreferredModel,
} from '@/services/ai/geminiClient';

/**
 * Post-processes OCR results with Amharic-specific validation and analysis
 */
function enhanceOCRResultWithAmharicAnalysis(result: OCRResult, settings: Settings): OCRResult {
  const text = result.extractedText;

  // Only apply Amharic analysis if text contains Amharic or forceAmharic is enabled
  const hasAmharic = containsEthiopic(text);
  const shouldAnalyze = hasAmharic || settings.forceAmharic;

  if (!shouldAnalyze) {
    return result;
  }

  // Analyze Amharic text quality
  const qualityAnalysis = analyzeAmharicOCRQuality(text);

  // Generate quality report for metadata
  const qualityReport = generateAmharicQualityReport(text);

  // Adjust confidence based on Amharic analysis
  let adjustedConfidence = result.confidence;

  if (qualityAnalysis.overallQuality === 'poor') {
    adjustedConfidence = Math.min(adjustedConfidence, 0.4);
  } else if (qualityAnalysis.overallQuality === 'fair') {
    adjustedConfidence = Math.min(adjustedConfidence, 0.6);
  } else if (qualityAnalysis.overallQuality === 'good') {
    adjustedConfidence = Math.max(adjustedConfidence, 0.75);
  } else if (qualityAnalysis.overallQuality === 'excellent') {
    adjustedConfidence = Math.max(adjustedConfidence, 0.9);
  }

  // Apply corruption penalties
  if (qualityAnalysis.corruptionAnalysis.isCorrupted) {
    switch (qualityAnalysis.corruptionAnalysis.corruptionLevel) {
      case 'high':
        adjustedConfidence = Math.min(adjustedConfidence, 0.3);
        break;
      case 'medium':
        adjustedConfidence = Math.min(adjustedConfidence, 0.5);
        break;
      case 'low':
        adjustedConfidence = Math.min(adjustedConfidence, 0.7);
        break;
    }
  }

  // Enhance metadata with Amharic analysis
  const enhancedMetadata = {
    ...result.metadata,
    amharicAnalysis: {
      overallQuality: qualityAnalysis.overallQuality,
      confidence: qualityAnalysis.confidence,
      religiousContent: qualityAnalysis.religiousContentDetected,
      corruptionLevel: qualityAnalysis.corruptionAnalysis.corruptionLevel,
      isCorrupted: qualityAnalysis.corruptionAnalysis.isCorrupted,
      qualityScore: qualityReport.summary.overallScore,
      grade: qualityReport.summary.grade,
      amharicWordCount: qualityReport.summary.amharicWordCount,
      problematicWordCount: qualityReport.summary.problematicWordCount,
      recommendations: qualityReport.recommendations
    }
  };

  return {
    ...result,
    confidence: adjustedConfidence,
    metadata: enhancedMetadata
  };
}

export async function processWithGemini(
  files: OCRFile[],
  settings: Settings,
  opts?: {
    onProgress?: (info: {
      file: OCRFile;
      index: number;
      total: number;
      stage: 'preparing' | 'uploading' | 'analyzing' | 'parsing' | 'finalizing';
      progress: number;
      provider: 'gemini' | 'openrouter' | 'tesseract';
      message?: string;
    }) => void;
  }
): Promise<OCRResult[]> {
  console.log('API Key present:', !!settings.apiKey);
  console.log('OpenRouter Key present:', !!settings.openRouterApiKey);
  console.log('Model:', settings.model);
  console.log('Force Amharic:', !!settings.forceAmharic);

  // Check available API keys
  const apiStatus = checkAvailableApiKeys(settings);

  if (!apiStatus.hasAnyApiKey) {
    throw new Error('No valid API key found. Please add either a Gemini API key or OpenRouter API key in Settings.');
  }

  // Prefer Gemini if available, otherwise use OpenRouter
  const useGemini = apiStatus.hasGemini;
  console.log(`Using ${useGemini ? 'Gemini' : 'OpenRouter'} API for processing`);

  if (!useGemini && !apiStatus.hasOpenRouter) {
    throw new Error('OpenRouter API key is invalid. Please check your OpenRouter API key in Settings.');
  }

  const generationConfig = settings.lowTemperature
    ? { temperature: 0, topP: 0, topK: 1, maxOutputTokens: settings.maxTokens }
    : { maxOutputTokens: settings.maxTokens } as any;

  const systemInstruction = {
    text: `You are an OCR engine for Amharic (Ethiopic) documents.
Rules:
- Preserve script exactly as seen. Do NOT translate, transliterate, or romanize.
- Preserve Ethiopic punctuation: ፣ (comma), ፡ (word separator), ። (full stop).
- Preserve guillemets « … » exactly. Do NOT replace with ASCII quotes.
- Output ONLY JSON (no markdown fences) per schema; no extra fields.
- If unsure, keep characters as-is rather than substituting ASCII.
- Assume you run on Gemini 2.5 Pro vision by default—exploit that fidelity before downgrading to lighter models.
Examples:
  "ቫቲካን፡" stays as "ቫቲካን፡" (not "ቫቲካን:")
  «…» stays as «…» (not "…")
`
  } as any;

  const getModel = (m: string) => {
    if (!useGemini) return null; // Will use OpenRouter API calls instead
    return getGeminiModel(settings.apiKey as string, { model: m, generationConfig, systemInstruction });
  };

  const results: OCRResult[] = [];
  const totalFiles = files.length || 1;
  // OpenRouter model selection handled inline within runModel() for the OpenRouter branch.

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const emit = (
      stage: 'preparing' | 'uploading' | 'analyzing' | 'parsing' | 'finalizing',
      progress: number,
      provider: 'gemini' | 'openrouter' | 'tesseract' = useGemini ? 'gemini' : 'openrouter',
      message?: string,
    ) => {
      opts?.onProgress?.({
        file,
        index,
        total: totalFiles,
        stage,
        progress,
        provider,
        message,
      });
    };

    emit('preparing', 0.05);
    try {
      // Convert to base64; support persisted data URLs from preview when File is missing
      const base64 = await (async () => {
        const anyFile: File | undefined = (file as any).file;
        if (anyFile && typeof File !== 'undefined' && anyFile instanceof File) {
          return await fileToBase64(anyFile);
        }
        if (file.preview && file.preview.startsWith('data:')) return file.preview;
        throw new Error('No source data available (file or preview missing).');
      })();
      emit('uploading', 0.2);

      // If Ethiopic hinted, steer the main prompt harder toward preserving Ethiopic glyphs
      const forceAm = !!settings.forceAmharic;

      // Central router decision
      const route = decideRoute({ file, settings, previewBase64: base64 });
      const isTiff = /image\/(tiff|x-tiff)/i.test(file.type) || /\.(tif|tiff)$/i.test(file.name);
      const routingMode = settings.routingMode || 'auto';
      const preferLocal = routingMode === 'local-only' || route === 'local';
      const preferCloud = routingMode === 'cloud-only' || route === 'cloud';

      const shouldTryLocalFirst = preferLocal || forceAm || isTiff || (!apiStatus.hasAnyApiKey);

      const tryTesseract = async (): Promise<boolean> => {
        console.log('Routing → Tesseract');
        emit('analyzing', 0.35, 'tesseract');
        try {
          const tesseractResult = await runTesseract(file, base64, settings, forceAm);
          if (tesseractResult) {
            results.push(tesseractResult);
            emit('parsing', 0.8, 'tesseract');
            emit('finalizing', 1, 'tesseract');
            return true;
          }
        } catch (e) {
          console.error('Tesseract failed:', e);
        }
        return false;
      };

      const tryCloud = async (): Promise<boolean> => {
        console.log('Routing → Cloud AI');
        emit('analyzing', 0.45, useGemini ? 'gemini' : 'openrouter');
        try {
          const aiResult = await processWithAIAPI(file, base64, settings, getModel, forceAm, useGemini);
          if (aiResult) {
            results.push(aiResult);
            const engine = ((aiResult.metadata as any)?.engine || (useGemini ? 'gemini' : 'openrouter')) as 'gemini' | 'openrouter' | 'tesseract';
            emit('parsing', 0.85, engine);
            emit('finalizing', 1, engine);
            return true;
          }
        } catch (e) {
          console.error('Cloud AI failed:', e);
        }
        return false;
      };

      if (shouldTryLocalFirst) {
        const okLocal = await tryTesseract();
        if (okLocal) continue;
        if (routingMode === 'local-only') continue; // local-only: do not fall back
        const okCloud = await tryCloud();
        if (okCloud) continue;
      } else {
        // Prefer cloud first in 'cloud-only' or when Gemini key available and no force-local hint
        if (preferCloud) {
          const okCloud = await tryCloud();
          if (okCloud) continue;
        }
        // Auto with Gemini: try cloud, then local
        const okCloud = await tryCloud();
        if (okCloud) continue;
        const okLocal = await tryTesseract();
        if (okLocal) continue;
      }

      throw new Error('All processing routes failed for this file.');
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
      emit('finalizing', 1, useGemini ? 'gemini' : 'openrouter', 'Processing failed; recorded error.');
      // Continue with other files; do not throw to avoid aborting whole batch
    }
  }

  return results;
}

/**
 * Process provided files locally with Tesseract only (no LLM usage).
 * Preserves layout as plain text and enhances metadata with Amharic analysis.
 */
export async function processWithTesseractOnly(
  files: OCRFile[],
  settings: Settings,
  opts?: {
    onProgress?: (info: {
      file: OCRFile;
      index: number;
      total: number;
      stage: 'preparing' | 'analyzing' | 'finalizing';
      progress: number;
      provider: 'tesseract';
      message?: string;
    }) => void;
  }
): Promise<OCRResult[]> {
  const results: OCRResult[] = [];
  const total = files.length || 1;
  const forceAm = !!settings.forceAmharic;
  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const emit = (
      stage: 'preparing' | 'analyzing' | 'finalizing',
      progress: number,
      message?: string,
    ) => {
      opts?.onProgress?.({ file, index, total, stage, progress, provider: 'tesseract', message });
    };
    emit('preparing', 0.05);
    try {
      // Use persisted preview when File object is unavailable (e.g., after reload)
      const base64 = await (async () => {
        const anyFile: File | undefined = (file as any).file;
        if (anyFile && typeof File !== 'undefined' && anyFile instanceof File) {
          return await fileToBase64(anyFile);
        }
        if (file.preview && file.preview.startsWith('data:')) return file.preview;
        throw new Error('No source data available (file or preview missing).');
      })();
      emit('analyzing', 0.35);
      const tessResult = await runTesseract(file, base64, settings, forceAm);
      if (tessResult) {
        results.push(tessResult);
        emit('finalizing', 1);
      }
    } catch (e) {
      console.error('Tesseract-only processing failed:', e);
      emit('finalizing', 1, 'Processing failed; recorded error.');
    }
  }
  return results;
}

async function runTesseract(file: OCRFile, base64: string, settings: Settings, forceAm: boolean): Promise<OCRResult | null> {
  const tess = await import('tesseract.js');
  const { createWorker } = tess as any;
  const PSM = (tess as any).PSM || { SINGLE_COLUMN: 4 };
  const lang = (forceAm || settings.strictAmharic) ? 'amh' : 'amh+eng';
  const worker: any = await createWorker({
    langPath: 'https://tessdata.projectnaptha.com/4.0.0',
  });
  await worker.loadLanguage(lang);
  await worker.initialize(lang);
  await worker.setParameters({
    tessedit_pageseg_mode: String(PSM.SINGLE_COLUMN),
    preserve_interword_spaces: '1',
    user_defined_dpi: '300',
    ...((settings.strictAmharic || forceAm) ? { tessedit_char_blacklist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' } : {}),
  });
  const imgBlob = await (await fetch(base64)).blob();
  const { data } = await worker.recognize(imgBlob);
  await worker.terminate();
  console.log('Tesseract result received (length:', data?.text?.length || 0 + ')');

  if (data && typeof data.text === 'string' && data.text.trim()) {
    console.log('Using Tesseract as primary OCR');
    const rawText = data.text as string;
    const text = settings.stripPageNumbers ? stripPageNumbers(rawText) : rawText;
    const baseResult: OCRResult = {
      id: `result-${Date.now()}-${Math.random()}`,
      fileId: file.id,
      extractedText: text,
      layoutPreserved: text,
      detectedLanguage: forceAm ? 'am' : (/[\u1200-\u137F]/.test(text) ? 'am' : 'en'),
      confidence: 0.8, // Higher confidence for Tesseract
      documentType: 'Unknown',
      processingTime: 0,
      layoutAnalysis: {
        textBlocks: 1,
        tables: 0,
        images: 0,
        columns: 1,
        complexity: 'medium',
        structure: [],
      },
      metadata: {
        wordCount: text.split(/\s+/).filter(Boolean).length,
        characterCount: text.length,
        pageCount: 1,
        engine: 'tesseract',
      },
    };

    // Apply Amharic analysis enhancement
    return enhanceOCRResultWithAmharicAnalysis(baseResult, settings);
  }
  return null;
}

async function processWithAIAPI(
  file: OCRFile,
  base64: string,
  settings: Settings,
  getModel: (m: string) => any,
  forceAm: boolean,
  useGemini: boolean
): Promise<OCRResult | null> {
  const primaryGeminiModel = resolvePreferredModel(settings.model, DEFAULT_GEMINI_MODEL);
  const fallbackCandidate = resolvePreferredModel(settings.fallbackModel, 'gemini-1.5-flash');
  const fallbackGeminiModel = fallbackCandidate === primaryGeminiModel ? 'gemini-1.5-flash' : fallbackCandidate;
  // Build main prompt
  const prompt = forceAm
    ? `Extract text from this image. The content is in Amharic (Ethiopic script). Provide only the extracted text in Amharic, without any English or other languages. If no text is found, return empty string. Output as JSON: {"extractedText": "...", "layoutPreserved": "...", "detectedLanguage": "am", "documentType": "Unknown", "confidence": 0.5}`
    : `Extract text from this image. Detect the language and document type. Output as JSON: {"extractedText": "...", "layoutPreserved": "...", "detectedLanguage": "...", "documentType": "...", "confidence": 0.0-1.0}. If the text is in Amharic, ensure the extractedText is in Amharic script. Do not hallucinate or add extra content.`;
  const promptWithHints = forceAm
    ? prompt + `\nInstructions: Keep all characters in Ethiopic as seen. Do NOT transliterate or translate. Do NOT output Latin letters except JSON keys.`
    : prompt;
  const promptFinal = settings.enableLexiconHints ? `${promptWithHints}\n${buildLexiconHint()}` : promptWithHints;
  let preparedImagePart: any | null = null;
  const getImagePart = async () => {
    if (preparedImagePart) return preparedImagePart;
    let preparedForGemini = base64;
    if (/image\/(tiff|x-tiff)/i.test(file.type)) {
      preparedForGemini = await ensureNonTiffImage(base64);
    }
    preparedImagePart = toInlineImagePartFromDataUrl(preparedForGemini);
    return preparedImagePart;
  };

  const runModel = async (modelId: string) => {
    if (useGemini) {
      // Use Gemini API
      const part = await getImagePart();
      const model = getModel(modelId);
      if (!model) throw new Error('Failed to initialize Gemini model');
      const res = await model.generateContent([promptFinal, part]);
      return (await res.response).text();
    } else {
      // Use OpenRouter API
      const prepared = await ensureNonTiffImage(base64);

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'OCR Pro - Amharic OCR Processing'
        },
        body: JSON.stringify({
          model: (function () {
            const raw = settings.openRouterModel || 'google/gemini-2.0-flash-thinking-exp';
            const dec = decodeModelIdentifier(raw) || raw;
            return /.+\/.+/.test(dec) ? dec : 'google/gemini-1.5-flash';
          })(), // validated
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: promptFinal },
                {
                  type: 'image_url',
                  image_url: {
                    url: prepared,
                    detail: 'high'
                  }
                }
              ]
            }
          ],
          temperature: settings.lowTemperature ? 0 : 0.7,
          max_tokens: settings.maxTokens || 2048
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('No response content from OpenRouter API');
      }

      return content;
    }
  };

  // Ensure we can build the image part for Gemini; if this fails (e.g., unsupported TIFF), return a graceful fallback
  if (useGemini) {
    try {
      await getImagePart();
    } catch (prepErr: any) {
      const msg = String(prepErr?.message || prepErr || '');
      if (/Unsupported TIFF/i.test(msg)) {
        const cleaned = '';
        return {
          id: `result-${Date.now()}-${Math.random()}`,
          fileId: file.id,
          extractedText: cleaned,
          layoutPreserved: cleaned,
          detectedLanguage: forceAm ? 'am' : 'unknown',
          confidence: 0.3,
          documentType: 'Unknown',
          processingTime: 0,
          layoutAnalysis: { textBlocks: 0, tables: 0, images: 0, columns: 1, complexity: 'medium', structure: [] },
          metadata: { wordCount: 0, characterCount: 0, pageCount: 1, engine: useGemini ? 'gemini' : 'openrouter', note: 'TIFF could not be converted for AI processing; try re-exporting as PNG/JPEG.' } as any,
        };
      }
      throw prepErr;
    }
  }

  let text = '';
  let lastError: unknown = null;
  try {
    text = await runModel(primaryGeminiModel);
  } catch (e) {
    lastError = e;
    const fallbackOrder = [fallbackGeminiModel, 'gemini-1.5-flash'].filter((model, index, arr) => {
      return model && model !== primaryGeminiModel && arr.indexOf(model) === index;
    });

    for (const alt of fallbackOrder) {
      try {
        console.warn(`Primary model ${primaryGeminiModel} failed (${String((e as Error)?.message || e)}). Retrying with ${alt}...`);
        text = await runModel(alt);
        lastError = null;
        break;
      } catch (altErr) {
        lastError = altErr;
        console.error(`Fallback model ${alt} failed:`, altErr);
      }
    }

    if (!text) {
      throw lastError || e;
    }
  }
  console.log('Gemini API response received (length:', text.length + ')');

  if (!text || text.trim() === '') {
    throw new Error('Empty response from Gemini API');
  }

  return await parseGeminiResponse(text, file, settings, getModel, getImagePart, forceAm, useGemini);
}

async function parseGeminiResponse(
  text: string,
  file: OCRFile,
  settings: Settings,
  getModel: (m: string) => any,
  getImagePart: () => Promise<any>,
  forceAm: boolean,
  useGemini: boolean
): Promise<OCRResult> {
  let parsedResult: any | null = null;
  try {
    const jsonText = extractJsonFromText(text);
    parsedResult = JSON.parse(jsonText);
  } catch { }

  // Validate; if invalid, retry once with stricter instructions
  if (!parsedResult || !validateOCRPayload(parsedResult)) {
    console.log('Initial parsing failed, retrying...');
    parsedResult = await retryWithStricterInstructions(settings, getModel, getImagePart);
  }

  // If Ethiopic was detected in sample but output lacks Ethiopic glyphs, force a strict retry once
  if (parsedResult && forceAm && typeof parsedResult.extractedText === 'string' && (!containsEthiopic(parsedResult.extractedText) || looksLikeInvoice(parsedResult.extractedText))) {
    console.log('Ethiopic expected but not found, doing strict retry...');
    parsedResult = await retryWithEthiopicFocus(settings, getModel, getImagePart) || parsedResult;
  }

  // Post-process to enforce Ethiopic punctuation/quotes when forced
  const postProcessEthiopic = (s: string) => enforceEthiopicPunctuationAndQuotes(s);

  if (parsedResult && validateOCRPayload(parsedResult)) {
    const safeLayout = parsedResult.layoutAnalysis && typeof parsedResult.layoutAnalysis === 'object'
      ? parsedResult.layoutAnalysis
      : { textBlocks: 0, tables: 0, images: 0, columns: 1, complexity: 'medium', structure: [] };

    let extracted = parsedResult.extractedText || '';
    let layoutText = parsedResult.layoutPreserved || extracted;
    if (settings.stripPageNumbers) {
      extracted = stripPageNumbers(extracted);
      layoutText = stripPageNumbers(layoutText);
    }
    if (forceAm) {
      extracted = postProcessEthiopic(extracted);
      layoutText = postProcessEthiopic(layoutText);
    }
    const safeMetadata = {
      wordCount: parsedResult.metadata?.wordCount ?? (extracted.trim() ? extracted.trim().split(/\s+/).length : 0),
      characterCount: parsedResult.metadata?.characterCount ?? extracted.length,
      pageCount: parsedResult.metadata?.pageCount ?? undefined,
    } as any;
    (safeMetadata as any).engine = useGemini ? 'gemini' : 'openrouter';

    const baseResult: OCRResult = {
      id: `result-${Date.now()}-${Math.random()}`,
      fileId: file.id,
      extractedText: extracted,
      layoutPreserved: layoutText,
      detectedLanguage: forceAm ? 'am' : normalizeLangCode(parsedResult.detectedLanguage),
      confidence: clamp01(parsedResult.confidence),
      documentType: parsedResult.documentType || 'Unknown',
      processingTime: 0,
      layoutAnalysis: safeLayout,
      metadata: safeMetadata,
    };

    // Apply Amharic analysis enhancement
    return enhanceOCRResultWithAmharicAnalysis(baseResult, settings);
  } else {
    let cleaned = stripFences(text);
    if (forceAm) cleaned = postProcessEthiopic(cleaned);
    const fallbackResult: OCRResult = {
      id: `result-${Date.now()}-${Math.random()}`,
      fileId: file.id,
      extractedText: cleaned,
      layoutPreserved: cleaned,
      detectedLanguage: forceAm && containsEthiopic(cleaned) ? 'am' : 'unknown',
      confidence: 0.5,
      documentType: 'Unknown',
      processingTime: 0,
      layoutAnalysis: {
        textBlocks: 0,
        tables: 0,
        images: 0,
        columns: 1,
        complexity: 'medium',
        structure: [],
      },
      metadata: {
        wordCount: cleaned.split(/\s+/).filter(Boolean).length,
        characterCount: cleaned.length,
        pageCount: 1,
        engine: useGemini ? 'gemini' : 'openrouter',
      },
    };

    // Apply Amharic analysis enhancement
    return enhanceOCRResultWithAmharicAnalysis(fallbackResult, settings);
  }
}

async function retryWithStricterInstructions(
  settings: Settings,
  getModel: (m: string) => any,
  getImagePart: () => Promise<any>
): Promise<any | null> {
  const preferredModel = resolvePreferredModel(settings.model, DEFAULT_GEMINI_MODEL);
  const fallbackCandidate = resolvePreferredModel(settings.fallbackModel, 'gemini-1.5-flash');
  const fallbackOrder = [fallbackCandidate, 'gemini-1.5-flash'].filter((model, index, arr) => {
    return model && model !== preferredModel && arr.indexOf(model) === index;
  });
  try {
    const retryPrompt = `Previous output was not valid per schema. Output ONLY valid JSON matching the schema exactly. Do not include markdown.
Schema fields: extractedText (string), layoutPreserved (string), detectedLanguage (ISO 639-1 string or "unknown"), confidence (0..1), documentType (string), layoutAnalysis { textBlocks:number, tables:number, images:number, columns:number, complexity:"low"|"medium"|"high", structure:[] }, metadata { wordCount:number, characterCount:number }`;
    let retryText = '';
    try {
      const part = await getImagePart();
      const retryRes = await getModel(preferredModel).generateContent([retryPrompt, part]);
      retryText = (await retryRes.response).text();
    } catch (e) {
      let lastError: unknown = e;
      for (const alt of fallbackOrder) {
        try {
          const part2 = await getImagePart();
          const retryRes2 = await getModel(alt).generateContent([retryPrompt, part2]);
          retryText = (await retryRes2.response).text();
          lastError = null;
          break;
        } catch (altErr) {
          lastError = altErr;
          console.error(`Fallback model ${alt} failed during strict retry:`, altErr);
        }
      }
      if (lastError) throw lastError;
    }
    console.log('Retry response received (length:', retryText.length + ')');
    if (!retryText || retryText.trim() === '') {
      console.warn('Retry returned empty response');
      return null;
    } else {
      const retryJson = extractJsonFromText(retryText);
      return JSON.parse(retryJson);
    }
  } catch (e) {
    console.error('Retry failed:', e);
    return null;
  }
}

async function retryWithEthiopicFocus(
  settings: Settings,
  getModel: (m: string) => any,
  getImagePart: () => Promise<any>
): Promise<any | null> {
  const preferredModel = resolvePreferredModel(settings.model, DEFAULT_GEMINI_MODEL);
  const fallbackCandidate = resolvePreferredModel(settings.fallbackModel, 'gemini-1.5-flash');
  const fallbackOrder = [fallbackCandidate, 'gemini-1.5-flash'].filter((model, index, arr) => {
    return model && model !== preferredModel && arr.indexOf(model) === index;
  });
  try {
    const strictPrompt = `Ethiopic glyphs were detected or Amharic was forced. Your previous output lacked Ethiopic characters and/or resembled an English invoice template. Re-output ONLY JSON per schema. Ensure 'extractedText' and 'layoutPreserved' contain the exact Ethiopic characters as seen, without transliteration/translation. Do NOT fabricate fields (e.g., invoices). If text is unreadable, return empty strings and lower confidence. Set detectedLanguage to \"am\" unless clearly unknown.`;
    let strictText = '';
    try {
      const part = await getImagePart();
      const strictRes = await getModel(preferredModel).generateContent([strictPrompt, part]);
      strictText = (await strictRes.response).text();
    } catch (e) {
      let lastError: unknown = e;
      for (const alt of fallbackOrder) {
        try {
          const part2 = await getImagePart();
          const strictRes2 = await getModel(alt).generateContent([strictPrompt, part2]);
          strictText = (await strictRes2.response).text();
          lastError = null;
          break;
        } catch (altErr) {
          lastError = altErr;
          console.error(`Fallback model ${alt} failed during Ethiopic retry:`, altErr);
        }
      }
      if (lastError) throw lastError;
    }
    console.log('Strict retry response received (length:', strictText.length + ')');
    if (!strictText || strictText.trim() === '') {
      console.warn('Strict retry returned empty response');
      return null;
    } else {
      const strictJson = extractJsonFromText(strictText);
      const strictParsed = JSON.parse(strictJson);
      if (validateOCRPayload(strictParsed)) return strictParsed;
    }
  } catch (e) {
    console.error('Strict retry failed:', e);
  }
  return null;
}

// Heuristic: typical English invoice template detection
function looksLikeInvoice(t: string): boolean {
  return /\bINVOICE\b/i.test(t) && /\bSubtotal\b|\bTax\b|\bTotal\b/i.test(t) && /\bQty\b|\bRate\b|\bAmount\b/i.test(t);
}
