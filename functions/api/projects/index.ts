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
};
type LocalPagesFunction<E> = (context: { request: Request; env: E }) => Promise<Response>;

type Env = {
  DB: LocalD1Database;
  JWT_SECRET: string;
  FIREBASE_ADMIN_PROJECT_ID?: string;
  FIREBASE_ADMIN_CLIENT_EMAIL?: string;
  FIREBASE_ADMIN_PRIVATE_KEY?: string;
};

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  user_id: string | null;
  created_at: number;
  updated_at: number;
};

type ProjectPayload = {
  id?: string;
  name: string;
  description?: string;
};

export const onRequest: LocalPagesFunction<Env> = async (context) => {
  const { request, env } = context;

  // Authenticate request
  const authResult = await authenticateRequest(request, env);
  if (!authResult.success) {
    return errorResponse(authResult.error || 'Authentication failed', 401);
  }

  const user = authResult.user!;

  switch (request.method.toUpperCase()) {
    case 'GET':
      return listProjects(env, user.id);
    case 'POST':
      return createProject(env, request, user.id);
    default:
      return methodNotAllowed();
  }
};

async function listProjects(env: Env, userId: string): Promise<Response> {
  const result = await env.DB.prepare(
    'SELECT id, name, description, user_id, created_at, updated_at FROM projects WHERE (user_id = ?1 OR user_id IS NULL) ORDER BY updated_at DESC'
  ).bind(userId).all();
  return jsonResponse({ projects: result.results ?? [] });
}

async function createProject(env: Env, request: Request, userId: string): Promise<Response> {
  let payload: ProjectPayload;
  try {
    payload = await readJson<ProjectPayload>(request);
  } catch (error: any) {
    return errorResponse(error?.message ?? 'Invalid JSON payload', 400);
  }

  if (!payload.name || !payload.name.trim()) {
    return errorResponse('Project name is required', 422);
  }

  const id = payload.id?.trim() || crypto.randomUUID();
  const now = Date.now();
  const description = payload.description?.trim() || null;

  try {
    await env.DB.prepare(
      `INSERT INTO projects (id, name, description, user_id, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         user_id = excluded.user_id,
         updated_at = excluded.updated_at`
    )
      .bind(id, payload.name.trim(), description, userId, now, now)
      .run();
  } catch (error) {
    console.error('Failed to create project', error);
    return errorResponse('Failed to create project', 500);
  }

  return jsonResponse({
    project: {
      id,
      name: payload.name.trim(),
      description,
      user_id: userId,
      created_at: now,
      updated_at: now,
    },
  }, { status: 201 });
}
