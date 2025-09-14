import React from 'react';
import { X, Upload, Globe, Settings2, Brain, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOCRStore } from '@/store/ocrStore';

export const HelpModal: React.FC = () => {
  const { toggleHelp } = useOCRStore();

  const steps = [
    {
      icon: Upload,
      title: 'Upload Documents',
      description: 'Drag and drop images or PDF files, or click to browse. Supports JPG, PNG, PDF up to 10MB.',
    },
    {
      icon: Globe,
      title: 'Select Language',
      description: 'Choose the target language or use auto-detection. The AI will identify the document language automatically.',
    },
    {
      icon: Settings2,
      title: 'Configure Options',
      description: 'Enable layout preservation, table detection, and image enhancement for better accuracy.',
    },
    {
      icon: Brain,
      title: 'Process with AI',
      description: 'Click "Start OCR Processing" to analyze your document with Gemini AI for high accuracy.',
    },
    {
      icon: Eye,
      title: 'View Results',
      description: 'Review extracted text, layout-preserved version, and detailed analysis including confidence scores.',
    },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onClick={toggleHelp}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">How to Use OCR Pro</h3>
            <button
              onClick={toggleHelp}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            {steps.map(({ icon: Icon, title, description }, index) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex space-x-4"
              >
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Icon className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 mb-1">
                    {index + 1}. {title}
                  </h4>
                  <p className="text-sm text-gray-600">{description}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">Pro Tips</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• For best results, use high-quality images with good lighting</li>
              <li>• Enable image enhancement for low-quality scans</li>
              <li>• Use batch processing for multiple documents</li>
              <li>• Export results in various formats (TXT, JSON, PDF)</li>
            </ul>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
