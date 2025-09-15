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

/**
 * Validates Google Gemini API key format
 */
export function validateGeminiApiKey(apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') return false;
  
  // Gemini API keys start with specific prefixes
  const validPrefixes = ['AIza', 'AIzaSy'];
  const trimmed = apiKey.trim();
  
  // Check length (should be around 39 characters for newer keys)
  if (trimmed.length < 20 || trimmed.length > 50) return false;
  
  // Check for valid prefix
  if (!validPrefixes.some(prefix => trimmed.startsWith(prefix))) return false;
  
  // Check for valid characters (alphanumeric, hyphens, underscores)
  const validChars = /^[A-Za-z0-9_-]+$/;
  if (!validChars.test(trimmed)) return false;
  
  return true;
}

/**
 * Sanitizes user input to prevent XSS attacks
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validates file upload to prevent malicious files
 */
export function validateFileUpload(file: File): { valid: boolean; error?: string } {
  // Check file size (max 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return { valid: false, error: 'File size exceeds 10MB limit' };
  }
  
  // Check file type
  const allowedTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/bmp',
    'image/tiff',
    'image/webp',
    'application/pdf'
  ];
  
  if (!allowedTypes.includes(file.type.toLowerCase())) {
    return { valid: false, error: 'Unsupported file type. Only images and PDFs are allowed.' };
  }
  
  // Check file extension matches type
  const extension = file.name.toLowerCase().split('.').pop();
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'webp'];
  const pdfExtensions = ['pdf'];
  
  if (file.type.startsWith('image/') && !imageExtensions.includes(extension || '')) {
    return { valid: false, error: 'File extension does not match file type' };
  }
  
  if (file.type === 'application/pdf' && !pdfExtensions.includes(extension || '')) {
    return { valid: false, error: 'File extension does not match file type' };
  }
  
  return { valid: true };
}