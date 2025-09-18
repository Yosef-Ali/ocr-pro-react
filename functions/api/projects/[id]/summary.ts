import { jsonResponse, errorResponse, methodNotAllowed, readJson } from '../../../utils/http';
import { authenticateRequest } from '../../../utils/auth';

// Minimal local type shapes to avoid external type dependency
type LocalD1PreparedStatement = {
  bind: (...args: any[]) => LocalD1PreparedStatement;
  all: () => Promise<{ results?: any[] } | any>;
  first: <T = any>() => Promise<T | null>;
  run: () => Promise<any>;
};
type LocalD1Database = {
  prepare: (sql: string) => LocalD1PreparedStatement;
};
type LocalPagesFunction<E> = (context: { request: Request; env: E; params: any }) => Promise<Response>;

type Env = {
  DB: LocalD1Database;
  JWT_SECRET: string;
  FIREBASE_ADMIN_PROJECT_ID?: string;
  FIREBASE_ADMIN_CLIENT_EMAIL?: string;
  FIREBASE_ADMIN_PRIVATE_KEY?: string;
};

type SummaryPayload = {
  generated_at?: number;
  summary?: string;
  toc?: unknown;
  chapters?: unknown;
  proofreading_notes?: unknown;
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

  // Verify user owns the project
  const projectCheck = await env.DB.prepare(
    'SELECT id FROM projects WHERE id = ?1 AND user_id = ?2'
  ).bind(projectId, userId).first();

  if (!projectCheck) {
    return errorResponse('Project not found', 404);
  }

  switch (request.method.toUpperCase()) {
    case 'GET':
      return getSummary(env, projectId);
    case 'PUT':
      return upsertSummary(env, projectId, request);
    case 'DELETE':
      return deleteSummary(env, projectId);
    default:
      return methodNotAllowed();
  }
};

async function getSummary(env: Env, projectId: string): Promise<Response> {
  const summary = await env.DB.prepare(
    `SELECT project_id, generated_at, summary, toc, chapters, proofreading_notes
       FROM project_summaries WHERE project_id = ?1`
  ).bind(projectId).first();

  if (!summary) {
    return jsonResponse({ summary: null });
  }

  return jsonResponse({
    summary: {
      ...summary,
      toc: summary.toc ? JSON.parse(summary.toc) : [],
      chapters: summary.chapters ? JSON.parse(summary.chapters) : [],
      proofreading_notes: summary.proofreading_notes ? JSON.parse(summary.proofreading_notes) : [],
    },
  });
}

async function upsertSummary(env: Env, projectId: string, request: Request): Promise<Response> {
  let payload: SummaryPayload;
  try {
    payload = await readJson<SummaryPayload>(request);
  } catch (error: any) {
    return errorResponse(error?.message ?? 'Invalid JSON payload', 400);
  }

  const generatedAt = payload.generated_at ?? Date.now();
  try {
    await env.DB.prepare(
      `INSERT INTO project_summaries (
         project_id, generated_at, summary, toc, chapters, proofreading_notes
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT(project_id) DO UPDATE SET
         generated_at = excluded.generated_at,
         summary = excluded.summary,
         toc = excluded.toc,
         chapters = excluded.chapters,
         proofreading_notes = excluded.proofreading_notes`
    )
      .bind(
        projectId,
        generatedAt,
        payload.summary ?? '',
        payload.toc != null ? JSON.stringify(payload.toc) : JSON.stringify([]),
        payload.chapters != null ? JSON.stringify(payload.chapters) : JSON.stringify([]),
        payload.proofreading_notes != null ? JSON.stringify(payload.proofreading_notes) : JSON.stringify([])
      )
      .run();
  } catch (error) {
    console.error('Failed to upsert project summary', error);
    return errorResponse('Failed to save summary', 500);
  }

  return getSummary(env, projectId);
}

async function deleteSummary(env: Env, projectId: string): Promise<Response> {
  try {
    await env.DB.prepare('DELETE FROM project_summaries WHERE project_id = ?1').bind(projectId).run();
  } catch (error) {
    console.error('Failed to delete project summary', error);
    return errorResponse('Failed to delete summary', 500);
  }

  return jsonResponse({ success: true });
}
