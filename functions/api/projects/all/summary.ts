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
  const { request, env } = context;

  // Authenticate request
  const authResult = await authenticateRequest(request, env);
  if (!authResult.success) {
    return errorResponse(authResult.error || 'Authentication failed', 401);
  }

  const userId = authResult.user!.id;

  switch (request.method.toUpperCase()) {
    case 'GET':
      return getAllSummaries(env, userId);
    case 'POST':
      return createAllSummary(env, userId, request);
    case 'DELETE':
      return deleteAllSummary(env, userId);
    default:
      return methodNotAllowed();
  }
};

async function getAllSummaries(env: Env, userId: string): Promise<Response> {
  // Get summary for all projects (project_id = 'all')
  const summary = await env.DB.prepare(
    `SELECT project_id, generated_at, summary, toc, chapters, proofreading_notes
     FROM project_summaries WHERE project_id = 'all' AND user_id = ?1`
  ).bind(userId).first();

  if (!summary) {
    return jsonResponse({ summary: null });
  }

  return jsonResponse({ summary });
}

async function createAllSummary(env: Env, userId: string, request: Request): Promise<Response> {
  let payload: SummaryPayload;
  try {
    payload = await readJson<SummaryPayload>(request);
  } catch (error) {
    return errorResponse('Invalid JSON payload', 400);
  }

  const now = Date.now();
  
  try {
    await env.DB.prepare(
      `INSERT OR REPLACE INTO project_summaries 
       (project_id, user_id, generated_at, summary, toc, chapters, proofreading_notes)
       VALUES ('all', ?1, ?2, ?3, ?4, ?5, ?6)`
    ).bind(
      userId,
      payload.generated_at || now,
      payload.summary || null,
      payload.toc ? JSON.stringify(payload.toc) : null,
      payload.chapters ? JSON.stringify(payload.chapters) : null,
      payload.proofreading_notes ? JSON.stringify(payload.proofreading_notes) : null
    ).run();

    return jsonResponse({ 
      success: true,
      message: 'All projects summary saved successfully'
    });

  } catch (error) {
    console.error('Failed to save all projects summary:', error);
    return errorResponse('Failed to save summary', 500);
  }
}

async function deleteAllSummary(env: Env, userId: string): Promise<Response> {
  try {
    await env.DB.prepare(
      'DELETE FROM project_summaries WHERE project_id = ? AND user_id = ?'
    ).bind('all', userId).run();

    return jsonResponse({
      success: true,
      message: 'All projects summary deleted successfully'
    });

  } catch (error) {
    console.error('Failed to delete all projects summary:', error);
    return errorResponse('Failed to delete summary', 500);
  }
}