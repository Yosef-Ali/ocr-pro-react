import React from 'react';
import { motion } from 'framer-motion';
import { useOCRStore } from '@/store/ocrStore';
import { OCRResult } from '@/types';
import { ExtractedTextTab } from './tabs/ExtractedTextTab';
import { LayoutPreservedTab } from './tabs/LayoutPreservedTab';
import { AnalysisTab } from './tabs/AnalysisTab';
import { OCRTableTab } from './tabs/OCRTableTab';

interface Props {
  result: OCRResult;
}

const tabs = [
  { id: 'extracted', label: 'Extracted Text', component: ExtractedTextTab },
  { id: 'layout', label: 'Layout Preserved', component: LayoutPreservedTab },
  { id: 'analysis', label: 'Document Analysis', component: AnalysisTab },
  { id: 'table', label: 'All OCR (Table)', component: OCRTableTab as any },
] as const;

export const ResultTabs: React.FC<Props> = ({ result }) => {
  const { activeTab, setActiveTab } = useOCRStore();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`
                py-2 px-1 border-b-2 font-medium transition-all
                ${activeTab === id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                }
              `}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="fade-in">
        {tabs.map(({ id, component: Component }) => (
          activeTab === id && (
            <Component key={id} result={result} />
          )
        ))}
      </div>
    </motion.div>
  );
};
