import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Translation resources
const resources = {
  en: {
    translation: {
      // Navigation
      'nav.settings': 'Settings',
      'nav.help': 'Help',

      // Upload section
      'upload.title': 'Upload Document',
      'upload.dragDrop': 'Drag & drop files here',
      'upload.dropHere': 'Drop files here',
      'upload.browse': 'browse files',
      'upload.instructions': 'Supports: PDF, JPG, PNG, GIF, WEBP, TIFF (Max 10MB)',
      'upload.uploading': 'Uploading...',
      'upload.uploadedFiles': 'Uploaded Files',
      'upload.removeFile': 'Remove file',

      // Settings
      'settings.title': 'Settings',
      'settings.save': 'Save Settings',
      'settings.cancel': 'Cancel',
      'settings.apiKey': 'Gemini API Key',
      'settings.apiKeyPlaceholder': 'Enter your Gemini API key',
      'settings.apiKeyHelp': 'Get your API key from',
      'settings.model': 'Model',
      'settings.maxTokens': 'Max Tokens',
      'settings.maxTokensHelp': 'Higher values allow longer outputs but cost more',

      // OCR Engine
      'settings.ocrEngine': 'Engine',
      'settings.ocrEngineAuto': 'Auto (Gemini with Tesseract fallback)',
      'settings.ocrEngineTesseract': 'Tesseract Only (Local, Free)',
      'settings.ocrEngineGemini': 'Gemini Only (Requires API Key)',
      'settings.ocrEngineHelp': 'Choose which OCR engine to use. Tesseract works offline and is great for Amharic text.',

      // Model Behavior
      'settings.modelBehavior': 'Model Behavior',
      'settings.lowTemperature': 'Low temperature (reduce hallucinations)',
      'settings.forceAmharic': 'Force Amharic (አማርኛ)',
      'settings.strictAmharic': 'Strict Amharic mode (ASCII blacklist)',
      'settings.modelBehaviorHelp': 'Low temperature uses deterministic decoding; Force Amharic enforces Ethiopic script; Strict Amharic mode blacklists ASCII letters during OCR to reduce spurious English words.',

      // PDF Export
      'settings.pdfExport': 'PDF Export',
      'settings.includeToc': 'Include TOC',
      'settings.includeFooter': 'Include page footer',
      'settings.tocPosition': 'TOC position',
      'settings.tocStart': 'Start (before content)',
      'settings.tocEnd': 'End (after content)',
      'settings.includeCover': 'Include cover page',
      'settings.pdfHelp': 'Controls TOC placement, cover page, and page numbers for generated PDFs.',

      // OpenRouter
      'settings.openRouter': 'OpenRouter (Optional)',
      'settings.openRouterHelp': 'Provide OpenRouter API key and model to use as a fallback (or preferred) provider for proofreading when Gemini is rate-limited or unavailable.',
      'settings.openRouterApiKey': 'OpenRouter API Key',
      'settings.openRouterApiKeyPlaceholder': 'Enter your OpenRouter API key',
      'settings.openRouterModel': 'OpenRouter Model',
      'settings.openRouterModelPlaceholder': 'e.g., google/gemini-1.5-flash, openai/gpt-4o-mini',
      'settings.fallbackToOpenRouter': 'Use as fallback when Gemini fails/429',
      'settings.preferOpenRouterProofreading': 'Prefer OpenRouter for proofreading',

      // Processing
      'processing.preparing': 'Preparing...',
      'processing.processing': 'Processing...',
      'processing.completed': 'Completed',
      'processing.failed': 'Failed',

      // Results
      'results.tabs.extracted': 'Extracted Text',
      'results.tabs.layout': 'Layout Preserved',
      'results.tabs.analysis': 'Analysis',
      'results.tabs.compare': 'Compare',

      // Export
      'export.txt': 'Export as TXT',
      'export.docx': 'Export as DOCX',
      'export.pdf': 'Export as PDF',
      'export.json': 'Export as JSON',
      'export.copy': 'Copy to Clipboard',

      // Errors
      'error.apiKeyMissing': 'Please set your Gemini API key in Settings. Get one from https://makersuite.google.com/app/apikey',
      'error.apiKeyInvalid': 'Invalid Gemini API key format. Please check your API key.',
      'error.fileTooLarge': 'File size exceeds 10MB limit',
      'error.unsupportedFile': 'Unsupported file type. Only images and PDFs are allowed.',
      'error.fileExtensionMismatch': 'File extension does not match file type',

      // Success messages
      'success.settingsSaved': 'Settings saved successfully',
      'success.filesUploaded': 'Uploaded {{count}} file(s) successfully',
      'success.exported': 'File exported successfully',

      // Languages
      'lang.auto': 'Auto-detect',
      'lang.en': 'English',
      'lang.am': 'አማርኛ (Amharic)',

      // Help
      'help.title': 'Help & Documentation',
      'help.gettingStarted': 'Getting Started',
      'help.apiSetup': 'API Setup',
      'help.features': 'Features',
      'help.troubleshooting': 'Troubleshooting',
    }
  },
  am: {
    translation: {
      // Navigation
      'nav.settings': 'ቅንብሮች',
      'nav.help': 'እርዳታ',

      // Upload section
      'upload.title': 'ሰነድ ስቀል',
      'upload.dragDrop': 'ፋይሎችን እዚህ ጎትት ወይም ያስቀሉ',
      'upload.dropHere': 'ፋይሎችን እዚህ ያስቀሉ',
      'upload.browse': 'ፋይሎችን መርምር',
      'upload.instructions': 'የሚያገኙት፡ PDF, JPG, PNG, GIF, WEBP, TIFF (ከፍተኛ መጠን 10MB)',
      'upload.uploading': 'በመስቀል ላይ...',
      'upload.uploadedFiles': 'የተሰቀሉ ፋይሎች',
      'upload.removeFile': 'ፋይል አስወግድ',

      // Settings
      'settings.title': 'ቅንብሮች',
      'settings.save': 'ቅንብሮችን አስቀምጥ',
      'settings.cancel': 'ያቁም',
      'settings.apiKey': 'የ Gemini API ቁልፍ',
      'settings.apiKeyPlaceholder': 'የ Gemini API ቁልፍ አስገባ',
      'settings.apiKeyHelp': 'የ API ቁልፍ ከእነሆ ያግኙ',
      'settings.model': 'ሞዴል',
      'settings.maxTokens': 'ከፍተኛ ቶከንስ',
      'settings.maxTokensHelp': 'ከፍተኛ እሴቶች ለረጅ ውጤቶች ያስችላሉ ነገር ግን ያበለጽጋሉ',

      // OCR Engine
      'settings.ocrEngine': 'መሣሪያ',
      'settings.ocrEngineAuto': 'ራሱ በራሱ (Gemini ከ Tesseract ጋር)',
      'settings.ocrEngineTesseract': 'Tesseract ብቻ (ከኢንተርኔት ያለ ፣ ነጻ)',
      'settings.ocrEngineGemini': 'Gemini ብቻ (API ቁልፍ ያስፈልጋል)',
      'settings.ocrEngineHelp': 'የ OCR መሣሪያ ይምረጡ። Tesseract ከኢንተርኔት ያለ ለአማርኛ ጽሁፍ ጥሩ ነው።',

      // Model Behavior
      'settings.modelBehavior': 'የሞዴል ባህሪ',
      'settings.lowTemperature': 'ዝቅተኛ ሙቀት (hallucinations ያሳንሱ)',
      'settings.forceAmharic': 'አማርኛን አስገድድ (አማርኛ)',
      'settings.strictAmharic': 'አማርኛ አስገድድ ሞድ (ASCII blacklist)',
      'settings.modelBehaviorHelp': 'ዝቅተኛ ሙቀት የማወቅ መልክ ያሳጣል፣ አማርኛ አስገድድ የኢትዮጵያ ጽሁፍ ያስገድዳል፣ አማርኛ አስገድድ ሞድ በ OCR ወቅት ASCII ፊደላትን ያግዳል።',

      // PDF Export
      'settings.pdfExport': 'PDF መላክ',
      'settings.includeToc': 'TOC አካትት',
      'settings.includeFooter': 'የገጽ ዳሌ አካትት',
      'settings.tocPosition': 'TOC ቦታ',
      'settings.tocStart': 'መጀመሪያ (ከይዘት ቀድሞ)',
      'settings.tocEnd': 'መጨረሻ (ከይዘት ቀጥሎ)',
      'settings.includeCover': 'የሽፋን ገጽ አካትት',
      'settings.pdfHelp': 'ለተሰማሩ PDFዎች TOC ቦታ፣ የሽፋን ገጽ እና የገጽ ቁጥሮችን ያስተያየዳል።',

      // OpenRouter
      'settings.openRouter': 'OpenRouter (አማራጭ)',
      'settings.openRouterHelp': 'በ Gemini ላይ ችግር ሲኖር ለ proofreading እንደ fallback ወይም ምርጫ ለማገልገል OpenRouter API ቁልፍ እና ሞዴል ያቅርቡ።',
      'settings.openRouterApiKey': 'የ OpenRouter API ቁልፍ',
      'settings.openRouterApiKeyPlaceholder': 'የ OpenRouter API ቁልፍ አስገባ',
      'settings.openRouterModel': 'የ OpenRouter ሞዴል',
      'settings.openRouterModelPlaceholder': 'ለምሳሌ፣ google/gemini-1.5-flash, openai/gpt-4o-mini',
      'settings.fallbackToOpenRouter': 'በ Gemini ላይ ችግር ሲኖር fallback ተጠቀም',
      'settings.preferOpenRouterProofreading': 'ለ proofreading OpenRouter ምረጥ',

      // Processing
      'processing.preparing': 'በመስጠት ላይ...',
      'processing.processing': 'በማስተካከል ላይ...',
      'processing.completed': 'ተጠናቀቀ',
      'processing.failed': 'አልተሳካም',

      // Results
      'results.tabs.extracted': 'የተራቁ ጽሁፍ',
      'results.tabs.layout': 'አቀማመጥ የተቆጠበ',
      'results.tabs.analysis': 'ትንተና',
      'results.tabs.compare': 'ንፅፅር',

      // Export
      'export.txt': 'እንደ TXT መላክ',
      'export.docx': 'እንደ DOCX መላክ',
      'export.pdf': 'እንደ PDF መላክ',
      'export.json': 'እንደ JSON መላክ',
      'export.copy': 'ወደ Clipboard ቅዳ',

      // Errors
      'error.apiKeyMissing': 'እባክዎ በቅንብሮች ውስጥ የ Gemini API ቁልፍ ያዘጋጁ። ከ https://makersuite.google.com/app/apikey ያግኙ',
      'error.apiKeyInvalid': 'የ Gemini API ቁልፍ ቅርጸት አያገባም። እባክዎ የ API ቁልፍ ያረጋግጡ።',
      'error.fileTooLarge': 'የፋይል መጠን 10MB ከፍተኛ መጠን አልፏል',
      'error.unsupportedFile': 'ያልተደገፈ የፋይል አይነት። ምስሎች እና PDFዎች ብቻ ይተባበላሉ።',
      'error.fileExtensionMismatch': 'የፋይል ቅጥያ ከፋይል አይነት ጋር አይስማማም',

      // Success messages
      'success.settingsSaved': 'ቅንብሮች ተሳኩ ተቀምጠዋል',
      'success.filesUploaded': '{{count}} ፋይል(ዎች) ተሳኩ ተሰቀሉ',
      'success.exported': 'ፋይል ተሳኩ ተላከ',

      // Languages
      'lang.auto': 'ራሱ በራሱ አውቅ',
      'lang.en': 'English',
      'lang.am': 'አማርኛ',

      // Help
      'help.title': 'እርዳታ እና ሰነዶች',
      'help.gettingStarted': 'መጀመር',
      'help.apiSetup': 'API ማዋቀር',
      'help.features': 'ባህሪያት',
      'help.troubleshooting': 'ችግሮችን መፍታት',
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false, // Disable suspense for better UX
    },
  });

export default i18n;