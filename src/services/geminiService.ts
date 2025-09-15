/**
 * Main Gemini service exports - refactored into modular services
 */

// Re-export all services from their respective modules
export { processWithGemini } from './ocr/ocrProcessingService';
export { summarizeProject } from './export/projectSummaryService';
export { proofreadAmharic, proofreadAmharicWithMeta } from './analysis/proofreadingService';
export { analyzeWordsWithConfidence } from './analysis/wordAnalysisService';
export { correctTextWithAIVision } from './analysis/aiVisionService';

// Re-export utilities for backward compatibility
export { 
  extractJsonFromText, 
  stripFences, 
  stripPageNumbers, 
  enforceEthiopicPunctuationAndQuotes, 
  normalizeLangCode, 
  clamp01, 
  containsEthiopic 
} from '../utils/textUtils';

export { 
  fileToBase64, 
  toInlineImagePartFromDataUrl, 
  ensureNonTiffImage 
} from '../utils/imageUtils';

export { 
  validateOCRPayload, 
  validateSummaryPayload 
} from '../utils/validationUtils';