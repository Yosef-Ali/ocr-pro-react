import React, { useState } from 'react';
import { X, Key, Cpu, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOCRStore } from '@/store/ocrStore';
import toast from 'react-hot-toast';

export const SettingsModal: React.FC = () => {
  const { settings, updateSettings, toggleSettings } = useOCRStore();
  const [localSettings, setLocalSettings] = useState(settings);

  const handleSave = () => {
    updateSettings(localSettings);
    toast.success('Settings saved successfully');
    toggleSettings();
  };

  const models = [
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Fast)' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Balanced)' },
    { value: 'gemini-pro-vision', label: 'Gemini Pro Vision (Legacy)' },
  ];

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
          className="bg-white rounded-xl p-6 w-full max-w-md mx-4"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Settings</h2>
            <button
              onClick={toggleSettings}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6">
            {/* API Key */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Key className="w-4 h-4 inline mr-1" />
                Gemini API Key
              </label>
              <input
                type="password"
                value={localSettings.apiKey}
                onChange={(e) => setLocalSettings({ ...localSettings, apiKey: e.target.value })}
                placeholder="Enter your Gemini API key"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Get your API key from{' '}
                <a
                  href="https://makersuite.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Google AI Studio
                </a>
              </p>
            </div>

            {/* Model Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Cpu className="w-4 h-4 inline mr-1" />
                Model
              </label>
              <select
                value={localSettings.model}
                onChange={(e) => setLocalSettings({ ...localSettings, model: e.target.value as any })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {models.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Max Tokens */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Hash className="w-4 h-4 inline mr-1" />
                Max Tokens
              </label>
              <input
                type="number"
                value={localSettings.maxTokens}
                onChange={(e) => setLocalSettings({ ...localSettings, maxTokens: parseInt(e.target.value) })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="256"
                max="8192"
              />
              <p className="text-xs text-gray-500 mt-1">
                Higher values allow longer outputs but cost more
              </p>
            </div>

            {/* PDF Export Options */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">PDF Export</label>
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
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={toggleSettings}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Save Settings
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};