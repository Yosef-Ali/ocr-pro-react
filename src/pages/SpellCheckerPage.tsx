import React from 'react';
import { AmharicSpellChecker } from '@/components/editor/AmharicSpellChecker';

interface Props {
  initialText?: string;
}

export const SpellCheckerPage: React.FC<Props> = ({ initialText }) => {
  const handleCorrectedText = (correctedText: string) => {
    console.log('Text corrected:', correctedText);
    // You can save to state, send to API, etc.
  };

  return (
    <div className="h-screen">
      <AmharicSpellChecker
        initialText={initialText}
        onCorrectedText={handleCorrectedText}
        showStatistics={true}
        autoCorrectMode={false}
      />
    </div>
  );
};