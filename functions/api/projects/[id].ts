import { jsonResponse, errorResponse, methodNotAllowed, readJson } from '../../utils/http';
import { authenticateRequest } from '../../utils/auth';

// Minimal local type shapes to avoid external type dependency
type LocalD1PreparedStatement = {
  bind: (...args: any[]) => LocalD1PreparedStatement;
  all: () => Promise<{ results?: any[] } | any>;
  first: <T = any>() => Promise<T | null>;
  run: () => Promise<any>;
};
type LocalD1Database = {
  prepare: (sql: string) => LocalD1PreparedStatement;
  batch: (statements: LocalD1PreparedStatement[]) => Promise<any>;
};
type LocalPagesFunction<E> = (context: { request: Request; env: E; params: any }) => Promise<Response>;

type Env = {
  DB: LocalD1Database;
  JWT_SECRET: string;
  FIREBASE_ADMIN_PROJECT_ID?: string;
  FIREBASE_ADMIN_CLIENT_EMAIL?: string;
  FIREBASE_ADMIN_PRIVATE_KEY?: string;
};

type ProjectUpdatePayload = {
  name?: string;
  description?: string | null;
};

export const onRequest: LocalPagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const projectId = params?.id as string | undefined;
  if (!projectId) {
    return errorResponse('Project ID missing', 400);
  }

  // Authenticate request
  const authResult = await authenticateRequest(request, env);
  if (!authResult.success) {
    return errorResponse(authResult.error || 'Authentication failed', 401);
  }

  const userId = authResult.user!.id;

  switch (request.method.toUpperCase()) {
    case 'GET':
      return getProject(env, projectId, userId);
    case 'PUT':
      return updateProject(env, projectId, userId, request);
    case 'DELETE':
      return deleteProject(env, projectId, userId);
    default:
      return methodNotAllowed();
  }
};

async function getProject(env: Env, projectId: string, userId: string): Promise<Response> {
  const projectResult = await env.DB.prepare(
    'SELECT id, name, description, user_id, created_at, updated_at FROM projects WHERE id = ?1 AND user_id = ?2'
  ).bind(projectId, userId).first();

  if (!projectResult) {
    return errorResponse('Project not found', 404);
  }

  const filesResult = await env.DB.prepare(
    `SELECT id, project_id, user_id, name, size, mime_type, status, preview, original_preview,
            created_at, updated_at
       FROM files WHERE project_id = ?1 AND user_id = ?2`
  ).bind(projectId, userId).all();

  const resultsResult = await env.DB.prepare(
    `SELECT id, file_id, project_id, user_id, extracted_text, layout_preserved, detected_language,
            confidence, document_type, metadata, created_at, updated_at
       FROM results WHERE project_id = ?1 AND user_id = ?2`
  ).bind(projectId, userId).all();

  const summaryResult = await env.DB.prepare(
    `SELECT project_id, generated_at, summary, toc, chapters, proofreading_notes
       FROM project_summaries WHERE project_id = ?1`
  ).bind(projectId).first();

  return jsonResponse({
    project: projectResult,
    files: filesResult.results ?? [],
    results: resultsResult.results ?? [],
    summary: summaryResult ?? null,
  });
}

async function updateProject(env: Env, projectId: string, userId: string, request: Request): Promise<Response> {
  let payload: ProjectUpdatePayload;
  try {
    payload = await readJson<ProjectUpdatePayload>(request);
  } catch (error: any) {
    return errorResponse(error?.message ?? 'Invalid JSON payload', 400);
  }

  const updates: string[] = [];
  const bindings: any[] = [];

  if (payload.name !== undefined) {
    const trimmed = payload.name.trim();
    if (!trimmed) {
      return errorResponse('Project name cannot be empty', 422);
    }
    updates.push('name = ?');
    bindings.push(trimmed);
  }
  if (payload.description !== undefined) {
    updates.push('description = ?');
    bindings.push(payload.description ?? null);
  }

  if (updates.length === 0) {
    return errorResponse('No fields to update', 400);
  }

  updates.push('updated_at = ?');
  const now = Date.now();
  bindings.push(now);

  try {
    const info = await env.DB.prepare(
      `UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`
    ).bind(...bindings, projectId, userId).run();

    if (info.meta.changes === 0) {
      return errorResponse('Project not found', 404);
    }
  } catch (error) {
    console.error('Failed to update project', error);
    return errorResponse('Failed to update project', 500);
  }

  return getProject(env, projectId, userId);
}

async function deleteProject(env: Env, projectId: string, userId: string): Promise<Response> {
  try {
    // Verify user owns the project before deletion
    const projectCheck = await env.DB.prepare(
      'SELECT id FROM projects WHERE id = ?1 AND user_id = ?2'
    ).bind(projectId, userId).first();

    if (!projectCheck) {
      return errorResponse('Project not found', 404);
    }

    await env.DB.batch([
      env.DB.prepare('DELETE FROM project_summaries WHERE project_id = ?1').bind(projectId),
      env.DB.prepare('UPDATE files SET project_id = NULL WHERE project_id = ?1 AND user_id = ?2').bind(projectId, userId),
      env.DB.prepare('UPDATE results SET project_id = NULL WHERE project_id = ?1 AND user_id = ?2').bind(projectId, userId),
      env.DB.prepare('DELETE FROM projects WHERE id = ?1 AND user_id = ?2').bind(projectId, userId),
    ]);
  } catch (error) {
    console.error('Failed to delete project', error);
    return errorResponse('Failed to delete project', 500);
  }

  return jsonResponse({ success: true });
}
