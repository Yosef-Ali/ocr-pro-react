import { apiFetch, withJsonBody } from './client';
import type { RemoteProject, RemoteSummary } from './types';
import type { RemoteFile, RemoteResult } from './types';

interface ProjectsResponse {
  projects: RemoteProject[];
}

interface ProjectDetailsResponse {
  project: RemoteProject;
  files: RemoteFile[];
  results: RemoteResult[];
  summary: (RemoteSummary & {
    toc?: unknown;
    chapters?: unknown;
    proofreading_notes?: unknown;
  }) | null;
}

interface CreateProjectPayload {
  id?: string;
  name: string;
  description?: string;
}

export async function fetchProjects(): Promise<RemoteProject[]> {
  const data = await apiFetch<ProjectsResponse>('/api/projects');
  return data.projects;
}

export async function createProject(payload: CreateProjectPayload): Promise<RemoteProject> {
  const data = await apiFetch<{ project: RemoteProject }>(
    '/api/projects',
    {
      method: 'POST',
      ...withJsonBody(payload),
    }
  );
  return data.project;
}

export async function fetchProjectDetails(projectId: string): Promise<ProjectDetailsResponse> {
  return apiFetch<ProjectDetailsResponse>(`/api/projects/${projectId}`);
}

export async function updateProject(projectId: string, payload: Partial<CreateProjectPayload>): Promise<ProjectDetailsResponse> {
  return apiFetch<ProjectDetailsResponse>(`/api/projects/${projectId}`, {
    method: 'PUT',
    ...withJsonBody(payload),
  });
}

export async function deleteProject(projectId: string): Promise<void> {
  await apiFetch(`/api/projects/${projectId}`, { method: 'DELETE', parseJson: false });
}

export async function saveProjectSummary(projectId: string, summary: RemoteSummary): Promise<{ summary: RemoteSummary | null }> {
  return apiFetch<{ summary: RemoteSummary | null }>(`/api/projects/${projectId}/summary`, {
    method: 'PUT',
    ...withJsonBody(summary),
  });
}

export async function deleteProjectSummary(projectId: string): Promise<void> {
  await apiFetch(`/api/projects/${projectId}/summary`, { method: 'DELETE', parseJson: false });
}

export async function fetchProjectSummary(projectId: string): Promise<RemoteSummary | null> {
  const data = await apiFetch<{ summary: RemoteSummary | null }>(`/api/projects/${projectId}/summary`);
  return data.summary;
}
