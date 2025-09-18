import { jsonResponse, methodNotAllowed } from '../../utils/http';
import { authenticateRequest } from '../../utils/auth';
// Minimal local type shapes to avoid external type dependency
type LocalD1PreparedStatement = {
  bind: (...args: any[]) => LocalD1PreparedStatement;
  all: () => Promise<{ results?: any[] } | any>;
  first: <T = any>() => Promise<T | null>;
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

export const onRequest: LocalPagesFunction<Env> = async (context) => {
  const { request, env } = context;

  // Authenticate request
  const authResult = await authenticateRequest(request, env);
  if (!authResult.success) {
    return new Response(
      JSON.stringify({ error: authResult.error || 'Authentication failed' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const user = authResult.user!;
  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId');
  const fileId = url.searchParams.get('fileId');
  const limit = url.searchParams.get('limit');
  const offset = url.searchParams.get('offset');
  const sortBy = url.searchParams.get('sortBy') || 'created_at';
  const sortDir = (url.searchParams.get('sortDir') || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  switch (request.method.toUpperCase()) {
    case 'GET':
      return listResults(env, { projectId, fileId, limit, offset, sortBy, sortDir, userId: user.id });
    default:
      return methodNotAllowed();
  }
};

type Filters = {
  projectId: string | null;
  fileId: string | null;
  userId: string;
  limit?: string | null;
  offset?: string | null;
  sortBy?: string | null;
  sortDir?: 'ASC' | 'DESC';
};

async function listResults(env: Env, filters: Filters): Promise<Response> {
  const limitNum = Math.max(0, Math.min(500, Number(filters.limit ?? 0) || 0));
  const offsetNum = Math.max(0, Number(filters.offset ?? 0) || 0);
  const sortBy = (filters.sortBy || 'created_at').toLowerCase();
  const sortDir = filters.sortDir === 'ASC' ? 'ASC' : 'DESC';
  // Whitelist sortable columns
  const sortColumn = ['created_at', 'confidence', 'updated_at'].includes(sortBy) ? sortBy : 'created_at';

  // Include legacy rows with NULL user_id so old files/results remain visible
  const whereClauses: string[] = ['(user_id = ? OR user_id IS NULL)'];
  const bindings: unknown[] = [filters.userId];

  if (filters.fileId) {
    whereClauses.push('file_id = ?');
    bindings.push(filters.fileId);
  } else if (filters.projectId) {
    whereClauses.push('project_id = ?');
    bindings.push(filters.projectId);
  }
  const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

  // Total count
  const totalStmt = env.DB.prepare(`SELECT COUNT(*) as total FROM results ${whereSql}`);
  const totalRow = await (bindings.length ? totalStmt.bind(...bindings) : totalStmt).first<{ total: number }>();
  const total = Number(totalRow?.total || 0);

  // Data query
  let sql = `SELECT id, file_id, project_id, user_id, extracted_text, layout_preserved, detected_language,
                    confidence, document_type, metadata, created_at, updated_at
               FROM results ${whereSql} ORDER BY ${sortColumn} ${sortDir}`;
  const bound: unknown[] = [...bindings];
  if (limitNum > 0) {
    sql += ' LIMIT ? OFFSET ?';
    bound.push(limitNum, offsetNum);
  }
  const stmt = env.DB.prepare(sql);
  const rows = await (bound.length ? stmt.bind(...bound) : stmt).all();
  return jsonResponse({ results: rows.results ?? [], total });
}
