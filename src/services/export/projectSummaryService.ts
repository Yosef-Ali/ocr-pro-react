/**
 * Project summarization service using Gemini API
 */
import { OCRResult, Settings, ProjectSummary } from '@/types';
import { extractJsonFromText, stripFences, stripPageNumbers } from '@/utils/textUtils';
import { validateSummaryPayload } from '@/utils/validationUtils';
import {
  DEFAULT_GEMINI_MODEL,
  getGeminiModel,
  resolvePreferredModel,
} from '@/services/ai/geminiClient';

export async function summarizeProject(
  results: OCRResult[],
  settings: Settings,
  options?: { proofreadPageNumbers?: boolean; projectId?: string }
): Promise<ProjectSummary> {
  const generationConfig = settings.lowTemperature
    ? { temperature: 0, topP: 0, topK: 1, maxOutputTokens: settings.maxTokens }
    : { maxOutputTokens: settings.maxTokens } as any;
  const preferredModel = resolvePreferredModel(settings.model, DEFAULT_GEMINI_MODEL);
  const model = getGeminiModel(settings.apiKey as string, { model: preferredModel, generationConfig });

  const proofread = options?.proofreadPageNumbers ?? true;

  const joinWithMarkers = (items: OCRResult[]) => {
    return items
      .map((r, idx) => {
        const text = proofread ? stripPageNumbers(r.extractedText) : r.extractedText;
        return `[[FILE ${idx + 1} START id=${r.fileId}]]\n${text}\n[[FILE ${idx + 1} END]]`;
      })
      .join('\n\n');
  };

  const combined = joinWithMarkers(results);

  const prompt = `You are helping create a book-level summary and Table of Contents from multiple OCR'd files. Analyze the combined content and produce a structured JSON only.

Important: Base the output strictly on provided content. Do not invent facts or content that is not present in the OCR text. If information is insufficient, note that briefly. Prefer concise, high-level summaries.

If pages contain standalone page numbers or headers/footers, remove them when generating the summary and chapters.

Respond with ONLY the following JSON, no code fences or markdown:
{
  "toc": [{ "title": "...", "level": 1, "page": 1 }],
  "summary": "...",
  "chapters": [{ "title": "...", "content": "..." }],
  "proofreadingNotes": ["..."]
}

Rules:
- Infer TOC (title and level) from headings. Include page numbers if possible; otherwise omit or set to null.
- Rearrange chapters to best logical order following TOC.
- Keep chapters concise, merging small sections when appropriate.
- If content is not a book, provide a reasonable document outline instead.
- Language: ${settings.language === 'auto' ? 'detect from content' : settings.language}.

Combined content begins:\n${combined}`;

  const result = await model.generateContent([prompt]);
  const response = await result.response;
  const text = response.text();

  try {
    let parsed: any | null = null;
    try {
      const jsonText = extractJsonFromText(text);
      parsed = JSON.parse(jsonText);
    } catch { }

    if (!parsed || !validateSummaryPayload(parsed)) {
      try {
        const retryPrompt = `Previous output was invalid. Output ONLY valid JSON with fields: toc (array of {title, level?, page?}), summary (string), chapters (array of {title, content}), proofreadingNotes (string[]). Do not include markdown.`;
        const retry = await model.generateContent([retryPrompt, combined]);
        const retryText = (await retry.response).text();
        const retryJson = extractJsonFromText(retryText);
        parsed = JSON.parse(retryJson);
      } catch { }
    }

    if (parsed && validateSummaryPayload(parsed)) {
      const summary: ProjectSummary = {
        projectId: options?.projectId || 'unknown',
        generatedAt: Date.now(),
        toc: Array.isArray(parsed.toc) ? parsed.toc : [],
        summary: parsed.summary || '',
        chapters: Array.isArray(parsed.chapters) ? parsed.chapters : [],
        proofreadingNotes: Array.isArray(parsed.proofreadingNotes) ? parsed.proofreadingNotes : [],
      };
      return summary;
    }
  } catch (e) {
    const cleaned = stripFences(text);
    return {
      projectId: options?.projectId || 'unknown',
      generatedAt: Date.now(),
      toc: [],
      summary: cleaned.slice(0, 5000),
      chapters: [],
      proofreadingNotes: ['Model returned non-JSON response; included raw text fallback.'],
    };
  }

  // Final fallback if parsing/validation still fails without throwing
  const cleaned = stripFences(text);
  return {
    projectId: options?.projectId || 'unknown',
    generatedAt: Date.now(),
    toc: [],
    summary: cleaned.slice(0, 5000),
    chapters: [],
    proofreadingNotes: ['Model returned invalid JSON after retry; included raw text fallback.'],
  };
}
