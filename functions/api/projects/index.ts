import { jsonResponse, errorResponse, methodNotAllowed, readJson } from '../../utils/http';

type Env = {
  DB: D1Database;
};

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: number;
  updated_at: number;
};

type ProjectPayload = {
  id?: string;
  name: string;
  description?: string;
};

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  switch (request.method.toUpperCase()) {
    case 'GET':
      return listProjects(env);
    case 'POST':
      return createProject(env, request);
    default:
      return methodNotAllowed();
  }
};

async function listProjects(env: Env): Promise<Response> {
  const result = await env.DB.prepare(
    'SELECT id, name, description, created_at, updated_at FROM projects ORDER BY created_at ASC'
  ).all<ProjectRow>();
  return jsonResponse({ projects: result.results ?? [] });
}

async function createProject(env: Env, request: Request): Promise<Response> {
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
      `INSERT INTO projects (id, name, description, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         updated_at = excluded.updated_at`
    )
      .bind(id, payload.name.trim(), description, now, now)
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
      created_at: now,
      updated_at: now,
    },
  }, { status: 201 });
}
