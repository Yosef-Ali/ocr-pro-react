import React from 'react';
import { OCRResult } from '@/types';
import { Globe, TrendingUp, FileText, Clock, LayoutGrid } from 'lucide-react';

interface Props {
  result: OCRResult;
}

export const AnalysisTab: React.FC<Props> = ({ result }) => {
  const stats = [
    {
      icon: Globe,
      label: 'Language Detection',
      value: result.detectedLanguage,
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
    },
    {
      icon: TrendingUp,
      label: 'Confidence Score',
      value: `${(result.confidence * 100).toFixed(1)}%`,
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
    },
    {
      icon: FileText,
      label: 'Document Type',
      value: result.documentType,
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700',
    },
    {
      icon: Clock,
      label: 'Processing Time',
      value: `${result.processingTime.toFixed(1)}s`,
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-700',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stats.map(({ icon: Icon, label, value, bgColor, textColor }) => (
          <div key={label} className={`${bgColor} rounded-lg p-4`}>
            <div className="flex items-start space-x-3">
              <Icon className={`w-5 h-5 ${textColor} mt-0.5`} />
              <div>
                <h4 className={`font-semibold ${textColor.replace('text-', 'text-')}800 mb-1`}>
                  {label}
                </h4>
                <p className={textColor}>{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-3">
          <LayoutGrid className="w-5 h-5 text-gray-700" />
          <h4 className="font-semibold text-gray-800">Layout Analysis</h4>
        </div>

        <div className="text-gray-700 text-sm space-y-2">
          <p>• Text blocks detected: {result.layoutAnalysis.textBlocks}</p>
          <p>• Tables found: {result.layoutAnalysis.tables}</p>
          <p>• Images detected: {result.layoutAnalysis.images}</p>
          <p>• Column layout: {result.layoutAnalysis.columns} column(s)</p>
          <p>• Layout complexity: <span className="capitalize font-medium">{result.layoutAnalysis.complexity}</span></p>
        </div>

        {result.metadata && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h5 className="font-medium text-gray-700 mb-2">Document Statistics</h5>
            <div className="grid grid-cols-3 gap-4 text-sm">
              {result.metadata.wordCount && (
                <div>
                  <p className="text-gray-500">Words</p>
                  <p className="font-medium">{result.metadata.wordCount.toLocaleString()}</p>
                </div>
              )}
              {result.metadata.characterCount && (
                <div>
                  <p className="text-gray-500">Characters</p>
                  <p className="font-medium">{result.metadata.characterCount.toLocaleString()}</p>
                </div>
              )}
              {result.metadata.pageCount && (
                <div>
                  <p className="text-gray-500">Pages</p>
                  <p className="font-medium">{result.metadata.pageCount}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
