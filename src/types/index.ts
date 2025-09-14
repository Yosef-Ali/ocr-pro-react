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
  };
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
  model: 'gemini-1.5-flash' | 'gemini-1.5-pro' | 'gemini-pro-vision';
  maxTokens: number;
  language: string;
  preserveLayout: boolean;
  detectTables: boolean;
  enhanceImage: boolean;
  pdfIncludeTOC?: boolean;
  pdfIncludeFooter?: boolean;
  pdfTocPosition?: 'start' | 'end';
  bookIncludeCover?: boolean;
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
  details?: any;
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
