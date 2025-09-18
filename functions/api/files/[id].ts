import { jsonResponse, errorResponse, methodNotAllowed } from '../../utils/http';
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
};
type LocalPagesFunction<E> = (context: { request: Request; env: E; params: any }) => Promise<Response>;

type Env = {
  DB: LocalD1Database;
  JWT_SECRET: string;
  FIREBASE_ADMIN_PROJECT_ID?: string;
  FIREBASE_ADMIN_CLIENT_EMAIL?: string;
  FIREBASE_ADMIN_PRIVATE_KEY?: string;
};

export const onRequest: LocalPagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const fileId = params?.id as string | undefined;
  if (!fileId) {
    return errorResponse('File ID missing', 400);
  }

  // Authenticate request
  const authResult = await authenticateRequest(request, env);
  if (!authResult.success) {
    return errorResponse(authResult.error || 'Authentication failed', 401);
  }

  const userId = authResult.user!.id;

  switch (request.method.toUpperCase()) {
    case 'GET':
      return getFile(env, fileId, userId);
    case 'DELETE':
      return deleteFile(env, fileId, userId);
    default:
      return methodNotAllowed();
  }
};

async function getFile(env: Env, fileId: string, userId: string): Promise<Response> {
  const file = await env.DB.prepare(
    `SELECT id, project_id, user_id, name, size, mime_type, status, preview, original_preview,
            created_at, updated_at
       FROM files WHERE id = ?1 AND user_id = ?2`
  ).bind(fileId, userId).first();

  if (!file) {
    return errorResponse('File not found', 404);
  }

  return jsonResponse({ file });
}

async function deleteFile(env: Env, fileId: string, userId: string): Promise<Response> {
  try {
    // Verify user owns the file before deletion
    const fileCheck = await env.DB.prepare(
      'SELECT id FROM files WHERE id = ?1 AND user_id = ?2'
    ).bind(fileId, userId).first();

    if (!fileCheck) {
      return errorResponse('File not found', 404);
    }

    // Delete related results and then the file
    await env.DB.prepare('DELETE FROM results WHERE file_id = ?1 AND user_id = ?2').bind(fileId, userId).run();
    await env.DB.prepare('DELETE FROM files WHERE id = ?1 AND user_id = ?2').bind(fileId, userId).run();
  } catch (error) {
    console.error('Failed to delete file', error);
    return errorResponse('Failed to delete file', 500);
  }

  return jsonResponse({ success: true });
}
