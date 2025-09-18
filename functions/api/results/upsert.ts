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
type LocalPagesFunction<E> = (context: { request: Request; env: E }) => Promise<Response>;

type Env = {
  DB: LocalD1Database;
  JWT_SECRET: string;
  FIREBASE_ADMIN_PROJECT_ID?: string;
  FIREBASE_ADMIN_CLIENT_EMAIL?: string;
  FIREBASE_ADMIN_PRIVATE_KEY?: string;
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
  metadata?: any;
};

type BulkResultsPayload = {
  results: ResultPayload[];
};

export const onRequest: LocalPagesFunction<Env> = async (context) => {
  const { request, env } = context;

  switch (request.method.toUpperCase()) {
    case 'POST':
      return upsertResults(env, request);
    default:
      return methodNotAllowed();
  }
};

async function upsertResults(env: Env, request: Request): Promise<Response> {
  // Authenticate request
  const authResult = await authenticateRequest(request, env);
  if (!authResult.success) {
    return errorResponse(authResult.error || 'Authentication failed', 401);
  }

  const userId = authResult.user!.id;

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
  const statements: LocalD1PreparedStatement[] = [];

  for (const result of payload.results) {
    if (!result.id || !result.file_id) {
      return errorResponse('Result id and file_id are required', 422);
    }

    // Serialize metadata to JSON string
    const metadataJson = result.metadata ? JSON.stringify(result.metadata) : null;

    statements.push(
      env.DB.prepare(
        `INSERT INTO results (
           id, file_id, project_id, user_id, extracted_text, layout_preserved, 
           detected_language, confidence, document_type, metadata, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
         ON CONFLICT(id) DO UPDATE SET
           file_id = excluded.file_id,
           project_id = excluded.project_id,
           user_id = excluded.user_id,
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
        result.project_id ?? null,
        userId, // Always use authenticated user's ID
        result.extracted_text ?? null,
        result.layout_preserved ?? null,
        result.detected_language ?? null,
        result.confidence ?? null,
        result.document_type ?? null,
        metadataJson,
        now,
        now
      )
    );
  }

  try {
    await env.DB.batch(statements);
  } catch (error) {
    console.error('Failed to upsert results', error);
    return errorResponse('Failed to write results', 500);
  }

  return jsonResponse({ success: true });
}