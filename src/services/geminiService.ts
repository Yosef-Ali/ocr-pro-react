import { GoogleGenerativeAI } from '@google/generative-ai';
import { OCRFile, OCRResult, Settings, ProjectSummary } from '@/types';

export async function processWithGemini(
  files: OCRFile[],
  settings: Settings
): Promise<OCRResult[]> {
  const genAI = new GoogleGenerativeAI(settings.apiKey);
  const model = genAI.getGenerativeModel({ model: settings.model });

  const results: OCRResult[] = [];

  for (const file of files) {
    try {
      // Convert file to base64
      const base64 = await fileToBase64(file.file);

      const prompt = `
Analyze this document image and extract all text while preserving the original layout and formatting.

Provide exactly this JSON object and nothing else (no markdown, no code fences, no comments):
{
  "extractedText": "...",
  "layoutPreserved": "...",
  "detectedLanguage": "...",
  "confidence": 0.95,
  "documentType": "...",
  "layoutAnalysis": {
    "textBlocks": 0,
    "tables": 0,
    "images": 0,
    "columns": 0,
    "complexity": "low|medium|high",
    "structure": []
  },
  "metadata": {
    "wordCount": 0,
    "characterCount": 0
  }
}

Options:
- Preserve layout: ${settings.preserveLayout}
- Detect tables: ${settings.detectTables}
- Target language: ${settings.language}

Respond with ONLY the JSON object.`;

      const imagePart = {
        inlineData: {
          data: base64.split(',')[1],
          mimeType: file.type,
        },
      };

      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text();

      try {
        const jsonText = extractJsonFromText(text);
        const parsedResult = JSON.parse(jsonText);

        const ocrResult: OCRResult = {
          id: `result-${Date.now()}-${Math.random()}`,
          fileId: file.id,
          extractedText: parsedResult.extractedText,
          layoutPreserved: parsedResult.layoutPreserved,
          detectedLanguage: parsedResult.detectedLanguage,
          confidence: parsedResult.confidence,
          documentType: parsedResult.documentType,
          processingTime: 0,
          layoutAnalysis: parsedResult.layoutAnalysis,
          metadata: parsedResult.metadata,
        };

        results.push(ocrResult);
      } catch (parseErr) {
        console.warn(`JSON parse failed for ${file.name}. Using fallback.`, parseErr);
        const cleaned = stripFences(text);
        const fallback: OCRResult = {
          id: `result-${Date.now()}-${Math.random()}`,
          fileId: file.id,
          extractedText: cleaned,
          layoutPreserved: cleaned,
          detectedLanguage: 'unknown',
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
          },
        };
        results.push(fallback);
      }
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
      // Continue with other files; do not throw to avoid aborting whole batch
    }
  }

  return results;
}

export async function summarizeProject(
  results: OCRResult[],
  settings: Settings,
  options?: { proofreadPageNumbers?: boolean; projectId?: string }
): Promise<ProjectSummary> {
  const genAI = new GoogleGenerativeAI(settings.apiKey);
  const model = genAI.getGenerativeModel({ model: settings.model });

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

If pages contain standalone page numbers or headers/footers, remove them when generating the summary and chapters. Prefer concise, high-level summaries.

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
    const jsonText = extractJsonFromText(text);
    const parsed = JSON.parse(jsonText);
    const summary: ProjectSummary = {
      projectId: options?.projectId || 'unknown',
      generatedAt: Date.now(),
      toc: parsed.toc || [],
      summary: parsed.summary || '',
      chapters: parsed.chapters || [],
      proofreadingNotes: parsed.proofreadingNotes || [],
    };
    return summary;
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
}

function stripPageNumbers(input: string): string {
  const lines = input.split(/\r?\n/);
  const cleaned: string[] = [];
  for (const line of lines) {
    const l = line.trim();
    if (!l) { cleaned.push(line); continue; }
    // Common patterns: "12", "Page 12", "- 12 -", "12/345"
    if (/^(?:page\s*)?\d{1,4}(?:\s*\/\s*\d{1,4})?$/i.test(l)) continue;
    if (/^[-–—\s]*\d{1,4}[-–—\s]*$/.test(l)) continue;
    cleaned.push(line);
  }
  return cleaned.join('\n');
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}

function extractJsonFromText(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch && fenceMatch[1]) {
    return fenceMatch[1].trim();
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1).trim();
  }

  const cleaned = text.replace(/```/g, '').replace(/^json\s*/i, '').trim();
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    return cleaned;
  }

  throw new Error('Failed to extract JSON from model response');
}

function stripFences(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch && fenceMatch[1]) {
    return fenceMatch[1].trim();
  }
  return text.replace(/```/g, '').replace(/^json\s*/i, '').trim();
}
