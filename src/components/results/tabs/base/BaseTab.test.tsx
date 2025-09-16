/// <reference types="vitest" />
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BaseTab } from './BaseTab';
import type { OCRResult } from '@/types';

function makeResult(partial: Partial<OCRResult> = {}): OCRResult {
    return {
        id: 'r1',
        fileId: 'f1',
        projectId: undefined,
        extractedText: 'sample',
        layoutPreserved: 'sample layout',
        detectedLanguage: 'en',
        confidence: 0.62,
        documentType: 'document',
        processingTime: 1.2,
        layoutAnalysis: {
            textBlocks: 1,
            tables: 0,
            images: 0,
            columns: 1,
            complexity: 'low',
            structure: [],
        },
        metadata: { wordCount: 1, characterCount: 6, engine: 'tesseract' },
        ...partial,
    };
}

describe('BaseTab', () => {
    it('shows low confidence warning when below FAIR', () => {
        const res = makeResult({ confidence: 0.55 }); // below FAIR=0.6
        render(
            <BaseTab result={res}>
                <div>child</div>
            </BaseTab>
        );
        expect(screen.getByText(/Low Confidence/i)).toBeInTheDocument();
        expect(screen.getByText(/Confidence Level/i)).toBeInTheDocument();
    });

    it('shows very low confidence warning when below LOW', () => {
        const res = makeResult({ confidence: 0.4 }); // below LOW=0.5
        render(
            <BaseTab result={res}>
                <div>child</div>
            </BaseTab>
        );
        expect(screen.getByText(/Very Low Confidence/i)).toBeInTheDocument();
    });

    it('renders Amharic indicator when Ethiopic script detected', () => {
        const res = makeResult({ detectedLanguage: 'am', extractedText: 'ሰላም' });
        render(
            <BaseTab result={res}>
                <div>child</div>
            </BaseTab>
        );
        expect(screen.getByText(/Amharic Text Detected/i)).toBeInTheDocument();
    });

    it('shows metadata footer when enabled', () => {
        const res = makeResult({ confidence: 0.86 });
        render(
            <BaseTab result={res} showMetadata>
                <div>child</div>
            </BaseTab>
        );
        expect(screen.getByText(/Engine:/i)).toBeInTheDocument();
        expect(screen.getByText(/Confidence:/i)).toBeInTheDocument();
    });
});
