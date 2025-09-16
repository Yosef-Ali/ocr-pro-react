/**
 * Specialized helpers for Amharic OCR processing and error detection
 */
import { ETHIOPIC_RANGES, OCR_ERROR_PATTERNS, RELIGIOUS_TERMS } from './constants';
import { validateAmharicWord, detectCorruptedAmharicText } from './textUtils';

/**
 * Common Amharic word patterns and religious terms for validation
 */
const COMMON_AMHARIC_PATTERNS = {
  // Common religious terms patterns
  RELIGIOUS_WORDS: [
    'ጸሎት', 'ቤተክርስቲያን', 'እግዚአብሔር', 'የሱስ', 'ክርስቶስ', 'ማርያም', 'መድኃኔዓለም',
    'ቫቲካን', 'ምዕራፍ', 'ክፍል', 'በዓል', 'ጾም', 'ንዋሓ', 'ድንግል', 'እናት', 'ቅዱስ', 'ቅድስት'
  ],
  
  // Common Amharic prefixes and suffixes
  PREFIXES: ['በ', 'ከ', 'ለ', 'ወ', 'የ', 'ስ', 'ህ', 'ም', 'እ'],
  SUFFIXES: ['ት', 'ን', 'ላ', 'ወች', 'ኝ', 'ህ', 'ሽ', 'አል', 'ዋል']
};

/**
 * Analyzes OCR results specifically for Amharic text quality
 */
export function analyzeAmharicOCRQuality(text: string): {
  overallQuality: 'poor' | 'fair' | 'good' | 'excellent';
  confidence: number;
  wordAnalysis: Array<{
    word: string;
    confidence: number;
    issues: string[];
    isLikelyAmharic: boolean;
  }>;
  corruptionAnalysis: {
    isCorrupted: boolean;
    corruptionLevel: 'low' | 'medium' | 'high';
    issues: string[];
    suggestions: string[];
  };
  religiousContentDetected: boolean;
} {
  const words = text.split(/\s+/).filter(w => w.trim().length > 0);
  const wordAnalysis = words.map(word => {
    const validation = validateAmharicWord(word);
    const isLikelyAmharic = isAmharicWord(word);
    
    return {
      word,
      confidence: validation.confidence,
      issues: validation.issues,
      isLikelyAmharic
    };
  });

  // Calculate overall confidence
  const totalConfidence = wordAnalysis.reduce((sum, w) => sum + w.confidence, 0);
  const averageConfidence = words.length > 0 ? totalConfidence / words.length : 0;

  // Determine overall quality
  let overallQuality: 'poor' | 'fair' | 'good' | 'excellent';
  if (averageConfidence >= 0.9) {
    overallQuality = 'excellent';
  } else if (averageConfidence >= 0.75) {
    overallQuality = 'good';
  } else if (averageConfidence >= 0.5) {
    overallQuality = 'fair';
  } else {
    overallQuality = 'poor';
  }

  // Analyze corruption
  const corruptionAnalysis = detectCorruptedAmharicText(text);

  // Detect religious content
  const religiousContentDetected = detectReligiousContent(text);

  return {
    overallQuality,
    confidence: averageConfidence,
    wordAnalysis,
    corruptionAnalysis,
    religiousContentDetected
  };
}

/**
 * Checks if a word is likely to be Amharic based on character patterns
 */
export function isAmharicWord(word: string): boolean {
  const cleanWord = word.trim();
  
  // Must contain at least one Ethiopic character
  if (!ETHIOPIC_RANGES.ALL.test(cleanWord)) {
    return false;
  }

  // Calculate ratio of Ethiopic to total characters
  const ethiopicMatches = cleanWord.match(ETHIOPIC_RANGES.ALL) || [];
  const ethiopicRatio = ethiopicMatches.length / cleanWord.length;

  // Consider it Amharic if majority of characters are Ethiopic
  return ethiopicRatio >= 0.7;
}

/**
 * Detects religious content in Amharic text
 */
export function detectReligiousContent(text: string): boolean {
  const lowerText = text.toLowerCase();
  
  // Check for known religious terms
  const religiousTermsFound = COMMON_AMHARIC_PATTERNS.RELIGIOUS_WORDS.some(term => 
    lowerText.includes(term.toLowerCase())
  );

  // Check for religious patterns (simplified)
  const religiousPatterns = [
    /ቤተ.{0,5}ክርስቲያን/, // Church variations
    /እግዚአብሔር/, // God
    /የሱስ.{0,5}ክርስቶስ/, // Jesus Christ variations
    /ድንግል.{0,5}ማርያም/, // Virgin Mary variations
    /መድኃኔ.{0,5}ዓለም/, // Savior of the world variations
  ];

  const hasReligiousPatterns = religiousPatterns.some(pattern => pattern.test(text));

  return religiousTermsFound || hasReligiousPatterns;
}

/**
 * Provides suggestions for improving corrupted Amharic text
 */
export function suggestAmharicCorrections(text: string): Array<{
  original: string;
  suggestion: string;
  confidence: number;
  reason: string;
}> {
  const suggestions: Array<{
    original: string;
    suggestion: string;
    confidence: number;
    reason: string;
  }> = [];

  // Remove obvious noise patterns
  const noisePatterns = [
    { pattern: /([አ-ፚ]+)[#;:\/\\|`~^*_=+]+([አ-ፚ]*)/g, reason: 'Remove ASCII noise characters' },
    { pattern: /([አ-ፚ]+)[0-9]+([አ-ፚ]*)/g, reason: 'Remove embedded numbers' },
    { pattern: /([አ-ፚ]+)[A-Z]+([አ-ፚ]*)/g, reason: 'Remove embedded uppercase letters' },
  ];

  for (const { pattern, reason } of noisePatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const original = match[0];
      const suggestion = match[1] + match[2];
      if (suggestion.length > 0 && suggestion !== original) {
        suggestions.push({
          original,
          suggestion,
          confidence: 0.8,
          reason
        });
      }
    }
  }

  // Try to fix common OCR character substitutions
  const commonSubstitutions = [
    { from: /ሥ/g, to: 'ስ', reason: 'Common character variant' },
    { from: /ኅ/g, to: 'ህ', reason: 'Common character variant' },
    { from: /ፀ/g, to: 'ጸ', reason: 'Common character variant' },
  ];

  for (const { from, to, reason } of commonSubstitutions) {
    if (from.test(text)) {
      const corrected = text.replace(from, to);
      suggestions.push({
        original: text,
        suggestion: corrected,
        confidence: 0.6,
        reason
      });
    }
  }

  return suggestions;
}

/**
 * Validates Amharic text structure for religious documents
 */
export function validateReligiousAmharicText(text: string): {
  isValid: boolean;
  score: number;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 1.0;

  // Check for religious content
  const hasReligiousContent = detectReligiousContent(text);
  if (!hasReligiousContent) {
    issues.push('No religious terminology detected');
    suggestions.push('Verify this is religious content');
    score -= 0.1;
  }

  // Check text structure
  const corruption = detectCorruptedAmharicText(text);
  if (corruption.isCorrupted) {
    issues.push(`Text corruption detected (${corruption.corruptionLevel} level)`);
    suggestions.push(...corruption.suggestions);
    
    switch (corruption.corruptionLevel) {
      case 'high':
        score -= 0.6;
        break;
      case 'medium':
        score -= 0.3;
        break;
      case 'low':
        score -= 0.1;
        break;
    }
  }

  // Check for proper Amharic sentence structure
  const sentences = text.split(/[።፤]/).filter(s => s.trim().length > 0);
  if (sentences.length === 0) {
    issues.push('No proper sentence structure detected');
    suggestions.push('Add proper Amharic punctuation (។ or ፤)');
    score -= 0.2;
  }

  // Check for mixed scripts in problematic ways
  if (OCR_ERROR_PATTERNS.MIXED_SCRIPTS.test(text)) {
    issues.push('Mixed scripts within words detected');
    suggestions.push('Separate Amharic and non-Amharic text');
    score -= 0.3;
  }

  score = Math.max(0, Math.min(1, score));

  return {
    isValid: score >= 0.7 && issues.length <= 2,
    score,
    issues,
    suggestions
  };
}

/**
 * Extracts and analyzes problematic sections in Amharic text
 */
export function identifyProblematicSections(text: string): Array<{
  section: string;
  startIndex: number;
  endIndex: number;
  issues: string[];
  severity: 'low' | 'medium' | 'high';
  suggestions: string[];
}> {
  const problematicSections: Array<{
    section: string;
    startIndex: number;
    endIndex: number;
    issues: string[];
    severity: 'low' | 'medium' | 'high';
    suggestions: string[];
  }> = [];

  // Split text into sentences or paragraphs for analysis
  const sections = text.split(/[።፤\n\n]/).map(s => s.trim()).filter(s => s.length > 0);
  let currentIndex = 0;

  for (const section of sections) {
    const startIndex = text.indexOf(section, currentIndex);
    const endIndex = startIndex + section.length;
    
    const analysis = analyzeAmharicOCRQuality(section);
    
    if (analysis.overallQuality === 'poor' || analysis.corruptionAnalysis.isCorrupted) {
      const issues: string[] = [];
      let severity: 'low' | 'medium' | 'high' = 'low';

      if (analysis.overallQuality === 'poor') {
        issues.push('Poor OCR quality detected');
        severity = 'high';
      }

      if (analysis.corruptionAnalysis.isCorrupted) {
        issues.push(`Text corruption: ${analysis.corruptionAnalysis.corruptionLevel} level`);
        severity = analysis.corruptionAnalysis.corruptionLevel;
      }

      problematicSections.push({
        section,
        startIndex,
        endIndex,
        issues,
        severity,
        suggestions: analysis.corruptionAnalysis.suggestions
      });
    }

    currentIndex = endIndex;
  }

  return problematicSections;
}

/**
 * Provides comprehensive Amharic text quality report
 */
export function generateAmharicQualityReport(text: string): {
  summary: {
    overallScore: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    wordCount: number;
    amharicWordCount: number;
    problematicWordCount: number;
  };
  details: {
    qualityAnalysis: ReturnType<typeof analyzeAmharicOCRQuality>;
    problematicSections: ReturnType<typeof identifyProblematicSections>;
    suggestions: ReturnType<typeof suggestAmharicCorrections>;
  };
  recommendations: string[];
} {
  const qualityAnalysis = analyzeAmharicOCRQuality(text);
  const problematicSections = identifyProblematicSections(text);
  const suggestions = suggestAmharicCorrections(text);

  const words = text.split(/\s+/).filter(w => w.trim().length > 0);
  const amharicWords = words.filter(w => isAmharicWord(w));
  const problematicWords = qualityAnalysis.wordAnalysis.filter(w => w.confidence < 0.6);

  // Calculate overall score
  const qualityScore = qualityAnalysis.confidence;
  const corruptionPenalty = qualityAnalysis.corruptionAnalysis.isCorrupted ? 0.3 : 0;
  const overallScore = Math.max(0, qualityScore - corruptionPenalty);

  // Determine grade
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (overallScore >= 0.9) grade = 'A';
  else if (overallScore >= 0.8) grade = 'B';
  else if (overallScore >= 0.7) grade = 'C';
  else if (overallScore >= 0.6) grade = 'D';
  else grade = 'F';

  // Generate recommendations
  const recommendations: string[] = [];
  
  if (overallScore < 0.7) {
    recommendations.push('Consider re-scanning the document with higher quality settings');
  }
  
  if (qualityAnalysis.corruptionAnalysis.isCorrupted) {
    recommendations.push('Manual review and correction required for corrupted sections');
  }
  
  if (problematicWords.length > words.length * 0.3) {
    recommendations.push('High number of problematic words detected - verify OCR engine settings');
  }
  
  if (!qualityAnalysis.religiousContentDetected && RELIGIOUS_TERMS.VIRGIN_MARY) {
    recommendations.push('Consider using Amharic-specific OCR settings for religious texts');
  }

  return {
    summary: {
      overallScore,
      grade,
      wordCount: words.length,
      amharicWordCount: amharicWords.length,
      problematicWordCount: problematicWords.length
    },
    details: {
      qualityAnalysis,
      problematicSections,
      suggestions
    },
    recommendations
  };
}