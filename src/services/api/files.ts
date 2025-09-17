import { apiFetch, withJsonBody } from './client';
import type { RemoteFile } from './types';

interface FilesResponse {
  files: RemoteFile[];
}

interface UpsertFilesPayload {
  files: Array<Partial<RemoteFile> & { id: string; name: string }>;
}

export async function fetchFiles(projectId?: string | null): Promise<RemoteFile[]> {
  const search = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  const data = await apiFetch<FilesResponse>(`/api/files${search}`);
  return data.files;
}

export async function upsertFiles(files: UpsertFilesPayload['files']): Promise<void> {
  if (!files.length) return;
  await apiFetch('/api/files', {
    method: 'POST',
    ...withJsonBody({ files }),
    parseJson: false,
  });
}

export async function deleteFile(fileId: string): Promise<void> {
  await apiFetch(`/api/files/${fileId}`, { method: 'DELETE', parseJson: false });
}

export async function fetchFile(fileId: string): Promise<RemoteFile | null> {
  try {
    const data = await apiFetch<{ file: RemoteFile }>(`/api/files/${fileId}`);
    return data.file;
  } catch (error: any) {
    if (error?.status === 404) return null;
    throw error;
  }
}
