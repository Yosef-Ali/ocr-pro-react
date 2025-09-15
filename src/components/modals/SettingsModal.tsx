import React, { useState } from 'react';
import { X, Key, Cpu, Hash, Zap, ChevronDown, ChevronRight, ShieldQuestion, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOCRStore } from '@/store/ocrStore';
import toast from 'react-hot-toast';
import { validateGeminiApiKey, sanitizeInput } from '@/utils/validationUtils';
import { useTranslation } from 'react-i18next';

export const SettingsModal: React.FC = () => {
  const { settings, updateSettings, toggleSettings } = useOCRStore();
  const { t, i18n } = useTranslation();
  const [localSettings, setLocalSettings] = useState(settings);

  const handleSave = () => {
    // Validate API key if provided
    if (localSettings.apiKey && localSettings.apiKey.trim()) {
      if (!validateGeminiApiKey(localSettings.apiKey.trim())) {
        toast.error(t('error.apiKeyInvalid'));
        return;
      }
    }

    // Sanitize inputs
    const sanitizedSettings = {
      ...localSettings,
      apiKey: localSettings.apiKey ? sanitizeInput(localSettings.apiKey.trim()) : '',
      openRouterApiKey: (localSettings as any).openRouterApiKey ? sanitizeInput((localSettings as any).openRouterApiKey.trim()) : '',
      openRouterModel: (localSettings as any).openRouterModel ? sanitizeInput((localSettings as any).openRouterModel.trim()) : '',
    };

    updateSettings(sanitizedSettings);
    toast.success(t('success.settingsSaved'));
    toggleSettings();
  };

  const models = [
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Fast)' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Balanced)' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Advanced)' },
    { value: 'gemini-pro-vision', label: 'Gemini Pro Vision (Legacy)' },
  ];

  const hasOpenRouterConfigured = Boolean((localSettings as any).openRouterApiKey || (localSettings as any).openRouterModel || (localSettings as any).fallbackToOpenRouter || (localSettings as any).preferOpenRouterForProofreading);
  const geminiMissing = !localSettings.apiKey;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onClick={toggleSettings}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-xl w-full max-w-lg mx-4 shadow-xl"
        >
          {/* Header */}
          <div className="flex justify-between items-center px-6 pt-6 pb-3">
            <h2 className="text-2xl font-bold text-gray-800">{t('settings.title')}</h2>
            <button
              onClick={toggleSettings}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close settings"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable body with sticky footer */}
          <div className="max-h-[70vh] overflow-y-auto">
            <div className="px-6 pb-4 space-y-3">
              <Collapsible title={<span className="inline-flex items-center gap-2"><Globe className="w-4 h-4" /> Language</span>} defaultOpen>
                <label className="block text-sm font-medium text-gray-700 mb-2">Interface Language</label>
                <select
                  value={i18n.language}
                  onChange={(e) => i18n.changeLanguage(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="en">English</option>
                  <option value="am">አማርኛ (Amharic)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Choose your preferred language for the interface.</p>
              </Collapsible>
              <Collapsible title={<span className="inline-flex items-center gap-2"><Zap className="w-4 h-4" /> OCR Engine</span>} defaultOpen>
                <label className="block text-sm font-medium text-gray-700 mb-2">Engine</label>
                <select
                  value={localSettings.ocrEngine || 'auto'}
                  onChange={(e) => setLocalSettings({ ...localSettings, ocrEngine: e.target.value as any })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="auto">Auto (Gemini with Tesseract fallback)</option>
                  <option value="tesseract">Tesseract Only (Local, Free)</option>
                  <option value="gemini">Gemini Only (Requires API Key)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Choose which OCR engine to use. Tesseract works offline and is great for Amharic text.</p>
              </Collapsible>

              <Collapsible title={<span className="inline-flex items-center gap-2"><Key className="w-4 h-4" /> Gemini</span>} defaultOpen={geminiMissing}>
                <label className="block text-sm font-medium text-gray-700 mb-2">Gemini API Key</label>
                <input
                  type="password"
                  value={localSettings.apiKey}
                  onChange={(e) => setLocalSettings({ ...localSettings, apiKey: e.target.value })}
                  placeholder="Enter your Gemini API key"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Get your API key from <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google AI Studio</a></p>
                <div className="mt-4 grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2"><Cpu className="w-4 h-4 inline mr-1" /> Model</label>
                    <select
                      value={localSettings.model}
                      onChange={(e) => setLocalSettings({ ...localSettings, model: e.target.value as any })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {models.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2"><Hash className="w-4 h-4 inline mr-1" /> Max Tokens</label>
                    <input
                      type="number"
                      value={localSettings.maxTokens}
                      onChange={(e) => setLocalSettings({ ...localSettings, maxTokens: parseInt(e.target.value) })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      min="256"
                      max="8192"
                    />
                    <p className="text-xs text-gray-500 mt-1">Higher values allow longer outputs but cost more</p>
                  </div>
                </div>
              </Collapsible>

              <Collapsible title={<span className="inline-flex items-center gap-2"><ShieldQuestion className="w-4 h-4" /> OpenRouter (Optional)</span>} defaultOpen={hasOpenRouterConfigured}>
                <p className="text-xs text-gray-500 mb-3">Provide OpenRouter API key and model to use as a fallback (or preferred) provider for proofreading when Gemini is rate-limited or unavailable.</p>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">OpenRouter API Key</label>
                    <input
                      type="password"
                      value={(localSettings as any).openRouterApiKey || ''}
                      onChange={(e) => setLocalSettings({ ...localSettings, openRouterApiKey: e.target.value } as any)}
                      placeholder="Enter your OpenRouter API key"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">OpenRouter Model</label>
                    <input
                      type="text"
                      value={(localSettings as any).openRouterModel || ''}
                      onChange={(e) => setLocalSettings({ ...localSettings, openRouterModel: e.target.value } as any)}
                      placeholder="e.g., google/gemini-1.5-flash, openai/gpt-4o-mini"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!(localSettings as any).fallbackToOpenRouter}
                        onChange={(e) => setLocalSettings({ ...localSettings, fallbackToOpenRouter: e.target.checked } as any)}
                      />
                      Use as fallback when Gemini fails/429
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!(localSettings as any).preferOpenRouterForProofreading}
                        onChange={(e) => setLocalSettings({ ...localSettings, preferOpenRouterForProofreading: e.target.checked } as any)}
                      />
                      Prefer OpenRouter for proofreading
                    </label>
                  </div>
                </div>
              </Collapsible>

              <Collapsible title={<span className="inline-flex items-center gap-2">Model Behavior</span>} defaultOpen={false}>
                <div className="flex items-center gap-4 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!localSettings.lowTemperature}
                      onChange={(e) => setLocalSettings({ ...localSettings, lowTemperature: e.target.checked })}
                    />
                    Low temperature (reduce hallucinations)
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!localSettings.forceAmharic}
                      onChange={(e) => setLocalSettings({ ...localSettings, forceAmharic: e.target.checked })}
                    />
                    Force Amharic (አማርኛ)
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!(localSettings as any).strictAmharic}
                      onChange={(e) => setLocalSettings({ ...localSettings, strictAmharic: e.target.checked } as any)}
                    />
                    Strict Amharic mode (ASCII blacklist)
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-1">Low temperature uses deterministic decoding; Force Amharic enforces Ethiopic script; Strict Amharic mode blacklists ASCII letters during OCR to reduce spurious English words.</p>
              </Collapsible>

              <Collapsible title={<span className="inline-flex items-center gap-2">PDF Export</span>} defaultOpen={false}>
                <div className="flex items-center gap-4 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!localSettings.pdfIncludeTOC}
                      onChange={(e) => setLocalSettings({ ...localSettings, pdfIncludeTOC: e.target.checked })}
                    />
                    Include TOC
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!localSettings.pdfIncludeFooter}
                      onChange={(e) => setLocalSettings({ ...localSettings, pdfIncludeFooter: e.target.checked })}
                    />
                    Include page footer
                  </label>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">TOC position</label>
                    <select
                      value={localSettings.pdfTocPosition || 'end'}
                      onChange={(e) => setLocalSettings({ ...localSettings, pdfTocPosition: e.target.value as any })}
                      className="w-full p-2 border border-gray-300 rounded"
                    >
                      <option value="start">Start (before content)</option>
                      <option value="end">End (after content)</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!localSettings.bookIncludeCover}
                        onChange={(e) => setLocalSettings({ ...localSettings, bookIncludeCover: e.target.checked })}
                      />
                      Include cover page
                    </label>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Controls TOC placement, cover page, and page numbers for generated PDFs.</p>
              </Collapsible>
            </div>

            {/* Sticky footer inside scroll container */}
            <div className="sticky bottom-0 bg-white px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={toggleSettings}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                {t('settings.cancel')}
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t('settings.save')}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Simple collapsible wrapper for modal sections
const Collapsible: React.FC<{ title: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode }> = ({ title, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-lg">
      <button type="button" className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50" onClick={() => setOpen(o => !o)}>
        <div className="text-sm font-medium text-gray-800">{title}</div>
        {open ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 bg-white">
          {children}
        </div>
      )}
    </div>
  );
};