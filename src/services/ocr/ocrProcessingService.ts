/**
 * Core OCR processing service using Gemini and Tesseract
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { OCRFile, OCRResult, Settings } from '@/types';
import { fileToBase64, toInlineImagePartFromDataUrl, ensureNonTiffImage } from '@/utils/imageUtils';
import { extractJsonFromText, stripFences, enforceEthiopicPunctuationAndQuotes, normalizeLangCode, clamp01, containsEthiopic } from '@/utils/textUtils';
import { validateOCRPayload } from '@/utils/validationUtils';

export async function processWithGemini(
  files: OCRFile[],
  settings: Settings
): Promise<OCRResult[]> {
  console.log('API Key present:', !!settings.apiKey);
  console.log('Model:', settings.model);
  console.log('Force Amharic:', !!settings.forceAmharic);

  // Validate API key presence
  if (!settings.apiKey || !settings.apiKey.trim()) {
    console.error('API key is missing or empty');
    throw new Error('Please set your Gemini API key in Settings. Get one from https://makersuite.google.com/app/apikey');
  }

  const genAI = new GoogleGenerativeAI(settings.apiKey as string);
  const generationConfig = settings.lowTemperature
    ? { temperature: 0, topP: 0, topK: 1, maxOutputTokens: settings.maxTokens, responseMimeType: 'application/json' }
    : { maxOutputTokens: settings.maxTokens, responseMimeType: 'application/json' } as any;
  const systemInstruction = {
    text: `You are an OCR engine for Amharic (Ethiopic) documents.
Rules:
- Preserve script exactly as seen. Do NOT translate, transliterate, or romanize.
- Preserve Ethiopic punctuation: ፣ (comma), ፡ (word separator), ። (full stop).
- Preserve guillemets « … » exactly. Do NOT replace with ASCII quotes.
- Output ONLY JSON (no markdown fences) per schema; no extra fields.
- If unsure, keep characters as-is rather than substituting ASCII.
Examples:
  "ቫቲካን፡" stays as "ቫቲካን፡" (not "ቫቲካን:")
  «…» stays as «…» (not "…")
`
  } as any;
  const getModel = (m: string) => genAI.getGenerativeModel({ model: m, generationConfig, systemInstruction } as any);

  const results: OCRResult[] = [];

  for (const file of files) {
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

      // If Ethiopic hinted, steer the main prompt harder toward preserving Ethiopic glyphs
      const forceAm = !!settings.forceAmharic;

      // If forceAmharic is on OR file is TIFF, try Tesseract FIRST before Gemini
      const isTiff = /image\/(tiff|x-tiff)/i.test(file.type) || /\.(tif|tiff)$/i.test(file.name);
      if (forceAm || isTiff) {
        console.log('Running Tesseract FIRST (forceAmharic or TIFF)');
        try {
          const tesseractResult = await runTesseract(file, base64, settings, forceAm);
          if (tesseractResult) {
            results.push(tesseractResult);
            continue; // Skip Gemini processing entirely
          } else {
            console.log('Tesseract produced no text, falling back to Gemini');
          }
        } catch (e) {
          console.error('Tesseract failed:', e);
          console.log('Falling back to Gemini');
        }
      }

      // Process with Gemini
      const geminiResult = await processWithGeminiAPI(file, base64, settings, getModel, forceAm);
      if (geminiResult) {
        results.push(geminiResult);
      }
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
      // Continue with other files; do not throw to avoid aborting whole batch
    }
  }

  return results;
}

async function runTesseract(file: OCRFile, base64: string, settings: Settings, forceAm: boolean): Promise<OCRResult | null> {
  const tess = await import('tesseract.js');
  const { createWorker } = tess as any;
  const PSM = (tess as any).PSM || { SINGLE_COLUMN: 4 };
  const worker: any = await createWorker();
  const lang = (forceAm || settings.strictAmharic) ? 'amh' : 'amh+eng';
  await worker.load();
  await worker.loadLanguage(lang);
  await worker.initialize(lang);
  await worker.setParameters({
    tessedit_pageseg_mode: String(PSM.SINGLE_COLUMN),
    tessedit_ocr_engine_mode: '1',
    preserve_interword_spaces: '1',
    user_defined_dpi: '300',
    ...((settings.strictAmharic || forceAm) ? { tessedit_char_blacklist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' } : {}),
  });
  const imgBlob = await (await fetch(base64)).blob();
  const { data } = await worker.recognize(imgBlob);
  await worker.terminate();
  console.log('Tesseract result:', data?.text);
  
  if (data && typeof data.text === 'string' && data.text.trim()) {
    console.log('Using Tesseract as primary OCR');
    return {
      id: `result-${Date.now()}-${Math.random()}`,
      fileId: file.id,
      extractedText: data.text,
      layoutPreserved: data.text,
      detectedLanguage: forceAm ? 'am' : (/[\u1200-\u137F]/.test(data.text) ? 'am' : 'en'),
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
        wordCount: data.text.split(/\s+/).filter(Boolean).length,
        characterCount: data.text.length,
        pageCount: 1,
        engine: 'tesseract',
      },
    };
  }
  return null;
}

async function processWithGeminiAPI(
  file: OCRFile, 
  base64: string, 
  settings: Settings, 
  getModel: (m: string) => any, 
  forceAm: boolean
): Promise<OCRResult | null> {
  // Build main prompt
  const prompt = forceAm
    ? `Extract text from this image. The content is in Amharic (Ethiopic script). Provide only the extracted text in Amharic, without any English or other languages. If no text is found, return empty string. Output as JSON: {"extractedText": "...", "layoutPreserved": "...", "detectedLanguage": "am", "documentType": "Unknown", "confidence": 0.5}`
    : `Extract text from this image. Detect the language and document type. Output as JSON: {"extractedText": "...", "layoutPreserved": "...", "detectedLanguage": "...", "documentType": "...", "confidence": 0.0-1.0}. If the text is in Amharic, ensure the extractedText is in Amharic script. Do not hallucinate or add extra content.`;
  const promptWithHints = forceAm
    ? prompt + `\nInstructions: Keep all characters in Ethiopic as seen. Do NOT transliterate or translate. Do NOT output Latin letters except JSON keys.`
    : prompt;
  const isRateLimit = (e: any) => String(e?.message || e || '').toLowerCase().includes('429');

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
    const part = await getImagePart();
    const res = await getModel(modelId).generateContent([promptWithHints, part]);
    return (await res.response).text();
  };

  // Ensure we can build the image part for Gemini; if this fails (e.g., unsupported TIFF), return a graceful fallback
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
        metadata: { wordCount: 0, characterCount: 0, pageCount: 1, engine: 'tesseract', note: 'TIFF could not be converted for Gemini; try re-exporting as PNG/JPEG.' } as any,
      };
    }
    throw prepErr;
  }

  let text = '';
  try {
    text = await runModel(settings.model);
  } catch (e) {
    if (isRateLimit(e) && /(1\.5-pro|2\.5-pro)/.test(settings.model)) {
      console.warn('Rate-limited on Pro, retrying with Flash');
      try {
        text = await runModel('gemini-1.5-flash');
      } catch (e2) {
        throw e2;
      }
    } else {
      throw e;
    }
  }
  console.log('Gemini API response:', text);

  if (!text || text.trim() === '') {
    throw new Error('Empty response from Gemini API');
  }

  return await parseGeminiResponse(text, file, settings, getModel, getImagePart, forceAm);
}

async function parseGeminiResponse(
  text: string, 
  file: OCRFile, 
  settings: Settings, 
  getModel: (m: string) => any, 
  getImagePart: () => Promise<any>, 
  forceAm: boolean
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
    if (forceAm) {
      extracted = postProcessEthiopic(extracted);
      layoutText = postProcessEthiopic(layoutText);
    }
    const safeMetadata = {
      wordCount: parsedResult.metadata?.wordCount ?? (extracted.trim() ? extracted.trim().split(/\s+/).length : 0),
      characterCount: parsedResult.metadata?.characterCount ?? extracted.length,
      pageCount: parsedResult.metadata?.pageCount ?? undefined,
    } as any;
    (safeMetadata as any).engine = 'gemini';

    return {
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
  } else {
    let cleaned = stripFences(text);
    if (forceAm) cleaned = postProcessEthiopic(cleaned);
    return {
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
        engine: 'gemini',
      },
    };
  }
}

async function retryWithStricterInstructions(
  settings: Settings, 
  getModel: (m: string) => any, 
  getImagePart: () => Promise<any>
): Promise<any | null> {
  try {
    const retryPrompt = `Previous output was not valid per schema. Output ONLY valid JSON matching the schema exactly. Do not include markdown.
Schema fields: extractedText (string), layoutPreserved (string), detectedLanguage (ISO 639-1 string or "unknown"), confidence (0..1), documentType (string), layoutAnalysis { textBlocks:number, tables:number, images:number, columns:number, complexity:"low"|"medium"|"high", structure:[] }, metadata { wordCount:number, characterCount:number }`;
    let retryText = '';
    try {
      const part = await getImagePart();
      const retryRes = await getModel(settings.model).generateContent([retryPrompt, part]);
      retryText = (await retryRes.response).text();
    } catch (e) {
      const isRateLimit = (e: any) => String(e?.message || e || '').toLowerCase().includes('429');
      if (isRateLimit(e) && /(1\.5-pro|2\.5-pro)/.test(settings.model)) {
        const part2 = await getImagePart();
        const retryRes2 = await getModel('gemini-1.5-flash').generateContent([retryPrompt, part2]);
        retryText = (await retryRes2.response).text();
      } else {
        throw e;
      }
    }
    console.log('Retry response:', retryText);
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
  try {
    const strictPrompt = `Ethiopic glyphs were detected or Amharic was forced. Your previous output lacked Ethiopic characters and/or resembled an English invoice template. Re-output ONLY JSON per schema. Ensure 'extractedText' and 'layoutPreserved' contain the exact Ethiopic characters as seen, without transliteration/translation. Do NOT fabricate fields (e.g., invoices). If text is unreadable, return empty strings and lower confidence. Set detectedLanguage to \"am\" unless clearly unknown.`;
    let strictText = '';
    try {
      const part = await getImagePart();
      const strictRes = await getModel(settings.model).generateContent([strictPrompt, part]);
      strictText = (await strictRes.response).text();
    } catch (e) {
      const isRateLimit = (e: any) => String(e?.message || e || '').toLowerCase().includes('429');
      if (isRateLimit(e) && /(1\.5-pro|2\.5-pro)/.test(settings.model)) {
        const part2 = await getImagePart();
        const strictRes2 = await getModel('gemini-1.5-flash').generateContent([strictPrompt, part2]);
        strictText = (await strictRes2.response).text();
      } else {
        throw e;
      }
    }
    console.log('Strict retry response:', strictText);
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