/**
 * Validation utilities for OCR results and API responses
 */

/**
 * Validates if an object conforms to the basic structure of an OCRResult.
 */
export function validateOCRPayload(obj: any): boolean {
  if (!obj || typeof obj !== 'object') return false;
  if (typeof obj.extractedText !== 'string') return false;
  if (typeof obj.layoutPreserved !== 'string' && typeof obj.extractedText !== 'string') return false;
  if (typeof obj.detectedLanguage !== 'string') return false;
  if (typeof obj.confidence !== 'number' && typeof obj.confidence !== 'string') return false;
  if (typeof obj.documentType !== 'string' && obj.documentType != null) return false;
  const la = obj.layoutAnalysis;
  if (!la || typeof la !== 'object') return false;
  if (typeof la.textBlocks !== 'number') return false;
  if (typeof la.tables !== 'number') return false;
  if (typeof la.images !== 'number') return false;
  if (typeof la.columns !== 'number') return false;
  if (!['low', 'medium', 'high'].includes(String(la.complexity || '').toLowerCase())) return false;
  const md = obj.metadata;
  if (!md || typeof md !== 'object') return false;
  if (typeof md.wordCount !== 'number' || typeof md.characterCount !== 'number') return false;
  return true;
}

/**
 * Validates if an object conforms to the basic structure of a ProjectSummary.
 */
export function validateSummaryPayload(obj: any): boolean {
  if (!obj || typeof obj !== 'object') return false;
  if (!('summary' in obj) || typeof obj.summary !== 'string') return false;
  if (!('toc' in obj) || !Array.isArray(obj.toc)) return false;
  if (!('chapters' in obj) || !Array.isArray(obj.chapters)) return false;
  if (!('proofreadingNotes' in obj) || !Array.isArray(obj.proofreadingNotes)) return false;
  return true;
}