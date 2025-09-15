import { useCallback } from 'react';
import { useOCRStore } from '@/store/ocrStore';
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

      // Choose OCR engine based on settings
      const ocrEngine = settings.ocrEngine || 'auto';
      
      if (ocrEngine === 'tesseract') {
        // Force Tesseract only
        const { processWithTesseract } = await import('@/services/ocr/tesseractService');
        results = await processWithTesseract(files, settings);
      } else if (ocrEngine === 'gemini') {
        // Force Gemini only (requires API key)
        if (!settings.apiKey) {
          throw new Error('Gemini API key is required when Gemini engine is selected');
        }
        const { processWithGemini } = await import('@/services/geminiService');
        results = await processWithGemini(files, settings);
      } else {
        // Auto mode: Use Gemini if API key exists, otherwise Tesseract
        if (settings.apiKey) {
          try {
            const { processWithGemini } = await import('@/services/geminiService');
            results = await processWithGemini(files, settings);
          } catch (e) {
            console.error('Gemini failed; falling back to Tesseract', e);
            const { processWithTesseract } = await import('@/services/ocr/tesseractService');
            results = await processWithTesseract(files, settings);
          }
        } else {
          const { processWithTesseract } = await import('@/services/ocr/tesseractService');
          results = await processWithTesseract(files, settings);
        }
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
