import { useState, useCallback, useMemo } from 'react';
import { OCRResult, Settings } from '@/types';
import { 
  processBatchAmharicDocuments, 
  generateBatchCorrections, 
  applyBulkCorrections,
  rankDocumentsByQuality,
  identifyCorruptionPatterns,
  BatchProcessingResult,
  CorrectionSuggestion,
  DocumentAnalysis
} from '@/services/amharicBatchProcessor';

export interface UseBatchProcessingReturn {
  // State
  batchResult: BatchProcessingResult | null;
  corrections: CorrectionSuggestion[];
  correctedTexts: { [documentId: string]: string };
  isProcessing: boolean;
  error: string | null;
  processingProgress: number;
  
  // Actions
  processBatch: (ocrResults: OCRResult[], settings: Settings) => Promise<void>;
  applyCorrection: (correction: CorrectionSuggestion) => void;
  applyBulkCorrections: (corrections: CorrectionSuggestion[]) => void;
  rejectCorrection: (correction: CorrectionSuggestion) => void;
  resetProcessing: () => void;
  
  // Computed values
  hasAmharicContent: boolean;
  documentRanking: DocumentAnalysis[];
  corruptionPatterns: ReturnType<typeof identifyCorruptionPatterns>;
  qualityStats: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
    total: number;
  };
  correctionStats: {
    total: number;
    highConfidence: number;
    applied: number;
    pending: number;
  };
}

export const useBatchProcessing = (ocrResults: OCRResult[]): UseBatchProcessingReturn => {
  const [batchResult, setBatchResult] = useState<BatchProcessingResult | null>(null);
  const [corrections, setCorrections] = useState<CorrectionSuggestion[]>([]);
  const [correctedTexts, setCorrectedTexts] = useState<{ [documentId: string]: string }>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [appliedCorrections, setAppliedCorrections] = useState<Set<string>>(new Set());

  // Check if documents contain Amharic content
  const hasAmharicContent = useMemo(() => {
    return ocrResults.some(result => 
      /[\u1200-\u137F\u1380-\u139F\u2D80-\u2DDF]/.test(result.extractedText)
    );
  }, [ocrResults]);

  // Get document ranking
  const documentRanking = useMemo(() => {
    if (!batchResult) return [];
    return rankDocumentsByQuality(batchResult.documents);
  }, [batchResult]);

  // Get corruption patterns
  const corruptionPatterns = useMemo(() => {
    if (!ocrResults.length) return { patterns: [], recommendations: [] };
    return identifyCorruptionPatterns(ocrResults);
  }, [ocrResults]);

  // Calculate quality statistics
  const qualityStats = useMemo(() => {
    if (!batchResult) {
      return { excellent: 0, good: 0, fair: 0, poor: 0, total: 0 };
    }

    const stats = batchResult.documents.reduce((acc, doc) => {
      if (doc.qualityScore >= 0.9) acc.excellent++;
      else if (doc.qualityScore >= 0.75) acc.good++;
      else if (doc.qualityScore >= 0.6) acc.fair++;
      else acc.poor++;
      return acc;
    }, { excellent: 0, good: 0, fair: 0, poor: 0 });

    return { ...stats, total: batchResult.documents.length };
  }, [batchResult]);

  // Calculate correction statistics
  const correctionStats = useMemo(() => {
    const total = corrections.length;
    const highConfidence = corrections.filter(c => c.confidence >= 0.8).length;
    const applied = appliedCorrections.size;
    const pending = total - applied;

    return { total, highConfidence, applied, pending };
  }, [corrections, appliedCorrections]);

  // Main processing function
  const processBatch = useCallback(async (ocrResults: OCRResult[], settings: Settings) => {
    if (ocrResults.length === 0) {
      setError('No documents to process');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProcessingProgress(0);

    try {
      // Step 1: Analyze documents (30%)
      setProcessingProgress(10);
      const result = await processBatchAmharicDocuments(ocrResults, settings);
      setBatchResult(result);
      setProcessingProgress(30);

      // Step 2: Generate corrections (50%)
      const generatedCorrections = generateBatchCorrections(ocrResults);
      setCorrections(generatedCorrections);
      setProcessingProgress(50);

      // Step 3: Apply high-confidence corrections automatically (80%)
      const autoCorrections = generatedCorrections.filter(c => c.confidence >= 0.9);
      const appliedTexts = applyBulkCorrections(ocrResults, autoCorrections);
      setCorrectedTexts(appliedTexts);
      setProcessingProgress(80);

      // Step 4: Mark auto-applied corrections (100%)
      const autoAppliedIds = new Set(
        autoCorrections.map(c => `${c.documentId}-${c.position.start}-${c.position.end}`)
      );
      setAppliedCorrections(autoAppliedIds);
      setProcessingProgress(100);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed');
      console.error('Batch processing error:', err);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Apply individual correction
  const applyCorrection = useCallback((correction: CorrectionSuggestion) => {
    const correctionId = `${correction.documentId}-${correction.position.start}-${correction.position.end}`;
    
    if (appliedCorrections.has(correctionId)) {
      return; // Already applied
    }

    // Get current text (either corrected version or original)
    const currentText = correctedTexts[correction.documentId] || 
      ocrResults.find(r => r.id === correction.documentId)?.extractedText || '';
    
    // Apply the correction
    const updatedText = currentText.replace(correction.original, correction.corrected);
    
    setCorrectedTexts(prev => ({
      ...prev,
      [correction.documentId]: updatedText
    }));

    // Mark as applied
    setAppliedCorrections(prev => new Set([...prev, correctionId]));
  }, [correctedTexts, ocrResults, appliedCorrections]);

  // Apply multiple corrections
  const applyBulkCorrectionsHandler = useCallback((correctionsToApply: CorrectionSuggestion[]) => {
    correctionsToApply.forEach(correction => {
      applyCorrection(correction);
    });
  }, [applyCorrection]);

  // Reject correction
  const rejectCorrection = useCallback((correction: CorrectionSuggestion) => {
    const correctionId = `${correction.documentId}-${correction.position.start}-${correction.position.end}`;
    
    // Remove from corrections list
    setCorrections(prev => prev.filter(c => {
      const id = `${c.documentId}-${c.position.start}-${c.position.end}`;
      return id !== correctionId;
    }));

    // Remove from applied if it was applied
    setAppliedCorrections(prev => {
      const newSet = new Set(prev);
      newSet.delete(correctionId);
      return newSet;
    });
  }, []);

  // Reset all processing state
  const resetProcessing = useCallback(() => {
    setBatchResult(null);
    setCorrections([]);
    setCorrectedTexts({});
    setIsProcessing(false);
    setError(null);
    setProcessingProgress(0);
    setAppliedCorrections(new Set());
  }, []);

  return {
    // State
    batchResult,
    corrections: corrections.filter(c => {
      const id = `${c.documentId}-${c.position.start}-${c.position.end}`;
      return !appliedCorrections.has(id);
    }), // Filter out applied corrections
    correctedTexts,
    isProcessing,
    error,
    processingProgress,
    
    // Actions
    processBatch,
    applyCorrection,
    applyBulkCorrections: applyBulkCorrectionsHandler,
    rejectCorrection,
    resetProcessing,
    
    // Computed values
    hasAmharicContent,
    documentRanking,
    corruptionPatterns,
    qualityStats,
    correctionStats
  };
};