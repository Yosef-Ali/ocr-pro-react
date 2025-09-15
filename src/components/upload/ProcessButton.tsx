import React from 'react';
import { Play, Loader, Zap, Brain, Cpu } from 'lucide-react';
import { motion } from 'framer-motion';
import { useOCRStore } from '@/store/ocrStore';
import { useOCRProcessing } from '@/hooks/useOCRProcessing';

export const ProcessButton: React.FC = () => {
  const { files, isProcessing, settings } = useOCRStore();
  const { processFiles } = useOCRProcessing();

  const handleClick = () => {
    if (files.length > 0 && !isProcessing) {
      processFiles();
    }
  };

  // Determine which engine will be used
  const getEngineInfo = () => {
    const engine = settings.ocrEngine || 'auto';
    if (engine === 'tesseract') {
      return { name: 'Tesseract', icon: Cpu, color: 'from-green-600 to-teal-600' };
    } else if (engine === 'gemini') {
      return { name: 'Gemini', icon: Brain, color: 'from-blue-600 to-purple-600' };
    } else {
      // Auto mode
      if (settings.apiKey) {
        return { name: 'Auto (Gemini)', icon: Zap, color: 'from-blue-600 to-purple-600' };
      } else {
        return { name: 'Auto (Tesseract)', icon: Zap, color: 'from-green-600 to-teal-600' };
      }
    }
  };

  const engineInfo = getEngineInfo();
  const EngineIcon = engineInfo.icon;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-center text-xs text-gray-500">
        <EngineIcon className="w-3 h-3 mr-1" />
        Using {engineInfo.name}
      </div>
      <motion.button
        whileHover={{ scale: files.length > 0 ? 1.02 : 1 }}
        whileTap={{ scale: files.length > 0 ? 0.98 : 1 }}
        onClick={handleClick}
        disabled={files.length === 0 || isProcessing}
        className={`
          w-full py-3 px-4 rounded-lg font-medium
          transition-all duration-300 flex items-center justify-center
          ${files.length === 0 || isProcessing
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : `bg-gradient-to-r ${engineInfo.color} text-white hover:opacity-90`
          }
        `}
      >
        {isProcessing ? (
          <>
            <Loader className="w-4 h-4 mr-2 animate-spin" />
            Processing with {engineInfo.name}...
          </>
        ) : (
          <>
            Start OCR Processing
            <Play className="w-4 h-4 ml-2" />
          </>
        )}
      </motion.button>
    </div>
  );
};
