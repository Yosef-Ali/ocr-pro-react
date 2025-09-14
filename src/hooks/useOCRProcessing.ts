import { useCallback } from 'react';
import { useOCRStore } from '@/store/ocrStore';
import { mockProcessing } from '@/services/mockService';
import toast from 'react-hot-toast';

export const useOCRProcessing = () => {
  const {
    files,
    settings,
    startProcessing,
    updateProgress,
    completeProcessing,
  } = useOCRStore();

  const processFiles = useCallback(async () => {
    if (files.length === 0) return;

    startProcessing();

    try {
      const steps = [
        { status: 'preparing' as const, delay: 500 },
        { status: 'uploading' as const, delay: 1000 },
        { status: 'analyzing' as const, delay: 1500 },
        { status: 'extracting' as const, delay: 2000 },
        { status: 'formatting' as const, delay: 1000 },
      ];

      for (const step of steps) {
        updateProgress(0, step.status);
        await new Promise(resolve => setTimeout(resolve, step.delay));
      }

      let results;

      if (settings.apiKey) {
        // Use real Gemini API (dynamically import to avoid loading SDK on initial render)
        const { processWithGemini } = await import('@/services/geminiService');
        results = await processWithGemini(files, settings);
      } else {
        // Use mock service
        results = await mockProcessing(files, settings);
      }

      completeProcessing(results);
      toast.success('OCR processing completed successfully!');

    } catch (error) {
      console.error('OCR processing error:', error);
      updateProgress(0, 'error');
      toast.error('Failed to process documents. Please try again.');
    }
  }, [files, settings, startProcessing, updateProgress, completeProcessing]);

  return { processFiles };
};
