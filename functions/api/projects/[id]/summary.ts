import { jsonResponse, errorResponse, methodNotAllowed, readJson } from '../../../utils/http';

type Env = {
  DB: D1Database;
};

type SummaryPayload = {
  generated_at?: number;
  summary?: string;
  toc?: unknown;
  chapters?: unknown;
  proofreading_notes?: unknown;
};

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const projectId = params?.id as string | undefined;
  if (!projectId) {
    return errorResponse('Project ID missing', 400);
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
