/**
 * Batch processing service for multiple Amharic documents
 * Handles OCR correction, quality analysis, and bulk operations
 */
import { OCRResult, Settings } from '@/types';
import { generateAmharicQualityReport, suggestAmharicCorrections } from '@/utils/amharicHelpers';
import { detectCorruptedAmharicText, cleanAmharicTextLocally } from '@/utils/textUtils';

export interface DocumentAnalysis {
  documentId: string;
  fileName: string;
  totalWords: number;
  corruptedWords: number;
  qualityScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  corruptionLevel: 'low' | 'medium' | 'high';
  issues: string[];
  suggestions: string[];
  processingTime: number;
}

export interface BatchProcessingResult {
  summary: {
    totalDocuments: number;
    successfullyProcessed: number;
    failed: number;
    averageQuality: number;
    totalCorruptedWords: number;
    processingTime: number;
  };
  documents: DocumentAnalysis[];
  overallRecommendations: string[];
  commonIssues: { issue: string; frequency: number }[];
}

export interface CorrectionSuggestion {
  documentId: string;
  fileName: string;
  original: string;
  corrected: string;
  confidence: number;
  reason: string;
  position: { start: number; end: number };
}

/**
 * Processes multiple Amharic documents and analyzes their OCR quality
 */
export async function processBatchAmharicDocuments(
  ocrResults: OCRResult[],
  settings: Settings
): Promise<BatchProcessingResult> {
  const startTime = performance.now();
  const documents: DocumentAnalysis[] = [];
  let successfullyProcessed = 0;
  let failed = 0;
  let totalCorruptedWords = 0;

  for (const result of ocrResults) {
    try {
      const analysis = await analyzeDocument(result, settings);
      documents.push(analysis);
      totalCorruptedWords += analysis.corruptedWords;
      successfullyProcessed++;
    } catch (error) {
      console.error(`Failed to analyze document ${result.fileId}:`, error);
      failed++;
    }
  }

  const endTime = performance.now();
  const processingTime = endTime - startTime;

  // Calculate overall statistics
  const averageQuality = documents.length > 0
    ? documents.reduce((sum, doc) => sum + doc.qualityScore, 0) / documents.length
    : 0;

  // Identify common issues across documents
  const allIssues: string[] = [];
  documents.forEach(doc => allIssues.push(...doc.issues));
  const issueFrequency = allIssues.reduce((acc, issue) => {
    acc[issue] = (acc[issue] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const commonIssues = Object.entries(issueFrequency)
    .map(([issue, frequency]) => ({ issue, frequency }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10); // Top 10 most common issues

  // Generate overall recommendations
  const overallRecommendations = generateOverallRecommendations(documents, commonIssues);

  return {
    summary: {
      totalDocuments: ocrResults.length,
      successfullyProcessed,
      failed,
      averageQuality,
      totalCorruptedWords,
      processingTime
    },
    documents,
    overallRecommendations,
    commonIssues
  };
}

/**
 * Analyzes a single document for Amharic OCR quality
 */
async function analyzeDocument(result: OCRResult, _settings: Settings): Promise<DocumentAnalysis> {
  const startTime = performance.now();

  const text = result.extractedText;
  const qualityReport = generateAmharicQualityReport(text);
  const corruptionAnalysis = detectCorruptedAmharicText(text);

  const endTime = performance.now();
  const processingTime = endTime - startTime;

  return {
    documentId: result.id,
    fileName: result.fileId, // You might want to map this to actual filename
    totalWords: qualityReport.summary.wordCount,
    corruptedWords: qualityReport.summary.problematicWordCount,
    qualityScore: qualityReport.summary.overallScore,
    grade: qualityReport.summary.grade,
    corruptionLevel: corruptionAnalysis.corruptionLevel,
    issues: corruptionAnalysis.issues,
    suggestions: qualityReport.recommendations,
    processingTime
  };
}

/**
 * Generates correction suggestions for all documents in batch
 */
export function generateBatchCorrections(ocrResults: OCRResult[]): CorrectionSuggestion[] {
  const allCorrections: CorrectionSuggestion[] = [];

  for (const result of ocrResults) {
    const corrections = suggestAmharicCorrections(result.extractedText);

    corrections.forEach(correction => {
      // Find position of the original text
      const startIndex = result.extractedText.indexOf(correction.original);

      allCorrections.push({
        documentId: result.id,
        fileName: result.fileId,
        original: correction.original,
        corrected: correction.suggestion,
        confidence: correction.confidence,
        reason: correction.reason,
        position: {
          start: startIndex,
          end: startIndex + correction.original.length
        }
      });
    });
  }

  // Sort by confidence (highest first) and then by frequency of the same error
  return allCorrections.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Applies bulk corrections to multiple documents
 */
export function applyBulkCorrections(
  ocrResults: OCRResult[],
  corrections: CorrectionSuggestion[]
): { [documentId: string]: string } {
  const correctedTexts: { [documentId: string]: string } = {};

  for (const result of ocrResults) {
    let correctedText = result.extractedText;

    // Get corrections for this document
    const documentCorrections = corrections.filter(c => c.documentId === result.id);

    // Apply corrections in reverse order (by position) to maintain indices
    documentCorrections
      .sort((a, b) => b.position.start - a.position.start)
      .forEach(correction => {
        // Only apply high-confidence corrections automatically
        if (correction.confidence >= 0.8) {
          correctedText = correctedText.replace(correction.original, correction.corrected);
        }
      });

    // Apply local Amharic cleaning
    const cleaned = cleanAmharicTextLocally(correctedText);
    correctedTexts[result.id] = cleaned.cleaned;
  }

  return correctedTexts;
}

/**
 * Ranks documents by quality for processing prioritization
 */
export function rankDocumentsByQuality(analyses: DocumentAnalysis[]): DocumentAnalysis[] {
  return [...analyses].sort((a, b) => {
    // Primary sort: by quality score (highest first)
    if (a.qualityScore !== b.qualityScore) {
      return b.qualityScore - a.qualityScore;
    }

    // Secondary sort: by corruption level (least corrupted first)
    const corruptionOrder = { 'low': 3, 'medium': 2, 'high': 1 };
    if (a.corruptionLevel !== b.corruptionLevel) {
      return corruptionOrder[b.corruptionLevel] - corruptionOrder[a.corruptionLevel];
    }

    // Tertiary sort: by number of issues (fewer issues first)
    return a.issues.length - b.issues.length;
  });
}

/**
 * Identifies patterns in corruption across multiple documents
 */
export function identifyCorruptionPatterns(ocrResults: OCRResult[]): {
  patterns: { pattern: string; frequency: number; examples: string[] }[];
  recommendations: string[];
} {
  const patternMap = new Map<string, { frequency: number; examples: Set<string> }>();

  for (const result of ocrResults) {
    const text = result.extractedText;

    // Common corruption patterns
    const patterns = [
      { name: 'ASCII_NOISE', regex: /[#;:\/\\|`~^*_=+]/g },
      { name: 'MIXED_SCRIPTS', regex: /([\u1200-\u137F]+)[a-zA-Z]+([\u1200-\u137F]*)/g },
      { name: 'NUMBERS_IN_AMHARIC', regex: /([\u1200-\u137F]+)[0-9]+([\u1200-\u137F]*)/g },
      { name: 'UPPERCASE_NOISE', regex: /([A-Z]{2,})/g },
      { name: 'REPEATED_PUNCTUATION', regex: /([።፤፣፡]){2,}/g },
    ];

    patterns.forEach(({ name, regex }) => {
      const matches = text.match(regex);
      if (matches) {
        const existing = patternMap.get(name) || { frequency: 0, examples: new Set() };
        existing.frequency += matches.length;
        matches.slice(0, 3).forEach(match => existing.examples.add(match)); // Keep max 3 examples
        patternMap.set(name, existing);
      }
    });
  }

  const patterns = Array.from(patternMap.entries()).map(([pattern, data]) => ({
    pattern,
    frequency: data.frequency,
    examples: Array.from(data.examples)
  })).sort((a, b) => b.frequency - a.frequency);

  // Generate recommendations based on patterns
  const recommendations: string[] = [];

  if ((patterns.find(p => p.pattern === 'ASCII_NOISE')?.frequency || 0) > 10) {
    recommendations.push('High frequency of ASCII noise detected - consider OCR preprocessing');
  }

  if ((patterns.find(p => p.pattern === 'MIXED_SCRIPTS')?.frequency || 0) > 5) {
    recommendations.push('Mixed script issues common - verify language detection settings');
  }

  if ((patterns.find(p => p.pattern === 'NUMBERS_IN_AMHARIC')?.frequency || 0) > 3) {
    recommendations.push('Numbers embedded in Amharic text - check digit recognition settings');
  }

  return { patterns, recommendations };
}

/**
 * Generates overall recommendations for the batch processing
 */
function generateOverallRecommendations(
  documents: DocumentAnalysis[],
  commonIssues: { issue: string; frequency: number }[]
): string[] {
  const recommendations: string[] = [];

  const averageQuality = documents.reduce((sum, doc) => sum + doc.qualityScore, 0) / documents.length;
  const highCorruptionDocs = documents.filter(doc => doc.corruptionLevel === 'high').length;
  const poorQualityDocs = documents.filter(doc => doc.grade === 'D' || doc.grade === 'F').length;

  if (averageQuality < 0.6) {
    recommendations.push('Overall document quality is poor - consider re-scanning with higher DPI settings');
  }

  if (highCorruptionDocs > documents.length * 0.3) {
    recommendations.push('High corruption rate detected - verify OCR engine configuration');
  }

  if (poorQualityDocs > documents.length * 0.4) {
    recommendations.push('Many documents require manual review - prioritize highest quality documents first');
  }

  // Add recommendations based on common issues
  if (commonIssues.some(issue => issue.issue.includes('ASCII noise'))) {
    recommendations.push('ASCII noise is a common issue - implement preprocessing to remove special characters');
  }

  if (commonIssues.some(issue => issue.issue.includes('Mixed scripts'))) {
    recommendations.push('Mixed script detection needed - separate Amharic and Latin text during processing');
  }

  return recommendations;
}

/**
 * Exports batch processing results in various formats
 */
export function exportBatchResults(
  batchResult: BatchProcessingResult,
  format: 'json' | 'csv' | 'summary'
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(batchResult, null, 2);

    case 'csv':
      const headers = 'Document,Quality Score,Grade,Corrupted Words,Corruption Level,Issues Count';
      const rows = batchResult.documents.map(doc =>
        `"${doc.fileName}",${doc.qualityScore.toFixed(2)},${doc.grade},${doc.corruptedWords},${doc.corruptionLevel},${doc.issues.length}`
      );
      return [headers, ...rows].join('\n');

    case 'summary':
      return `
AMHARIC DOCUMENT BATCH PROCESSING SUMMARY
=========================================

Total Documents: ${batchResult.summary.totalDocuments}
Successfully Processed: ${batchResult.summary.successfullyProcessed}
Failed: ${batchResult.summary.failed}
Average Quality: ${(batchResult.summary.averageQuality * 100).toFixed(1)}%
Total Corrupted Words: ${batchResult.summary.totalCorruptedWords}
Processing Time: ${batchResult.summary.processingTime.toFixed(0)}ms

DOCUMENT QUALITY BREAKDOWN:
${batchResult.documents.map(doc =>
        `${doc.fileName}: ${doc.grade} (${(doc.qualityScore * 100).toFixed(1)}%) - ${doc.corruptedWords} corrupted words`
      ).join('\n')}

COMMON ISSUES:
${batchResult.commonIssues.slice(0, 5).map(issue =>
        `${issue.issue}: ${issue.frequency} occurrences`
      ).join('\n')}

RECOMMENDATIONS:
${batchResult.overallRecommendations.map(rec => `• ${rec}`).join('\n')}
      `.trim();

    default:
      return JSON.stringify(batchResult, null, 2);
  }
}