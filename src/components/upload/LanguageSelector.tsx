import React from 'react';
import { Globe } from 'lucide-react';
import { useOCRStore } from '@/store/ocrStore';

const languages = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ru', label: 'Russian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ar', label: 'Arabic' },
  { value: 'hi', label: 'Hindi' },
];

export const LanguageSelector: React.FC = () => {
  const { settings, updateSettings } = useOCRStore();

  return (
    <div className="mt-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        <Globe className="w-4 h-4 inline mr-1" />
        Target Language
      </label>
      <select
        value={settings.language}
        onChange={(e) => updateSettings({ language: e.target.value })}
        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
      >
        {languages.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
};
