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
  const resultId = params?.id as string | undefined;
  if (!resultId) {
    return errorResponse('Result ID missing', 400);
  }

  // Authenticate request
  const authResult = await authenticateRequest(request, env);
  if (!authResult.success) {
    return errorResponse(authResult.error || 'Authentication failed', 401);
  }

  const userId = authResult.user!.id;

  switch (request.method.toUpperCase()) {
    case 'DELETE':
      return deleteResult(env, resultId, userId);
    case 'GET':
      return getResult(env, resultId, userId);
    default:
      return methodNotAllowed();
  }
};

async function getResult(env: Env, resultId: string, userId: string): Promise<Response> {
  const result = await env.DB.prepare(
    `SELECT id, file_id, project_id, user_id, extracted_text, layout_preserved, detected_language,
            confidence, document_type, metadata, created_at, updated_at
       FROM results WHERE id = ?1 AND user_id = ?2`
  ).bind(resultId, userId).first();

  if (!result) {
    return errorResponse('Result not found', 404);
  }

  return jsonResponse({ result });
}

async function deleteResult(env: Env, resultId: string, userId: string): Promise<Response> {
  try {
    // Verify user owns the result before deletion
    const resultCheck = await env.DB.prepare(
      'SELECT id FROM results WHERE id = ?1 AND user_id = ?2'
    ).bind(resultId, userId).first();

    if (!resultCheck) {
      return errorResponse('Result not found', 404);
    }

    await env.DB.prepare('DELETE FROM results WHERE id = ?1 AND user_id = ?2').bind(resultId, userId).run();
  } catch (error) {
    console.error('Failed to delete result', error);
    return errorResponse('Failed to delete result', 500);
  }

  return jsonResponse({ success: true });
}
