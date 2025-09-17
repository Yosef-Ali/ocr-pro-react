import React from 'react';
import { Play, Loader, Zap, Brain, Cpu } from 'lucide-react';
import { motion } from 'framer-motion';
import { useOCRStore } from '@/store/ocrStore';
import { useOCRProcessing } from '@/hooks/useOCRProcessing';
import { checkAvailableApiKeys } from '@/utils/validationUtils';

export const ProcessButton: React.FC = () => {
  const { files, isProcessing, settings } = useOCRStore();
  const { processFiles } = useOCRProcessing();

  const handleClick = () => {
    if (files.length > 0 && !isProcessing) {
      processFiles();
    }
  };

  const formatGeminiModel = (model?: string) => {
    if (!model) return 'Gemini 2.5 Pro';
    if (!model.startsWith('gemini')) return model;
    const parts = model.split('-').slice(1); // drop leading "gemini"
    const formatted = parts
      .map((part) => part.replace(/^([a-z])/i, (match) => match.toUpperCase()))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    return `Gemini ${formatted}`.replace('Pro Vision', 'Pro Vision');
  };

  const describeGeminiStack = () => {
    const primary = formatGeminiModel(settings.model);
    const fallback = settings.fallbackModel && settings.fallbackModel !== settings.model
      ? formatGeminiModel(settings.fallbackModel)
      : null;
    return fallback ? `${primary} → ${fallback}` : primary;
  };

  // Determine which engine will be used
  const getEngineInfo = () => {
    const engine = settings.ocrEngine || 'auto';
    const apiStatus = checkAvailableApiKeys(settings);

    if (engine === 'tesseract') {
      return { name: 'Tesseract', icon: Cpu, color: 'from-green-600 to-teal-600' };
    } else if (engine === 'gemini') {
      return { name: describeGeminiStack(), icon: Brain, color: 'from-blue-600 to-purple-600' };
    } else {
      // Auto mode - show what will actually be used
      if (apiStatus.hasGemini) {
        return { name: `Auto (${describeGeminiStack()})`, icon: Zap, color: 'from-blue-600 to-purple-600' };
      } else if (apiStatus.hasOpenRouter) {
        return { name: 'Auto (OpenRouter)', icon: Zap, color: 'from-blue-500 to-cyan-600' };
      } else {
        return { name: 'Auto (Tesseract)', icon: Zap, color: 'from-green-600 to-teal-600' };
      }
    }
  };

  const engineInfo = getEngineInfo();
  const EngineIcon = engineInfo.icon;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-center text-xs text-gray-500" aria-live="polite">
        <EngineIcon className="w-3 h-3 mr-1" aria-hidden="true" />
        Using {engineInfo.name}
      </div>
      <motion.button
        whileHover={{ scale: files.length > 0 ? 1.02 : 1 }}
        whileTap={{ scale: files.length > 0 ? 0.98 : 1 }}
        onClick={handleClick}
        disabled={files.length === 0 || isProcessing}
        aria-label={isProcessing ? `Processing ${files.length} files with ${engineInfo.name}` : `Start OCR processing of ${files.length} files with ${engineInfo.name}`}
        aria-describedby="process-status"
        className={`
          w-full py-3 px-4 rounded-lg font-medium
          transition-all duration-300 flex items-center justify-center
          focus:outline-none focus:ring-2 focus:ring-offset-2
          ${files.length === 0 || isProcessing
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed focus:ring-gray-400'
            : `bg-gradient-to-r ${engineInfo.color} text-white hover:opacity-90 focus:ring-blue-500`
          }
        `}
      >
        {isProcessing ? (
          <>
            <Loader className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
            Processing with {engineInfo.name}...
          </>
        ) : (
          <>
            Start OCR Processing
            <Play className="w-4 h-4 ml-2" aria-hidden="true" />
          </>
        )}
      </motion.button>
      <div id="process-status" className="sr-only">
        {files.length === 0 ? 'No files uploaded' : `${files.length} file${files.length > 1 ? 's' : ''} ready for processing`}
      </div>
    </div>
  );
};
