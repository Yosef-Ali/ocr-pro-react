import { useCallback } from 'react';
import { useOCRStore } from '@/store/ocrStore';
import { checkAvailableApiKeys } from '@/utils/validationUtils';
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

      let results: any[] = [];

      // Check available API keys
      const apiStatus = checkAvailableApiKeys(settings);
      const ocrEngine = settings.ocrEngine || 'auto';

      if (ocrEngine === 'tesseract') {
        // Force Tesseract only
        const { processWithTesseract } = await import('@/services/ocr/tesseractService');
        results = await processWithTesseract(files, settings);
      } else if (ocrEngine === 'gemini') {
        // Force Gemini only (requires Gemini API key specifically)
        if (!apiStatus.hasGemini) {
          toast('Gemini key missing. Using Tesseract instead.', { icon: '⚠️' });
          const { processWithTesseract } = await import('@/services/ocr/tesseractService');
          results = await processWithTesseract(files, settings);
        } else {
          const { processWithGemini } = await import('@/services/geminiService');
          results = await processWithGemini(files, settings);
        }
      } else {
        // Auto mode: Use any available API (Gemini or OpenRouter), otherwise Tesseract
        if (apiStatus.hasAnyApiKey) {
          try {
            if (apiStatus.hasGemini) {
              console.log('Using Gemini API for OCR processing');
              const { processWithGemini } = await import('@/services/geminiService');
              results = await processWithGemini(files, settings);
            } else if (apiStatus.hasOpenRouter) {
              console.log('Using OpenRouter API for OCR processing');
              // For now, use Gemini service with OpenRouter fallback built-in
              const { processWithGemini } = await import('@/services/geminiService');
              results = await processWithGemini(files, settings);
            } else {
              // This shouldn't happen since we checked hasAnyApiKey, but just in case
              throw new Error('No valid API key available');
            }
          } catch (e) {
            console.error('AI API failed; falling back to Tesseract', e);
            toast.error(`${apiStatus.primaryProvider === 'gemini' ? 'Gemini' : 'OpenRouter'} API failed. Falling back to Tesseract OCR...`);
            const { processWithTesseract } = await import('@/services/ocr/tesseractService');
            results = await processWithTesseract(files, settings);
          }
        } else {
          // No API key - use Tesseract
          console.log('No API keys found. Using Tesseract OCR.');
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
