export interface RemoteProject {
  id: string;
  name: string;
  description: string | null;
  created_at: number;
  updated_at: number;
}

export interface RemoteFile {
  id: string;
  project_id: string | null;
  name: string;
  size: number | null;
  mime_type: string | null;
  status: string | null;
  preview: string | null;
  original_preview: string | null;
  created_at: number;
  updated_at: number;
}

export interface RemoteResult {
  id: string;
  file_id: string;
  project_id: string | null;
  extracted_text: string | null;
  layout_preserved: string | null;
  detected_language: string | null;
  confidence: number | null;
  document_type: string | null;
  metadata: string | null;
  created_at: number;
  updated_at: number;
}

export interface RemoteSummary {
  project_id: string;
  generated_at: number;
  summary: string;
  toc: unknown;
  chapters: unknown;
  proofreading_notes: unknown;
}

export interface ApiError extends Error {
  status?: number;
}
