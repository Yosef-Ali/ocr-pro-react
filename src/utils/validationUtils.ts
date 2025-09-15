/**
 * Validation utilities for OCR results, API responses, and user inputs
 */

/**
 * Downloads a blob as a file with the specified filename
 * @param blob - The blob to download
 * @param filename - The filename for the download
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Validates if an object conforms to the basic structure of an OCRResult.
 * @param obj - The object to validate
 * @returns True if the object has the required OCR result structure
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
 * @param obj - The object to validate
 * @returns True if the object has the required project summary structure
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
 * Validates Google Gemini API key format and basic requirements.
 * Checks for proper length, character set, and common prefixes.
 * @param apiKey - The API key string to validate
 * @returns True if the API key appears to be valid
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
 * Sanitizes user input to prevent XSS attacks by escaping HTML characters.
 * @param input - The input string to sanitize
 * @returns The sanitized string safe for HTML display
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
 * Validates file upload to prevent malicious files and ensure compatibility.
 * Checks file size, type, and extension consistency.
 * @param file - The File object to validate
 * @returns Object with validation result and error message if invalid
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