import React from 'react';
import { Settings2 } from 'lucide-react';
import { useOCRStore } from '@/store/ocrStore';
import { motion } from 'framer-motion';
const MotionLabel = motion.label as any;

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
      <h3 className="text-sm font-medium text-foreground mb-3 flex items-center">
        <Settings2 className="w-4 h-4 mr-1" />
        OCR Options
      </h3>
      <div className="space-y-3">
        {options.map(({ id, label, description }) => (
          <MotionLabel
            key={id}
            whileHover={{ x: 2 }}
            className="flex items-start cursor-pointer group"
          >
            <input
              type="checkbox"
              checked={settings[id as keyof typeof settings] as boolean}
              onChange={(e) => updateSettings({ [id]: e.target.checked })}
              className="mt-1 rounded border-input text-primary focus:ring-ring"
            />
            <div className="ml-3">
              <span className="text-sm text-muted-foreground group-hover:text-foreground">
                {label}
              </span>
              <p className="text-xs text-muted-foreground/70">{description}</p>
            </div>
          </MotionLabel>
        ))}
      </div>
    </div>
  );
};
