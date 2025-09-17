import type { RemoteFile, RemoteResult, RemoteSummary } from './types';
import type { OCRFile, OCRResult, ProjectSummary } from '@/types';

export function mapRemoteFile(remote: RemoteFile): OCRFile {
  return {
    id: remote.id,
    name: remote.name,
    size: remote.size ?? 0,
    type: remote.mime_type ?? 'application/octet-stream',
    status: (remote.status as OCRFile['status']) || 'pending',
    preview: remote.preview,
    originalPreview: remote.original_preview ?? undefined,
    projectId: remote.project_id ?? undefined,
    file: undefined,
  } as OCRFile;
}

export function mapRemoteResult(remote: RemoteResult): OCRResult {
  let metadata: any = undefined;
  if (remote.metadata) {
    try {
      metadata = JSON.parse(remote.metadata);
    } catch {
      metadata = undefined;
    }
  }
  return {
    id: remote.id,
    fileId: remote.file_id,
    projectId: remote.project_id ?? undefined,
    extractedText: remote.extracted_text ?? '',
    layoutPreserved: remote.layout_preserved ?? remote.extracted_text ?? '',
    detectedLanguage: remote.detected_language ?? 'unknown',
    confidence: remote.confidence ?? 0,
    documentType: remote.document_type ?? 'Unknown',
    processingTime: 0,
    layoutAnalysis: metadata?.layoutAnalysis || {
      textBlocks: 0,
      tables: 0,
      images: 0,
      columns: 1,
      complexity: 'medium',
      structure: [],
    },
    metadata,
  };
}

export function mapRemoteSummary(remote: RemoteSummary): ProjectSummary {
  const toc = Array.isArray(remote.toc) ? remote.toc : [];
  const chapters = Array.isArray(remote.chapters) ? remote.chapters : [];
  const proofreadingNotes = Array.isArray(remote.proofreading_notes) ? remote.proofreading_notes : [];

  return {
    projectId: remote.project_id,
    generatedAt: remote.generated_at,
    summary: remote.summary || '',
    toc: toc as any,
    chapters: chapters as any,
    proofreadingNotes: proofreadingNotes as string[],
  };
}
