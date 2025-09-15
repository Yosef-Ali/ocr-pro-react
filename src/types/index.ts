// Type definitions for the OCR application

export interface OCRFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  preview: string | null;
  projectId?: string;
  result?: OCRResult;
}

export interface OCRResult {
  id: string;
  fileId: string;
  projectId?: string;
  extractedText: string;
  layoutPreserved: string;
  detectedLanguage: string;
  confidence: number;
  documentType: string;
  processingTime: number;
  layoutAnalysis: LayoutAnalysis;
  metadata?: {
    pageCount?: number;
    wordCount?: number;
    characterCount?: number;
    layoutMarkdown?: string;
    engine?: 'tesseract' | 'gemini';
    proofreadingSuggestions?: ProofreadingSuggestion[];
    llmOcrText?: string;
    llmOcrLayout?: string;
    llmOcrProvider?: 'openrouter' | 'gemini';
    llmOcrModel?: string;
  };
}

export interface ProofreadingSuggestion {
  original: string; // exact snippet as in OCR
  suggestion: string; // proposed corrected or completed text
  reason?: string; // brief explanation in Amharic if possible
  confidence?: number; // optional confidence score 0..1
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
}

export interface ProjectSummary {
  projectId: string;
  generatedAt: number;
  toc: Array<{ title: string; level: number; page?: number }>;
  summary: string;
  chapters?: Array<{ title: string; content: string }>; // optional rearranged content
  proofreadingNotes?: string[]; // e.g., page numbers removed, typos fixed
}

export interface LayoutAnalysis {
  textBlocks: number;
  tables: number;
  images: number;
  columns: number;
  complexity: 'low' | 'medium' | 'high';
  structure: LayoutElement[];
}

export interface LayoutElement {
  type: 'text' | 'table' | 'image' | 'heading';
  content: string;
  confidence: number;
  boundingBox?: BoundingBox;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Settings {
  apiKey: string;
  model: 'gemini-1.5-flash' | 'gemini-1.5-pro' | 'gemini-2.5-pro' | 'gemini-pro-vision';
  maxTokens: number;
  language: string;
  preserveLayout: boolean;
  detectTables: boolean;
  enhanceImage: boolean;
  ocrEngine?: 'auto' | 'tesseract' | 'gemini'; // OCR engine selection
  lowTemperature?: boolean; // reduce creativity to curb hallucinations
  forceAmharic?: boolean;   // force Ethiopic handling and language
  strictAmharic?: boolean;  // blacklist ASCII letters during OCR
  pdfIncludeTOC?: boolean;
  pdfIncludeFooter?: boolean;
  pdfTocPosition?: 'start' | 'end';
  bookIncludeCover?: boolean;
  // OpenRouter fallback / preference
  openRouterApiKey?: string;
  openRouterModel?: string; // e.g., 'google/gemini-1.5-flash' or 'openai/gpt-4o-mini'
  fallbackToOpenRouter?: boolean; // use on Gemini errors
  preferOpenRouterForProofreading?: boolean; // force OpenRouter for proofreading
}

export type ProcessingStatus =
  | 'idle'
  | 'preparing'
  | 'uploading'
  | 'analyzing'
  | 'extracting'
  | 'formatting'
  | 'completed'
  | 'error';

export interface ProcessingStep {
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  message?: string;
}

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown> | string | number | null;
}

export class OCRError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'OCRError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface ExportOptions {
  format: 'txt' | 'json' | 'pdf' | 'docx' | 'csv';
  includeMetadata: boolean;
  includeAnalysis: boolean;
  preserveFormatting: boolean;
}
