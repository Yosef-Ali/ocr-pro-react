import { jsonResponse, errorResponse, methodNotAllowed, readJson } from '../../utils/http';
import { authenticateRequest } from '../../utils/auth';
// Minimal local type shapes to avoid external type dependency
type LocalD1PreparedStatement = {
  bind: (...args: any[]) => LocalD1PreparedStatement;
  all: () => Promise<{ results?: any[] } | any>;
  first: <T = any>() => Promise<T | null>;
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

type FilePayload = {
  id: string;
  project_id?: string | null;
  user_id?: string | null;
  name: string;
  size?: number;
  mime_type?: string;
  status?: string;
  preview?: string | null;
  original_preview?: string | null;
};

type BulkFilesPayload = {
  files: FilePayload[];
};

export const onRequest: LocalPagesFunction<Env> = async (context) => {
  const { request, env } = context;
  
  // Authenticate request
  const authResult = await authenticateRequest(request, env);
  if (!authResult.success) {
    return errorResponse(authResult.error || 'Authentication failed', 401);
  }

  const user = authResult.user!;
  const url = new URL(request.url);
  const projectIdFilter = url.searchParams.get('projectId');

  switch (request.method.toUpperCase()) {
    case 'GET':
      return listFiles(env, user.id, projectIdFilter);
    case 'POST':
      return upsertFiles(env, request, user.id);
    default:
      return methodNotAllowed();
  }
};

async function listFiles(env: Env, userId: string, projectId?: string | null): Promise<Response> {
  const stmt = projectId
    ? env.DB.prepare(
      `SELECT id, project_id, user_id, name, size, mime_type, status, preview, original_preview,
                created_at, updated_at
           FROM files WHERE user_id = ?1 AND project_id = ?2`
    ).bind(userId, projectId)
    : env.DB.prepare(
      `SELECT id, project_id, user_id, name, size, mime_type, status, preview, original_preview,
                created_at, updated_at
           FROM files WHERE user_id = ?1`
    ).bind(userId);

  const files = await stmt.all();
  return jsonResponse({ files: files.results ?? [] });
}

async function upsertFiles(env: Env, request: Request, userId: string): Promise<Response> {
  let payload: BulkFilesPayload;
  try {
    payload = await readJson<BulkFilesPayload>(request);
  } catch (error: any) {
    return errorResponse(error?.message ?? 'Invalid JSON payload', 400);
  }

  if (!Array.isArray(payload.files) || payload.files.length === 0) {
    return errorResponse('Files array required', 422);
  }

  const now = Date.now();
  const statements: LocalD1PreparedStatement[] = [];

  const MAX_PREVIEW_CHARS = 300_000; // ~300KB of base64 to keep statements reasonable
  for (const file of payload.files) {
    if (!file.id || !file.name) {
      return errorResponse('File id and name are required', 422);
    }

    const safePreview = typeof file.preview === 'string' && file.preview.length > MAX_PREVIEW_CHARS
      ? null
      : (file.preview ?? null);
    const safeOriginalPreview = typeof file.original_preview === 'string' && file.original_preview.length > MAX_PREVIEW_CHARS
      ? null
      : (file.original_preview ?? null);

    statements.push(
      env.DB.prepare(
        `INSERT INTO files (
           id, project_id, user_id, name, size, mime_type, status, preview, original_preview, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
         ON CONFLICT(id) DO UPDATE SET
           project_id = excluded.project_id,
           user_id = excluded.user_id,
           name = excluded.name,
           size = excluded.size,
           mime_type = excluded.mime_type,
           status = excluded.status,
           preview = excluded.preview,
           original_preview = excluded.original_preview,
           updated_at = excluded.updated_at`
      ).bind(
        file.id,
        file.project_id ?? null,
        userId, // Always use authenticated user's ID
        file.name,
        file.size ?? null,
        file.mime_type ?? null,
        file.status ?? null,
        safePreview,
        safeOriginalPreview,
        now,
        now
      )
    );
  }

  try {
    await env.DB.batch(statements);
  } catch (error) {
    console.error('Failed to upsert files', error);
    return errorResponse('Failed to write files', 500);
  }

  return jsonResponse({ success: true });
}
