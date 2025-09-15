import React from 'react';
import { OCRResult } from '@/types';
import { BaseTab, TextContainer, EmptyState } from './base';

interface Props {
  result: OCRResult;
}

export const ExtractedTextTab: React.FC<Props> = ({ result }) => {
  if (!result.extractedText?.trim()) {
    return (
      <BaseTab result={result}>
        <EmptyState message="No extracted text available" icon="📝" />
      </BaseTab>
    );
  }

  return (
    <BaseTab result={result} showMetadata>
      <TextContainer>
        {result.extractedText}
      </TextContainer>
    </BaseTab>
  );
};
