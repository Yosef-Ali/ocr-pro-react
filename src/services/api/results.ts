import { apiFetch, withJsonBody } from './client';
import type { RemoteResult } from './types';

interface ResultsResponse {
  results: RemoteResult[];
  total?: number;
}

interface ResultUpsertPayload {
  id: string;
  file_id: string;
  project_id?: string | null;
  extracted_text?: string;
  layout_preserved?: string;
  detected_language?: string;
  confidence?: number;
  document_type?: string;
  metadata?: unknown;
}

interface UpsertResultPayload {
  results: ResultUpsertPayload[];
}

export async function fetchResultsPaged(
  filters: { projectId?: string | null; fileId?: string | null } = {},
  options: { limit?: number; offset?: number; sortBy?: 'created_at' | 'updated_at' | 'confidence'; sortDir?: 'asc' | 'desc' } = {}
): Promise<{ results: RemoteResult[]; total: number }> {
  const params = new URLSearchParams();
  if (filters.projectId) params.set('projectId', filters.projectId);
  if (filters.fileId) params.set('fileId', filters.fileId);
  if (options.limit != null) params.set('limit', String(options.limit));
  if (options.offset != null) params.set('offset', String(options.offset));
  if (options.sortBy) params.set('sortBy', options.sortBy);
  if (options.sortDir) params.set('sortDir', options.sortDir);
  const search = params.toString();
  const data = await apiFetch<ResultsResponse>(`/api/results${search ? `?${search}` : ''}`);
  return { results: data.results, total: data.total ?? data.results.length };
}

export async function fetchResults(filters: { projectId?: string | null; fileId?: string | null } = {}): Promise<RemoteResult[]> {
  const { results } = await fetchResultsPaged(filters);
  return results;
}

export async function upsertResults(projectId: string | null, results: UpsertResultPayload['results']): Promise<void> {
  if (!results.length) return;
  const target = projectId ?? 'null';
  await apiFetch(`/api/projects/${target}/results`, {
    method: 'POST',
    ...withJsonBody({ results }),
    parseJson: false,
  });
}

export async function deleteResult(resultId: string): Promise<void> {
  await apiFetch(`/api/results/${resultId}`, { method: 'DELETE', parseJson: false });
}

export async function fetchResult(resultId: string): Promise<RemoteResult | null> {
  try {
    const data = await apiFetch<{ result: RemoteResult }>(`/api/results/${resultId}`);
    return data.result;
  } catch (error: any) {
    if (error?.status === 404) return null;
    throw error;
  }
}
