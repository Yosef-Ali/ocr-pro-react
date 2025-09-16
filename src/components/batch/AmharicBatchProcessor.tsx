import React, { useState, useMemo } from 'react';
import {
  Upload,
  Play,
  FileText,
  BarChart3,
  Wand2,
  Download,
  CheckCircle,
  AlertTriangle,
  Clock,
  RefreshCw
} from 'lucide-react';
import { OCRResult, Settings } from '@/types';
import {
  processBatchAmharicDocuments,
  generateBatchCorrections,
  applyBulkCorrections,
  BatchProcessingResult,
  CorrectionSuggestion
} from '@/services/amharicBatchProcessor';
import { exportBatchResults, exportCorrections, ExportOptions } from '@/services/batchExportService';
import { BatchProcessingDashboard } from './BatchProcessingDashboard';
import { BulkCorrectionPanel } from './BulkCorrectionPanel';
import { DocumentComparisonView } from './DocumentComparisonView';

interface Props {
  ocrResults: OCRResult[];
  settings: Settings;
  onUpdateResults?: (results: OCRResult[]) => void;
}

type ActiveTab = 'dashboard' | 'corrections' | 'comparison' | 'export';
type ProcessingState = 'idle' | 'analyzing' | 'generating-corrections' | 'complete';

export const AmharicBatchProcessor: React.FC<Props> = ({
  ocrResults,
  settings,
  onUpdateResults: _onUpdateResults
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [processingState, setProcessingState] = useState<ProcessingState>('idle');
  const [batchResult, setBatchResult] = useState<BatchProcessingResult | null>(null);
  const [corrections, setCorrections] = useState<CorrectionSuggestion[]>([]);
  const [correctedTexts, setCorrectedTexts] = useState<{ [documentId: string]: string }>({});
  const [processingProgress, setProcessingProgress] = useState(0);

  // Check if we have processable documents
  const hasAmharicDocuments = useMemo(() => {
    return ocrResults.some(result =>
      /[\u1200-\u137F\u1380-\u139F\u2D80-\u2DDF]/.test(result.extractedText)
    );
  }, [ocrResults]);

  const canProcess = ocrResults.length > 0;
  const isProcessed = batchResult !== null;

  // Start batch processing
  const handleStartProcessing = async () => {
    if (!canProcess) return;

    setProcessingState('analyzing');
    setProcessingProgress(0);

    try {
      // Step 1: Analyze documents
      setProcessingProgress(30);
      const result = await processBatchAmharicDocuments(ocrResults, settings);
      setBatchResult(result);

      // Step 2: Generate corrections
      setProcessingState('generating-corrections');
      setProcessingProgress(60);
      const generatedCorrections = generateBatchCorrections(ocrResults);
      setCorrections(generatedCorrections);

      // Step 3: Apply automatic high-confidence corrections
      setProcessingProgress(80);
      const appliedCorrections = applyBulkCorrections(ocrResults, generatedCorrections);
      setCorrectedTexts(appliedCorrections);

      setProcessingProgress(100);
      setProcessingState('complete');
    } catch (error) {
      console.error('Batch processing failed:', error);
      setProcessingState('idle');
      setProcessingProgress(0);
    }
  };

  // Reset processing
  const handleReset = () => {
    setBatchResult(null);
    setCorrections([]);
    setCorrectedTexts({});
    setProcessingState('idle');
    setProcessingProgress(0);
    setActiveTab('dashboard');
  };

  // Apply individual correction
  const handleApplyCorrection = (correction: CorrectionSuggestion) => {
    const currentText = correctedTexts[correction.documentId] ||
      ocrResults.find(r => r.id === correction.documentId)?.extractedText || '';

    const updatedText = currentText.replace(correction.original, correction.corrected);
    setCorrectedTexts(prev => ({
      ...prev,
      [correction.documentId]: updatedText
    }));

    // Remove applied correction from list
    setCorrections(prev => prev.filter(c =>
      !(c.documentId === correction.documentId &&
        c.original === correction.original &&
        c.position.start === correction.position.start)
    ));
  };

  // Apply bulk corrections
  const handleApplyBulkCorrections = (correctionsToApply: CorrectionSuggestion[]) => {
    correctionsToApply.forEach(correction => {
      handleApplyCorrection(correction);
    });
  };

  // Reject correction
  const handleRejectCorrection = (correction: CorrectionSuggestion) => {
    setCorrections(prev => prev.filter(c =>
      !(c.documentId === correction.documentId &&
        c.original === correction.original &&
        c.position.start === correction.position.start)
    ));
  };

  // Export results
  const handleExportResults = async (format: 'json' | 'csv' | 'summary') => {
    if (!batchResult) return;

    const options: ExportOptions = {
      includeOriginal: true,
      includeCorrected: true,
      includeMetadata: true,
      includeAnalysis: true,
      format: format as any,
      groupBy: 'document'
    };

    const exportResult = await exportBatchResults(
      batchResult,
      ocrResults,
      correctedTexts,
      options
    );

    if (exportResult.success && exportResult.downloadUrl) {
      const link = document.createElement('a');
      link.href = exportResult.downloadUrl;
      link.download = exportResult.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(exportResult.downloadUrl);
    }
  };

  // Export corrections
  const handleExportCorrections = async () => {
    const exportResult = await exportCorrections(corrections, 'csv');

    if (exportResult.success && exportResult.downloadUrl) {
      const link = document.createElement('a');
      link.href = exportResult.downloadUrl;
      link.download = exportResult.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(exportResult.downloadUrl);
    }
  };

  const getTabIcon = (tab: ActiveTab) => {
    switch (tab) {
      case 'dashboard': return <BarChart3 className="w-4 h-4" />;
      case 'corrections': return <Wand2 className="w-4 h-4" />;
      case 'comparison': return <FileText className="w-4 h-4" />;
      case 'export': return <Download className="w-4 h-4" />;
    }
  };

  const getProcessingStateInfo = () => {
    switch (processingState) {
      case 'analyzing':
        return { icon: <Clock className="w-5 h-5 text-blue-600" />, text: 'Analyzing document quality...', color: 'text-blue-600' };
      case 'generating-corrections':
        return { icon: <Wand2 className="w-5 h-5 text-purple-600" />, text: 'Generating corrections...', color: 'text-purple-600' };
      case 'complete':
        return { icon: <CheckCircle className="w-5 h-5 text-green-600" />, text: 'Processing complete!', color: 'text-green-600' };
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Amharic Batch Document Processor</h1>
            <p className="text-gray-600 mt-1">
              Process multiple Amharic documents, detect OCR errors, and apply bulk corrections
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {isProcessed && (
              <button
                onClick={handleReset}
                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reset</span>
              </button>
            )}

            {!isProcessed && canProcess && (
              <button
                onClick={handleStartProcessing}
                disabled={processingState !== 'idle'}
                className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4" />
                <span>Start Processing</span>
              </button>
            )}
          </div>
        </div>

        {/* Processing Status */}
        {processingState !== 'idle' && (
          <div className="mb-4">
            <div className="flex items-center space-x-2 mb-2">
              {getProcessingStateInfo()?.icon}
              <span className={`font-medium ${getProcessingStateInfo()?.color}`}>
                {getProcessingStateInfo()?.text}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${processingProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Document Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <FileText className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Total Documents</p>
              <p className="text-lg font-semibold text-gray-900">{ocrResults.length}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Amharic Content</p>
              <p className="text-lg font-semibold text-gray-900">
                {hasAmharicDocuments ? 'Detected' : 'None'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <Wand2 className="w-8 h-8 text-purple-600" />
            <div>
              <p className="text-sm text-gray-600">Corrections</p>
              <p className="text-lg font-semibold text-gray-900">{corrections.length}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <BarChart3 className="w-8 h-8 text-orange-600" />
            <div>
              <p className="text-sm text-gray-600">Avg Quality</p>
              <p className="text-lg font-semibold text-gray-900">
                {batchResult ? `${(batchResult.summary.averageQuality * 100).toFixed(1)}%` : '-'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Warning for no documents */}
      {!canProcess && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <Upload className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-yellow-800 mb-2">No Documents to Process</h3>
          <p className="text-yellow-700">
            Upload and process some documents first to use the batch processing features.
          </p>
        </div>
      )}

      {/* Warning for no Amharic content */}
      {canProcess && !hasAmharicDocuments && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-orange-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-orange-800 mb-2">No Amharic Content Detected</h3>
          <p className="text-orange-700">
            The batch processor is optimized for Amharic documents. Your documents may not contain Amharic text.
          </p>
        </div>
      )}

      {/* Main Content - Only show if processed */}
      {isProcessed && batchResult && (
        <>
          {/* Tabs */}
          <div className="bg-white border-b border-gray-200 rounded-t-lg">
            <nav className="flex space-x-8 px-6">
              {([
                { key: 'dashboard', label: 'Overview' },
                { key: 'corrections', label: 'Corrections', badge: corrections.length },
                { key: 'comparison', label: 'Compare Documents' },
                { key: 'export', label: 'Export' }
              ] as Array<{ key: ActiveTab; label: string; badge?: number }>).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${activeTab === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  {getTabIcon(tab.key)}
                  <span>{tab.label}</span>
                  {'badge' in tab && tab.badge !== undefined && tab.badge > 0 && (
                    <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-b-lg">
            {activeTab === 'dashboard' && (
              <BatchProcessingDashboard
                batchResult={batchResult}
                corrections={corrections}
                onApplyCorrections={handleApplyBulkCorrections}
                onExportResults={handleExportResults}
              />
            )}

            {activeTab === 'corrections' && (
              <div className="p-6">
                <BulkCorrectionPanel
                  corrections={corrections}
                  onApplyCorrection={handleApplyCorrection}
                  onApplyBulkCorrections={handleApplyBulkCorrections}
                  onRejectCorrection={handleRejectCorrection}
                />
              </div>
            )}

            {activeTab === 'comparison' && (
              <div className="p-6">
                <DocumentComparisonView
                  documents={batchResult.documents}
                />
              </div>
            )}

            {activeTab === 'export' && (
              <div className="p-6">
                <div className="max-w-2xl mx-auto space-y-6">
                  <div className="text-center">
                    <Download className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Export Processed Documents</h3>
                    <p className="text-gray-600">
                      Download your processed Amharic documents in various formats
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={() => handleExportResults('csv')}
                      className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                    >
                      <div className="text-center">
                        <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <h4 className="font-medium text-gray-900">CSV Report</h4>
                        <p className="text-sm text-gray-600">Document metrics and analysis</p>
                      </div>
                    </button>

                    <button
                      onClick={() => handleExportResults('json')}
                      className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                    >
                      <div className="text-center">
                        <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <h4 className="font-medium text-gray-900">JSON Export</h4>
                        <p className="text-sm text-gray-600">Complete data with corrections</p>
                      </div>
                    </button>

                    <button
                      onClick={handleExportCorrections}
                      className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors"
                    >
                      <div className="text-center">
                        <Wand2 className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <h4 className="font-medium text-gray-900">Corrections Only</h4>
                        <p className="text-sm text-gray-600">CSV of all suggested fixes</p>
                      </div>
                    </button>

                    <button
                      onClick={() => handleExportResults('summary')}
                      className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors"
                    >
                      <div className="text-center">
                        <BarChart3 className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <h4 className="font-medium text-gray-900">Summary Report</h4>
                        <p className="text-sm text-gray-600">Text overview with recommendations</p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};