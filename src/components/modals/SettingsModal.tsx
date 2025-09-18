import React, { useState, useEffect } from 'react';
import { Settings } from '@/types';
import { Key, Cpu, Hash, Zap, ShieldQuestion, Globe } from 'lucide-react';
import { useOCRStore } from '@/store/ocrStore';
import toast from 'react-hot-toast';
import { validateGeminiApiKey } from '@/utils/validationUtils';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Collapsible } from '@/components/ui/Collapsible';
import { ensureEdgeModel } from '@/services/edge/edgeLLMService';

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

  const buildLocalSettings = React.useCallback(() => ({
    ...(settings as any),
    openRouterApiKey: (settings as any).openRouterApiKey || '',
    openRouterModel: decodeHtmlEntities((settings as any).openRouterModel) || (settings as any).openRouterModel || '',
  }), [settings]);

  const [localSettings, setLocalSettings] = useState<Settings & {
    openRouterApiKey?: string;
    openRouterModel?: string;
    fallbackToOpenRouter?: boolean;
    preferOpenRouterForProofreading?: boolean;
  }>(() => buildLocalSettings());
  console.log('⚙️ Initial settings:', settings);
  console.log('⚙️ Initial localSettings:', localSettings);

  useEffect(() => {
    if (isSettingsOpen) {
      setLocalSettings(buildLocalSettings());
    }
  }, [isSettingsOpen, buildLocalSettings]);

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
      setLocalSettings((ls: any) => ({ ...ls, openRouterModel: decoded }));
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const isProd = typeof import.meta !== 'undefined' && (import.meta as any).env?.PROD;
  const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;

  useEffect(() => {
    if (isProd && (localSettings as any).edgeLLMProvider === 'ollama') {
      setLocalSettings((ls: any) => ({ ...ls, edgeLLMProvider: 'webllm' as any }));
    }
  }, [isProd]);

  return (
    <Dialog open={isSettingsOpen} onOpenChange={(open) => { if (!open) toggleSettings(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader className="flex items-center justify-between">
          <DialogTitle>{t('settings.title')}</DialogTitle>
          <Button variant="ghost" onClick={toggleSettings} aria-label="Close">✕</Button>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2 bg-gray-50 border rounded">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showAdvanced}
                  onChange={(e) => setShowAdvanced(e.target.checked)}
                />
                Show advanced settings
              </label>
              <span className="text-xs text-gray-500">{showAdvanced ? 'All controls visible' : 'Simplified mode: sensible defaults'}</span>
            </div>

            <div className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded">
              <label className="inline-flex items-center gap-2 text-sm text-green-800">
                <input
                  type="checkbox"
                  checked={!!localSettings.endUserMode}
                  onChange={(e) => setLocalSettings({ ...localSettings, endUserMode: e.target.checked })}
                />
                End-user mode (hide research features)
              </label>
              <span className="text-xs text-green-700">Streamlined UI for conversion workflows</span>
            </div>

            {showAdvanced && (
              <Collapsible title={<span className="inline-flex items-center gap-2">Data & Reset</span>} defaultOpen={false}>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={async () => {
                      await clearAllSummaries();
                      toast.success('All project summaries cleared');
                    }}
                    className="px-3 py-2 text-sm bg-white border rounded hover:bg-gray-50"
                  >
                    Clear All Summaries
                  </button>
                  <button
                    onClick={async () => {
                      await resetAllData();
                      toast.success('All app data reset');
                    }}
                    className="px-3 py-2 text-sm bg-white border rounded hover:bg-gray-50"
                  >
                    Reset All Data
                  </button>
                  <p className="text-xs text-gray-500">Reset clears projects, files, results, and summaries. API keys are not persisted and already cleared on reload.</p>
                </div>
              </Collapsible>
            )}
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

            {showAdvanced && (
              <Collapsible title={<span className="inline-flex items-center gap-2">Routing & Privacy</span>} defaultOpen={false}>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Routing Mode</label>
                    <select
                      value={localSettings.routingMode || 'auto'}
                      onChange={(e) => setLocalSettings({ ...localSettings, routingMode: e.target.value as any })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="auto">Auto (decide local vs cloud)</option>
                      <option value="local-only">Local-only (Tesseract)</option>
                      <option value="cloud-only">Cloud-only (Gemini/OpenRouter)</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Local-only never sends images to cloud. Auto prefers local for Amharic hints or TIFF.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Router Strategy</label>
                    <select
                      value={localSettings.routerStrategy || 'heuristic'}
                      onChange={(e) => setLocalSettings({ ...localSettings, routerStrategy: e.target.value as any })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="heuristic">Heuristic (rules-based)</option>
                      <option value="learned">Learned (experimental)</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Learned mode uses a small classifier when available; falls back to heuristics.</p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!localSettings.enableLexiconHints}
                      onChange={(e) => setLocalSettings({ ...localSettings, enableLexiconHints: e.target.checked })}
                    />
                    Protect proper names with lexicon hints
                  </label>
                </div>
              </Collapsible>
            )}

            {showAdvanced && ((!isProd) || (isProd && hasWebGPU)) && (
              <Collapsible title={<span className="inline-flex items-center gap-2">Edge LLM (On-device)</span>} defaultOpen={false}>
                <div className="grid grid-cols-1 gap-3">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!localSettings.edgeLLMEnabled}
                      onChange={(e) => setLocalSettings({ ...localSettings, edgeLLMEnabled: e.target.checked })}
                    />
                    Enable on-device proofreading (Gemma 3 1B)
                  </label>
                  {showAdvanced && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Provider</label>
                        <select
                          value={(isProd ? 'webllm' : (localSettings.edgeLLMProvider || 'webllm')) as any}
                          onChange={(e) => setLocalSettings({ ...localSettings, edgeLLMProvider: e.target.value as any })}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="webllm">WebLLM (WebGPU)</option>
                          {!isProd && <option value="ollama">Ollama (Local server)</option>}
                        </select>
                      </div>
                      {(isProd ? 'webllm' : localSettings.edgeLLMProvider) === 'webllm' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
                            <input
                              type="text"
                              value={localSettings.edgeLLMModel || ''}
                              onChange={(e) => setLocalSettings({ ...localSettings, edgeLLMModel: e.target.value })}
                              placeholder="gemma-3-1b-q4"
                              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Model Base URL (optional)</label>
                            <input
                              type="text"
                              value={localSettings.edgeLLMBaseUrl || ''}
                              onChange={(e) => setLocalSettings({ ...localSettings, edgeLLMBaseUrl: e.target.value })}
                              placeholder="https://cdn.example.com/models/gemma-3-1b/"
                              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">If provided, the app will fetch model artifacts from this base URL. Leave empty to use defaults.</p>
                          </div>
                        </>
                      )}
                      {!isProd && localSettings.edgeLLMProvider === 'ollama' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Endpoint</label>
                            <input
                              type="text"
                              value={(localSettings as any).edgeLLMEndpoint || ''}
                              onChange={(e) => setLocalSettings({ ...localSettings, edgeLLMEndpoint: e.target.value } as any)}
                              placeholder="http://localhost:11434"
                              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">Requires local Ollama running. Defaults to http://localhost:11434.</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
                            <input
                              type="text"
                              value={localSettings.edgeLLMModel || ''}
                              onChange={(e) => setLocalSettings({ ...localSettings, edgeLLMModel: e.target.value })}
                              placeholder="gemma:2b"
                              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">Examples: gemma:2b, llama3.2:1b, qwen2:1.5b.</p>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-gray-500">Requires a WebGPU-capable browser. First use will download and cache model weights for offline use.</p>
                  <div>
                    <button
                      disabled={!localSettings.edgeLLMEnabled || (isProd && !hasWebGPU)}
                      onClick={async () => {
                        if (!localSettings.edgeLLMEnabled) return;
                        toast.loading('Preloading edge model…', { id: 'edge-preload' });
                        try {
                          const ok = await ensureEdgeModel(localSettings as any);
                          toast.dismiss('edge-preload');
                          toast[ok ? 'success' : 'error'](ok ? 'Edge model ready' : 'Edge model unavailable');
                        } catch (e: any) {
                          toast.dismiss('edge-preload');
                          toast.error(e?.message || 'Failed to preload edge model');
                        }
                      }}
                      className={`mt-2 px-3 py-2 text-sm rounded ${localSettings.edgeLLMEnabled && (!isProd || hasWebGPU) ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                    >
                      Preload model (cache)
                    </button>
                  </div>
                </div>
              </Collapsible>
            )}

            <Collapsible title={<span className="inline-flex items-center gap-2"><Key className="w-4 h-4" /> Gemini</span>} defaultOpen={geminiMissing}>
              <label className="block text-sm font-medium text-gray-700 mb-2">Gemini API Key</label>
              <input
                type="password"
                value={localSettings.apiKey || ''}
                onChange={(e) => setLocalSettings({ ...localSettings, apiKey: e.target.value })}
                placeholder="Enter your Gemini API key"
                autoComplete="off"
                name="gemini-api-key"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Get your API key from <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google AI Studio</a></p>
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-xs text-blue-800">
                  <ShieldQuestion className="w-3 h-3 inline mr-1" />
                  Keys are now stored privately in your browser. Use the reset options above if you need to clear them.
                </p>
              </div>
              {showAdvanced && (
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
              )}
            </Collapsible>

            {showAdvanced && (
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
                      autoComplete="off"
                      name="openrouter-api-key"
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
            )}

            {showAdvanced && (
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
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!localSettings.stripPageNumbers}
                      onChange={(e) => setLocalSettings({ ...localSettings, stripPageNumbers: e.target.checked })}
                    />
                    Remove page numbers (standalone lines)
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <span>Tips max tokens</span>
                    <input
                      type="number"
                      min={64}
                      max={512}
                      value={localSettings.tipsMaxTokens || 256}
                      onChange={(e) => setLocalSettings({ ...localSettings, tipsMaxTokens: Math.max(64, Math.min(512, parseInt(e.target.value || '256'))) })}
                      className="w-20 p-1 border rounded"
                    />
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-1">Low temperature uses deterministic decoding; Force Amharic enforces Ethiopic script; Strict Amharic mode blacklists ASCII letters during OCR to reduce spurious English words.</p>
              </Collapsible>
            )}

            {showAdvanced && (
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
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={toggleSettings}>{t('settings.cancel')}</Button>
          <Button onClick={handleSave}>{t('settings.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
