import React from 'react';
import { OCRResult } from '@/types';

interface Props {
  result: OCRResult;
}

export const ExtractedTextTab: React.FC<Props> = ({ result }) => {
  return (
    <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
      <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
        {result.extractedText}
      </pre>
    </div>
  );
};
