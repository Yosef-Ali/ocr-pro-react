import { describe, it, expect } from 'vitest';
import { extractJsonFromText, stripFences, clamp01 } from '../utils/textUtils';

describe('textUtils', () => {
    describe('extractJsonFromText', () => {
        it('should extract JSON from markdown fences', () => {
            const input = '```json\n{"test": "value"}\n```';
            const result = extractJsonFromText(input);
            expect(result).toBe('{"test": "value"}');
        });

        it('should extract JSON without fences', () => {
            const input = 'some text {"test": "value"} more text';
            const result = extractJsonFromText(input);
            expect(result).toBe('{"test": "value"}');
        });
    });

    describe('stripFences', () => {
        it('should remove markdown fences', () => {
            const input = '```json\ncontent\n```';
            const result = stripFences(input);
            expect(result).toBe('content');
        });
    });

    describe('clamp01', () => {
        it('should clamp values between 0 and 1', () => {
            expect(clamp01(0.5)).toBe(0.5);
            expect(clamp01(1.5)).toBe(1);
            expect(clamp01(-0.5)).toBe(0);
            expect(clamp01('0.8')).toBe(0.8);
            expect(clamp01('invalid')).toBe(0.5);
        });
    });
});