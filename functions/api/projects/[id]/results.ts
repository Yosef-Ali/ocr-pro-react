import { jsonResponse, errorResponse, methodNotAllowed, readJson } from '../../../utils/http';

type Env = {
  DB: D1Database;
};

type ResultPayload = {
  id: string;
  file_id: string;
  project_id?: string | null;
  extracted_text?: string;
  layout_preserved?: string;
  detected_language?: string;
  confidence?: number;
  document_type?: string;
  metadata?: unknown;
};

type BulkResultsPayload = {
  results: ResultPayload[];
};

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const projectIdParam = params?.id as string | undefined;
  if (!projectIdParam) {
    return errorResponse('Project ID missing', 400);
  }

  const normalizedProjectId = projectIdParam === 'null' ? null : projectIdParam;

  switch (request.method.toUpperCase()) {
    case 'GET':
      return listProjectResults(env, normalizedProjectId);
    case 'POST':
      return upsertProjectResults(env, normalizedProjectId, request);
    default:
      return methodNotAllowed();
  }
};

async function listProjectResults(env: Env, projectId: string | null): Promise<Response> {
  const statement = projectId === null
    ? env.DB.prepare(
        `SELECT id, file_id, project_id, extracted_text, layout_preserved, detected_language,
                confidence, document_type, metadata, created_at, updated_at
           FROM results WHERE project_id IS NULL`
      )
    : env.DB.prepare(
        `SELECT id, file_id, project_id, extracted_text, layout_preserved, detected_language,
                confidence, document_type, metadata, created_at, updated_at
           FROM results WHERE project_id = ?1`
      ).bind(projectId);

  const results = await statement.all();

  return jsonResponse({ results: results.results ?? [] });
}

async function upsertProjectResults(env: Env, projectId: string | null, request: Request): Promise<Response> {
  let payload: BulkResultsPayload;
  try {
    payload = await readJson<BulkResultsPayload>(request);
  } catch (error: any) {
    return errorResponse(error?.message ?? 'Invalid JSON payload', 400);
  }

  if (!Array.isArray(payload.results) || payload.results.length === 0) {
    return errorResponse('Results array required', 422);
  }

  const now = Date.now();
  const statements: D1PreparedStatement[] = [];

  for (const result of payload.results) {
    if (!result.id || !result.file_id) {
      return errorResponse('Result id and file_id are required', 422);
    }

    const targetProjectId = result.project_id !== undefined ? result.project_id : projectId;

    statements.push(
      env.DB.prepare(
        `INSERT INTO results (
           id, file_id, project_id, extracted_text, layout_preserved,
           detected_language, confidence, document_type, metadata,
           created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
         ON CONFLICT(id) DO UPDATE SET
           file_id = excluded.file_id,
           project_id = excluded.project_id,
           extracted_text = excluded.extracted_text,
           layout_preserved = excluded.layout_preserved,
           detected_language = excluded.detected_language,
           confidence = excluded.confidence,
           document_type = excluded.document_type,
           metadata = excluded.metadata,
           updated_at = excluded.updated_at`
      ).bind(
        result.id,
        result.file_id,
        targetProjectId ?? null,
        result.extracted_text ?? null,
        result.layout_preserved ?? null,
        result.detected_language ?? null,
        result.confidence ?? null,
        result.document_type ?? null,
        result.metadata != null ? JSON.stringify(result.metadata) : null,
        now,
        now
      )
    );
  }

  try {
    await env.DB.batch(statements);
  } catch (error) {
    console.error('Failed to upsert project results', error);
    return errorResponse('Failed to write results', 500);
  }

  return listProjectResults(env, projectId);
}
