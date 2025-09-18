import React from 'react';
import { Globe } from 'lucide-react';
import { useOCRStore } from '@/store/ocrStore';

const languages = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'am', label: 'Amharic (አማርኛ)' },
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
      <label className="block text-sm font-medium text-foreground mb-2">
        <Globe className="w-4 h-4 inline mr-1" />
        Target Language
      </label>
      <select
        value={settings.language}
        onChange={(e) => updateSettings({ language: e.target.value })}
        className="w-full p-3 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
      >
        {languages.map(({ value, label }) => (
          <option key={value} value={value} className="text-foreground bg-background">
            {label}
          </option>
        ))}
      </select>
    </div>
  );
};
