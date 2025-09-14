import React from 'react';
import { Settings2 } from 'lucide-react';
import { useOCRStore } from '@/store/ocrStore';
import { motion } from 'framer-motion';

export const OCROptions: React.FC = () => {
  const { settings, updateSettings } = useOCRStore();

  const options = [
    {
      id: 'preserveLayout',
      label: 'Preserve original layout',
      description: 'Maintain document formatting',
    },
    {
      id: 'detectTables',
      label: 'Detect tables',
      description: 'Extract structured data',
    },
    {
      id: 'enhanceImage',
      label: 'Enhance image quality',
      description: 'Improve OCR accuracy',
    },
  ];

  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
        <Settings2 className="w-4 h-4 mr-1" />
        OCR Options
      </h3>
      <div className="space-y-3">
        {options.map(({ id, label, description }) => (
          <motion.label
            key={id}
            whileHover={{ x: 2 }}
            className="flex items-start cursor-pointer group"
          >
            <input
              type="checkbox"
              checked={settings[id as keyof typeof settings] as boolean}
              onChange={(e) => updateSettings({ [id]: e.target.checked })}
              className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="ml-3">
              <span className="text-sm text-gray-600 group-hover:text-gray-800">
                {label}
              </span>
              <p className="text-xs text-gray-400">{description}</p>
            </div>
          </motion.label>
        ))}
      </div>
    </div>
  );
};
