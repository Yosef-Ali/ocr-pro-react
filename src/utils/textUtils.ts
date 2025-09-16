/**
 * Text processing utilities for OCR and language processing
 */
import { ETHIOPIC_RANGES, OCR_ERROR_PATTERNS } from './constants';

/**
 * Extracts a JSON object from a string, which may be wrapped in markdown fences.
 */
export function extractJsonFromText(text: string): string {
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
  if ((cleaned.startsWith('{') && cleaned.endsWith('}')) || (cleaned.startsWith('[') && cleaned.endsWith(']'))) {
    return cleaned;
  }

  throw new Error('Failed to extract JSON from model response');
}

/**
 * Strips markdown fences from a string, returning the content inside.
 */
export function stripFences(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch && fenceMatch[1]) {
    return fenceMatch[1].trim();
  }
  return text.replace(/```/g, '').replace(/^json\s*/i, '').trim();
}

/**
 * Removes lines that appear to be standalone page numbers from a string.
 */
export function stripPageNumbers(input: string): string {
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

/**
 * Converts common ASCII punctuation and quotes to their Ethiopic equivalents in a string.
 */
export function enforceEthiopicPunctuationAndQuotes(input: string): string {
  if (!input) return input;
  let s = input;
  // Replace ASCII colon/comma between Ethiopic letters with ፡ or ፣ respectively
  s = s.replace(/([\u1200-\u137F])\s*:\s*([\u1200-\u137F])/g, '$1፡$2');
  s = s.replace(/([\u1200-\u137F])\s*,\s*([\u1200-\u137F])/g, '$1፣$2');
  // Replace ASCII period at end of Ethiopic sentence with ።
  s = s.replace(/([\u1200-\u137F])\s*\.(?=\s|$)/g, '$1።');
  // Preserve guillemets: convert ASCII double quotes around Ethiopic spans to « »
  s = s.replace(/"\s*([\u1200-\u137F][^"\n]{0,200}?[\u1200-\u137F])\s*"/g, '«$1»');
  // Normalize duplicated spaces around Ethiopic punctuation
  s = s.replace(/\s*(፣|፡|።)\s*/g, '$1');
  return s;
}

/**
 * Normalizes a language code or name to a two-letter ISO 639-1 code.
 */
export function normalizeLangCode(code: any): string {
  if (!code || typeof code !== 'string') return 'unknown';
  const c = code.trim().toLowerCase();
  // Map common language names to ISO 639-1 when obvious
  const map: Record<string, string> = {
    english: 'en', french: 'fr', german: 'de', spanish: 'es', chinese: 'zh', japanese: 'ja', korean: 'ko', arabic: 'ar', portuguese: 'pt', russian: 'ru', italian: 'it', amharic: 'am', somali: 'so', tigrinya: 'ti', hindi: 'hi'
  };
  if (map[c]) return map[c];
  // Trim long codes like en-US -> en
  if (/^[a-z]{2}(-[a-z]{2})?$/.test(c)) return c.slice(0, 2);
  // Fallback
  return c.length === 2 ? c : 'unknown';
}

/**
 * Clamps a number between 0 and 1.
 */
export function clamp01(n: any): number {
  const x = typeof n === 'number' ? n : parseFloat(n);
  if (Number.isNaN(x)) return 0.5;
  return Math.max(0, Math.min(1, x));
}

/**
 * Checks if text contains Ethiopic characters
 */
export function containsEthiopic(s: string): boolean {
  return ETHIOPIC_RANGES.ALL.test(s);
}

// === Amharic Text Processing Functions ===

/**
 * Local Amharic text cleaning utilities
 */
export function cleanAmharicTextLocally(text: string): { cleaned: string; changes: number } {
  let cleaned = text;
  let totalChanges = 0;

  // Character fixes using constants
  const characterFixes: [RegExp, string][] = [
    // Fix zero-width characters
    [/[\u200B-\u200D\uFEFF]/g, ''],
    // Fix ASCII punctuation between Amharic characters
    [/([\u1200-\u137F])[#;:/\\|`~^*_=+]+([\u1200-\u137F])/g, '$1 $2'],
    // Remove Latin letters embedded in Amharic words
    [OCR_ERROR_PATTERNS.MIXED_SCRIPTS, '$1$2'],
    // Fix Amharic punctuation
    [/([^\s])([።፤፡፣])/g, '$1$2'], // Ensure no space before Amharic punctuation
    [/([።፤፡፣])([^\s])/g, '$1 $2'], // Ensure space after Amharic punctuation
    // Fix multiple spaces
    [/ {2,}/g, ' '],
    // Fix line-end spaces
    [/ +$/gm, ''],
  ];

  for (const [pattern, replacement] of characterFixes) {
    const matches = cleaned.match(pattern);
    if (matches) {
      cleaned = cleaned.replace(pattern, replacement);
      totalChanges += matches.length;
    }
  }

  return { cleaned, changes: totalChanges };
}

/**
 * Validate Amharic text structure
 */
export function validateAmharicText(text: string): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  // Check for mixed scripts
  const hasAmharic = ETHIOPIC_RANGES.ALL.test(text);
  const hasLatin = /[a-zA-Z]/.test(text);
  
  if (hasAmharic && hasLatin) {
    // Check if Latin appears in isolation (OK) or mixed with Amharic (problematic)
    const mixedScriptPattern = /([\u1200-\u137F]+[a-zA-Z]+[\u1200-\u137F]*)|([a-zA-Z]+[\u1200-\u137F]+)/;
    if (mixedScriptPattern.test(text)) {
      issues.push('Mixed scripts detected within words');
    }
  }

  // Check for ASCII punctuation noise
  if (/[#;:/\\|`~^*_=+]{2,}/.test(text)) {
    issues.push('Excessive ASCII punctuation detected');
  }

  // Check for proper Amharic sentence structure
  if (hasAmharic) {
    const lines = text.split('\n').filter(line => line.trim());
    for (const line of lines) {
      // Check if Amharic sentences end with proper punctuation
      if (/[\u1200-\u137F]$/.test(line.trim())) {
        issues.push(`Line may be missing punctuation: "${line.substring(0, 50)}..."`);
      }
    }
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

/**
 * Extract semantic context from Amharic text
 */
export function extractAmharicContext(text: string): {
  sentences: string[];
  paragraphs: string[];
  hasPoetry: boolean;
  hasDialog: boolean;
} {
  // Split into sentences using Amharic punctuation
  const sentences = text
    .split(/[።፤]/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // Split into paragraphs
  const paragraphs = text
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  // Detect poetry (short lines with consistent structure)
  const lines = text.split('\n').filter(l => l.trim());
  const avgLineLength = lines.reduce((sum, l) => sum + l.length, 0) / lines.length;
  const hasPoetry = avgLineLength < 50 && lines.length > 4;

  // Detect dialog (quotes or dialog markers)
  const hasDialog = /[""]|«»|‹›|፦/.test(text);

  return {
    sentences,
    paragraphs,
    hasPoetry,
    hasDialog
  };
}

// === Enhanced Amharic Word Validation Functions ===

/**
 * Validates individual Amharic words for proper character sequences
 */
export function validateAmharicWord(word: string): {
  isValid: boolean;
  confidence: number;
  issues: string[];
} {
  const issues: string[] = [];
  let confidence = 1.0;

  if (!word || word.trim().length === 0) {
    return { isValid: false, confidence: 0, issues: ['Empty word'] };
  }

  const cleanWord = word.trim();

  // Check if word contains any Amharic characters
  const hasAmharic = ETHIOPIC_RANGES.ALL.test(cleanWord);
  if (!hasAmharic) {
    return { isValid: true, confidence: 0.9, issues: [] }; // Non-Amharic words are valid but lower confidence
  }

  // Check for mixed scripts within the word
  const hasLatin = /[a-zA-Z]/.test(cleanWord);
  const hasNumbers = /[0-9]/.test(cleanWord);
  
  if (hasAmharic && hasLatin) {
    issues.push('Mixed Amharic and Latin scripts');
    confidence -= 0.4;
  }

  if (hasAmharic && hasNumbers) {
    issues.push('Numbers mixed with Amharic text');
    confidence -= 0.3;
  }

  // Check for ASCII noise characters
  if (/[#;:\/\\|`~^*_=+]/.test(cleanWord)) {
    issues.push('Contains ASCII noise characters');
    confidence -= 0.5;
  }

  // Check for invalid character sequences (too many repeated characters)
  if (/(.)\1{4,}/.test(cleanWord)) {
    issues.push('Excessive character repetition');
    confidence -= 0.4;
  }

  // Check for common OCR scrambling patterns
  if (hasAmharic) {
    // Words that are too short or too long are suspicious
    const amharicChars = cleanWord.match(ETHIOPIC_RANGES.ALL) || [];
    if (amharicChars.length === 1 && cleanWord.length > 3) {
      issues.push('Single Amharic character with noise');
      confidence -= 0.3;
    }

    // Check for invalid Amharic character combinations (simplified heuristic)
    const invalidCombos = /[ዘዟዠዡዢዣዤዥዦዧ]{3,}|[ጰጱጲጳጴጵጶጷ]{3,}/;
    if (invalidCombos.test(cleanWord)) {
      issues.push('Invalid character combinations');
      confidence -= 0.4;
    }
  }

  // Adjust confidence based on word length (very short or very long words are suspicious)
  if (cleanWord.length < 2) {
    confidence -= 0.2;
  } else if (cleanWord.length > 20) {
    confidence -= 0.3;
  }

  confidence = Math.max(0, Math.min(1, confidence));
  const isValid = issues.length === 0 && confidence > 0.6;

  return { isValid, confidence, issues };
}

/**
 * Detects heavily corrupted/scrambled Amharic text
 */
export function detectCorruptedAmharicText(text: string): {
  isCorrupted: boolean;
  corruptionLevel: 'low' | 'medium' | 'high';
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let corruptionScore = 0;

  if (!text || text.trim().length === 0) {
    return { isCorrupted: false, corruptionLevel: 'low', issues: [], suggestions: [] };
  }

  const words = text.split(/\s+/).filter(w => w.trim().length > 0);
  let problematicWords = 0;

  for (const word of words) {
    const validation = validateAmharicWord(word);
    if (!validation.isValid || validation.confidence < 0.6) {
      problematicWords++;
      if (validation.issues.length > 0) {
        issues.push(`"${word}": ${validation.issues.join(', ')}`);
      }
    }
  }

  // Calculate corruption score
  const corruptionRatio = words.length > 0 ? problematicWords / words.length : 0;
  corruptionScore = corruptionRatio;

  // Check for additional corruption indicators
  if (/[#;:\/\\|`~^*_=+]{2,}/.test(text)) {
    corruptionScore += 0.3;
    issues.push('Multiple ASCII noise characters detected');
    suggestions.push('Remove noise characters (#, ;, :, /, \\, |, etc.)');
  }

  if (/([A-Z0-9]{2,})|([0-9]{3,})/.test(text)) {
    corruptionScore += 0.2;
    issues.push('Suspicious uppercase letters or number sequences');
    suggestions.push('Verify if letter/number sequences belong in text');
  }

  if (OCR_ERROR_PATTERNS.MIXED_SCRIPTS.test(text)) {
    corruptionScore += 0.3;
    issues.push('Mixed scripts within words');
    suggestions.push('Separate Amharic and Latin text properly');
  }

  // Determine corruption level
  let corruptionLevel: 'low' | 'medium' | 'high';
  if (corruptionScore < 0.3) {
    corruptionLevel = 'low';
  } else if (corruptionScore < 0.6) {
    corruptionLevel = 'medium';
  } else {
    corruptionLevel = 'high';
  }

  // Add suggestions based on corruption level
  if (corruptionLevel === 'high') {
    suggestions.push('Consider re-scanning the document with higher quality settings');
    suggestions.push('Try using a different OCR engine');
  } else if (corruptionLevel === 'medium') {
    suggestions.push('Manual review and correction recommended');
  }

  return {
    isCorrupted: corruptionScore > 0.3,
    corruptionLevel,
    issues,
    suggestions
  };
}

/**
 * Analyzes text and provides word-level analysis for highlighting
 */
export function analyzeAmharicTextForHighlighting(text: string): Array<{
  word: string;
  position: { start: number; end: number };
  confidence: number;
  issues?: string[];
  suggestions?: string[];
}> {
  const analysis: Array<{
    word: string;
    position: { start: number; end: number };
    confidence: number;
    issues?: string[];
    suggestions?: string[];
  }> = [];

  if (!text || text.trim().length === 0) {
    return analysis;
  }

  // Split text while preserving positions
  const words = text.split(/(\s+)/);
  let currentPosition = 0;

  for (const segment of words) {
    const startPos = currentPosition;
    const endPos = currentPosition + segment.length;

    // Only analyze non-whitespace segments
    if (segment.trim().length > 0) {
      const validation = validateAmharicWord(segment);
      const wordAnalysis = {
        word: segment,
        position: { start: startPos, end: endPos },
        confidence: validation.confidence,
        issues: validation.issues.length > 0 ? validation.issues : undefined,
        suggestions: generateSuggestionsForWord(segment, validation)
      };

      analysis.push(wordAnalysis);
    }

    currentPosition = endPos;
  }

  return analysis;
}

/**
 * Generates correction suggestions for problematic words
 */
function generateSuggestionsForWord(word: string, validation: { isValid: boolean; confidence: number; issues: string[] }): string[] | undefined {
  const suggestions: string[] = [];

  if (validation.issues.includes('Mixed Amharic and Latin scripts')) {
    // Try to extract just the Amharic part
    const amharicPart = word.match(/[\u1200-\u137F\u1380-\u139F\u2D80-\u2DDF]+/g)?.[0];
    if (amharicPart && amharicPart !== word) {
      suggestions.push(amharicPart);
    }
  }

  if (validation.issues.includes('Contains ASCII noise characters')) {
    // Remove ASCII noise
    const cleaned = word.replace(/[#;:\/\\|`~^*_=+]/g, '');
    if (cleaned !== word && cleaned.length > 0) {
      suggestions.push(cleaned);
    }
  }

  if (validation.issues.includes('Numbers mixed with Amharic text')) {
    // Remove numbers
    const cleaned = word.replace(/[0-9]/g, '');
    if (cleaned !== word && cleaned.length > 0) {
      suggestions.push(cleaned);
    }
  }

  return suggestions.length > 0 ? suggestions : undefined;
}