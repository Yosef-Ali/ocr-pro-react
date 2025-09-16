import React, { useState, useEffect } from 'react';
import { Settings } from '@/types';
import { Key, Cpu, Hash, Zap, ShieldQuestion, Globe } from 'lucide-react';
import { useOCRStore } from '@/store/ocrStore';
import toast from 'react-hot-toast';
import { validateGeminiApiKey } from '@/utils/validationUtils';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Collapsible } from '@/components/ui/Collapsible';

export const SettingsModal: React.FC = () => {
  const { settings, updateSettings, isSettingsOpen, toggleSettings, clearAllSummaries, resetAllData } = useOCRStore();
  const { t, i18n } = useTranslation();
  function decodeHtmlEntities(val?: string): string | undefined {
    if (!val) return val;
    return val
      .replace(/&#x2F;/g, '/')
      .replace(/&#47;/g, '/')
      .replace(/&frasl;/g, '/')
      .replace(/&amp;/g, '&');
  }

  const [localSettings, setLocalSettings] = useState<Settings & {
    openRouterApiKey?: string;
    openRouterModel?: string;
    fallbackToOpenRouter?: boolean;
    preferOpenRouterForProofreading?: boolean;
  }>({
    ...(settings as any),
    openRouterModel: decodeHtmlEntities((settings as any).openRouterModel) || (settings as any).openRouterModel
  });
  console.log('⚙️ Initial settings:', settings);
  console.log('⚙️ Initial localSettings:', localSettings);

  const handleSave = () => {
    console.log('💾 Settings modal saving...');
    console.log('📝 Local settings before save:', localSettings);
    console.log('📝 OpenRouter key in local settings:', (localSettings as any).openRouterApiKey);

    // Validate API key if provided
    if (localSettings.apiKey && localSettings.apiKey.trim()) {
      if (!validateGeminiApiKey(localSettings.apiKey.trim())) {
        toast.error(t('error.apiKeyInvalid'));
        return;
      }
    }

    // Only trim (do not HTML-escape API keys/models; they are not rendered directly)
    const sanitizedSettings = {
      ...localSettings,
      apiKey: localSettings.apiKey ? localSettings.apiKey.trim() : '',
      openRouterApiKey: localSettings.openRouterApiKey ? localSettings.openRouterApiKey.trim() : '',
      openRouterModel: localSettings.openRouterModel ? decodeHtmlEntities(localSettings.openRouterModel.trim()) : '',
    };
    console.log('✅ Sanitized settings to save:', sanitizedSettings);
    console.log('🔑 Final OpenRouter key:', sanitizedSettings.openRouterApiKey);
    console.log('🤖 Final OpenRouter model:', sanitizedSettings.openRouterModel);

    updateSettings(sanitizedSettings);
    toast.success(t('success.settingsSaved'));
    toggleSettings();
  };

  // One-time migration: if current settings contain encoded slashes, decode and persist silently
  useEffect(() => {
    const current = (localSettings as any).openRouterModel;
    if (current && /&#x2F;|&#47;|&frasl;/.test(current)) {
      const decoded = decodeHtmlEntities(current);
      setLocalSettings(ls => ({ ...ls, openRouterModel: decoded }));
      updateSettings({ ...settings, openRouterModel: decoded });
      console.log('🔄 Migrated encoded OpenRouter model to decoded form:', decoded);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <Collapsible title={<span className="inline-flex items-center gap-2">Data & Reset</span>} defaultOpen={false}>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => { clearAllSummaries(); toast.success('All project summaries cleared'); }}
              className="px-3 py-2 text-sm bg-white border rounded hover:bg-gray-50"
            >
              Clear All Summaries
            </button>
            <button
              onClick={() => { resetAllData(); toast.success('All app data reset'); }}
              className="px-3 py-2 text-sm bg-white border rounded hover:bg-gray-50"
            >
              Reset All Data
            </button>
            <p className="text-xs text-gray-500">Reset clears projects, files, results, and summaries. API keys are not persisted and already cleared on reload.</p>
          </div>
        </Collapsible>
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
                value={localSettings.openRouterApiKey || ''}
                onChange={(e) => setLocalSettings({ ...localSettings, openRouterApiKey: e.target.value })}
                placeholder="Enter your OpenRouter API key"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">OpenRouter Model</label>
              <input
                type="text"
                value={localSettings.openRouterModel || ''}
                onChange={(e) => setLocalSettings({ ...localSettings, openRouterModel: e.target.value })}
                placeholder="e.g., google/gemini-2.0-flash-thinking-exp, openai/gpt-4o-mini"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!localSettings.fallbackToOpenRouter}
                  onChange={(e) => setLocalSettings({ ...localSettings, fallbackToOpenRouter: e.target.checked })}
                />
                Use as fallback when Gemini fails/429
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!localSettings.preferOpenRouterForProofreading}
                  onChange={(e) => setLocalSettings({ ...localSettings, preferOpenRouterForProofreading: e.target.checked })}
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
                checked={!!localSettings.strictAmharic}
                onChange={(e) => setLocalSettings({ ...localSettings, strictAmharic: e.target.checked })}
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