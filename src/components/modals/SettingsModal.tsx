import React, { useState } from 'react';
import { Key, Cpu, Hash, Zap, ShieldQuestion, Globe } from 'lucide-react';
import { useOCRStore } from '@/store/ocrStore';
import toast from 'react-hot-toast';
import { validateGeminiApiKey, sanitizeInput } from '@/utils/validationUtils';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Collapsible } from '@/components/ui/Collapsible';

export const SettingsModal: React.FC = () => {
  const { settings, updateSettings, isSettingsOpen, toggleSettings } = useOCRStore();
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
    <Modal
      isOpen={isSettingsOpen}
      onClose={toggleSettings}
      title={t('settings.title')}
      footer={
        <>
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
        </>
      }
    >
      <div className="space-y-3">
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
          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-xs text-yellow-800">
              <ShieldQuestion className="w-3 h-3 inline mr-1" />
              <strong>Security Notice:</strong> API keys are not stored locally and will need to be re-entered when you reload the page.
            </p>
          </div>
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
    </Modal>
  );
};