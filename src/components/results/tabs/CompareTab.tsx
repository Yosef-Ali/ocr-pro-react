import React from 'react';
import { OCRResult } from '@/types';

interface Props { result: OCRResult }

export const CompareTab: React.FC<Props> = ({ result }) => {
    const tesseractText = result.layoutPreserved || result.extractedText || '';
    const llmText = result.metadata?.llmOcrText || '';
    const llmModel = result.metadata?.llmOcrModel;
    const provider = result.metadata?.llmOcrProvider;

    // Simple side-by-side comparison

    return (
        <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Provider: {provider || '—'} {llmModel ? `• ${llmModel}` : ''}</div>
            {llmText ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                        <div className="font-semibold mb-1">Tesseract</div>
                        <div className="p-3 bg-card text-card-foreground border border-border rounded whitespace-pre-wrap">{tesseractText}</div>
                    </div>
                    <div>
                        <div className="font-semibold mb-1">LLM ({llmModel || provider})</div>
                        <div className="p-3 bg-card text-card-foreground border border-border rounded whitespace-pre-wrap">{llmText}</div>
                    </div>
                </div>
            ) : (
                <div className="text-muted-foreground">No LLM OCR to compare. Use proofreading or LLM OCR action.</div>
            )}
        </div>
    );
};
