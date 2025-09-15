/**
 * Base tab component providing common functionality for all result tabs
 */
import React, { ReactNode } from 'react';
import { OCRResult } from '@/types';
import { containsEthiopic } from '@/utils/textUtils';
import { CONFIDENCE_THRESHOLDS, LANGUAGE_CODES } from '@/utils/constants';

interface BaseTabProps {
  result: OCRResult;
  children: ReactNode;
  className?: string;
  showMetadata?: boolean;
  showConfidenceWarning?: boolean;
}

export const BaseTab: React.FC<BaseTabProps> = ({ 
  result, 
  children, 
  className = '',
  showMetadata = false,
  showConfidenceWarning = true
}) => {
  const isEthiopic = result.detectedLanguage === LANGUAGE_CODES.AMHARIC || containsEthiopic(result.extractedText);
  const isLowConfidence = result.confidence < CONFIDENCE_THRESHOLDS.LOW;
  const isVeryLowConfidence = result.confidence < CONFIDENCE_THRESHOLDS.VERY_LOW;

  return (
    <div className={`bg-gray-50 rounded-lg ${className}`}>
      {/* Confidence Warning */}
      {showConfidenceWarning && isLowConfidence && (
        <div className={`mb-4 p-3 rounded-lg border-l-4 ${
          isVeryLowConfidence 
            ? 'bg-red-50 border-red-400 text-red-800' 
            : 'bg-yellow-50 border-yellow-400 text-yellow-800'
        }`}>
          <div className="flex items-center">
            <span className="font-medium">
              {isVeryLowConfidence ? '⚠️ Very Low Confidence' : '⚠️ Low Confidence'}
            </span>
            <span className="ml-2 text-sm">
              ({Math.round(result.confidence * 100)}%)
            </span>
          </div>
          <p className="text-sm mt-1">
            {isEthiopic 
              ? 'This Amharic text may contain OCR errors. Consider using proofreading features.'
              : 'This text may contain OCR errors. Please review carefully.'
            }
          </p>
        </div>
      )}

      {/* Language Indicator */}
      {isEthiopic && (
        <div className="mb-3 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          🇪🇹 Amharic Text Detected
        </div>
      )}

      {/* Main Content */}
      <div className="p-4">
        {children}
      </div>

      {/* Metadata Footer */}
      {showMetadata && (
        <div className="border-t border-gray-200 px-4 py-3 bg-gray-100 rounded-b-lg">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-600">
            <div>
              <span className="font-medium">Engine:</span> {result.metadata?.engine || 'Unknown'}
            </div>
            <div>
              <span className="font-medium">Confidence:</span> {Math.round(result.confidence * 100)}%
            </div>
            <div>
              <span className="font-medium">Words:</span> {result.metadata?.wordCount || 0}
            </div>
            <div>
              <span className="font-medium">Characters:</span> {result.metadata?.characterCount || 0}
            </div>
          </div>
          {result.layoutAnalysis && (
            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-600">
              <div>
                <span className="font-medium">Text Blocks:</span> {result.layoutAnalysis.textBlocks}
              </div>
              <div>
                <span className="font-medium">Tables:</span> {result.layoutAnalysis.tables}
              </div>
              <div>
                <span className="font-medium">Images:</span> {result.layoutAnalysis.images}
              </div>
              <div>
                <span className="font-medium">Complexity:</span> {result.layoutAnalysis.complexity}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Text container with common styling for text display
 */
interface TextContainerProps {
  children: ReactNode;
  maxHeight?: string;
  className?: string;
}

export const TextContainer: React.FC<TextContainerProps> = ({ 
  children, 
  maxHeight = 'max-h-96',
  className = ''
}) => {
  return (
    <div className={`${maxHeight} overflow-y-auto ${className}`}>
      <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono leading-relaxed">
        {children}
      </pre>
    </div>
  );
};

/**
 * Loading state component for tabs
 */
interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ 
  message = 'Processing...' 
}) => {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="flex items-center space-x-2 text-gray-600">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
        <span className="text-sm">{message}</span>
      </div>
    </div>
  );
};

/**
 * Empty state component for tabs
 */
interface EmptyStateProps {
  message?: string;
  icon?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ 
  message = 'No content available',
  icon = '📄'
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-gray-500">
      <div className="text-4xl mb-2">{icon}</div>
      <p className="text-sm">{message}</p>
    </div>
  );
};