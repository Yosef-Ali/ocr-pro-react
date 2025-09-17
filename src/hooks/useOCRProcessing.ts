import { useCallback } from 'react';
import { useOCRStore } from '@/store/ocrStore';
import { checkAvailableApiKeys } from '@/utils/validationUtils';
import toast from 'react-hot-toast';

const stageStatusMap = {
  preparing: 'preparing',
  uploading: 'uploading',
  analyzing: 'analyzing',
  parsing: 'extracting',
  finalizing: 'formatting',
} as const;

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
      updateProgress(5, 'preparing');
      let results: any[] = [];

      // Check available API keys
      const apiStatus = checkAvailableApiKeys(settings);
      const ocrEngine = settings.ocrEngine || 'auto';

      if (ocrEngine === 'tesseract') {
        // Force Tesseract only
        updateProgress(15, 'analyzing');
        const { processWithTesseract } = await import('@/services/ocr/tesseractService');
        results = await processWithTesseract(files, settings);
        updateProgress(90, 'extracting');
      } else if (ocrEngine === 'gemini') {
        // Force Gemini only (requires Gemini API key specifically)
        if (!apiStatus.hasGemini) {
          toast('Gemini key missing. Using Tesseract instead.', { icon: '⚠️' });
          updateProgress(15, 'analyzing');
          const { processWithTesseract } = await import('@/services/ocr/tesseractService');
          results = await processWithTesseract(files, settings);
          updateProgress(90, 'extracting');
        } else {
          const { processWithGemini } = await import('@/services/geminiService');
          results = await processWithGemini(files, settings, {
            onProgress: ({ index, total, stage, progress }) => {
              const status = stageStatusMap[stage] || 'analyzing';
              const percent = Math.min(99, Math.round(((index + progress) / total) * 100));
              updateProgress(percent, status);
            },
          });
        }
      } else {
        // Auto mode: Use any available API (Gemini or OpenRouter), otherwise Tesseract
        if (apiStatus.hasAnyApiKey) {
          try {
            if (apiStatus.hasGemini) {
              console.log('Using Gemini API for OCR processing');
              const { processWithGemini } = await import('@/services/geminiService');
              results = await processWithGemini(files, settings, {
                onProgress: ({ index, total, stage, progress }) => {
                  const status = stageStatusMap[stage] || 'analyzing';
                  const percent = Math.min(99, Math.round(((index + progress) / total) * 100));
                  updateProgress(percent, status);
                },
              });
            } else if (apiStatus.hasOpenRouter) {
              console.log('Using OpenRouter API for OCR processing');
              // For now, use Gemini service with OpenRouter fallback built-in
              const { processWithGemini } = await import('@/services/geminiService');
              results = await processWithGemini(files, settings, {
                onProgress: ({ index, total, stage, progress }) => {
                  const status = stageStatusMap[stage] || 'analyzing';
                  const percent = Math.min(99, Math.round(((index + progress) / total) * 100));
                  updateProgress(percent, status);
                },
              });
            } else {
              // This shouldn't happen since we checked hasAnyApiKey, but just in case
              throw new Error('No valid API key available');
            }
          } catch (e) {
            console.error('AI API failed; falling back to Tesseract', e);
            toast.error(`${apiStatus.primaryProvider === 'gemini' ? 'Gemini' : 'OpenRouter'} API failed. Falling back to Tesseract OCR...`);
            updateProgress(35, 'analyzing');
            const { processWithTesseract } = await import('@/services/ocr/tesseractService');
            results = await processWithTesseract(files, settings);
            updateProgress(90, 'extracting');
          }
        } else {
          // No API key - use Tesseract
          console.log('No API keys found. Using Tesseract OCR.');
          updateProgress(20, 'analyzing');
          const { processWithTesseract } = await import('@/services/ocr/tesseractService');
          results = await processWithTesseract(files, settings);
          updateProgress(90, 'extracting');
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
