import React from 'react';
import { Play, Loader } from 'lucide-react';
import { motion } from 'framer-motion';
import { useOCRStore } from '@/store/ocrStore';
import { useOCRProcessing } from '@/hooks/useOCRProcessing';

export const ProcessButton: React.FC = () => {
  const { files, isProcessing } = useOCRStore();
  const { processFiles } = useOCRProcessing();

  const handleClick = () => {
    if (files.length > 0 && !isProcessing) {
      processFiles();
    }
  };

  return (
    <motion.button
      whileHover={{ scale: files.length > 0 ? 1.02 : 1 }}
      whileTap={{ scale: files.length > 0 ? 0.98 : 1 }}
      onClick={handleClick}
      disabled={files.length === 0 || isProcessing}
      className={`
        w-full mt-6 py-3 px-4 rounded-lg font-medium
        transition-all duration-300 flex items-center justify-center
        ${files.length === 0 || isProcessing
          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
          : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700'
        }
      `}
    >
      {isProcessing ? (
        <>
          <Loader className="w-4 h-4 mr-2 animate-spin" />
          Processing...
        </>
      ) : (
        <>
          Start OCR Processing
          <Play className="w-4 h-4 ml-2" />
        </>
      )}
    </motion.button>
  );
};
