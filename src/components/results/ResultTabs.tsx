import React from 'react';
import { motion } from 'framer-motion';
import { useOCRStore } from '@/store/ocrStore';
import { OCRResult } from '@/types';
import { ExtractedTextTab } from './tabs/ExtractedTextTab';
import { LayoutPreservedTab } from './tabs/LayoutPreservedTab';
import { BookPreviewTab } from './tabs/BookPreviewTab';
import { OCRTableTab } from './tabs/OCRTableTab';

interface Props {
  result: OCRResult;
}

type TabId = 'extracted' | 'layout' | 'preview' | 'table';

const ALL_TABS: Array<{ id: TabId; label: string; component: any }> = [
  { id: 'extracted', label: 'Extracted Text', component: ExtractedTextTab },
  { id: 'layout', label: 'Layout Preserved', component: LayoutPreservedTab },
  { id: 'preview', label: 'Book Preview', component: BookPreviewTab },
  { id: 'table', label: 'All OCR (Table)', component: OCRTableTab as any },
];

export const ResultTabs: React.FC<Props> = ({ result }) => {
  const { activeTab, setActiveTab, settings } = useOCRStore() as any;

  // End-user mode hides the advanced Layout Preserved editor
  const tabs = React.useMemo(() => {
    if (settings?.endUserMode) {
      return ALL_TABS.filter((t) => t.id !== 'layout');
    }
    return ALL_TABS;
  }, [settings?.endUserMode]);

  // If current active tab is hidden, fall back to first visible
  React.useEffect(() => {
    if (!tabs.some((t) => t.id === (activeTab as any))) {
      setActiveTab(tabs[0]?.id as any);
    }
  }, [activeTab, setActiveTab, tabs]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Tab Navigation */}
      <div className="border-b border-border mb-6">
        <nav className="flex space-x-8">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`
                py-2 px-1 border-b-2 font-medium transition-all
                ${activeTab === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
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
        {(() => {
          const active = tabs.find(t => t.id === (activeTab as any));
          if (!active) return null;
          const Component: any = active.component;
          if (active.id === 'table') {
            return <Component key={active.id} />;
          }
          return <Component key={active.id} result={result} />;
        })()}
      </div>
    </motion.div>
  );
};
