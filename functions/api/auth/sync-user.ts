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
};
type LocalPagesFunction<E> = (context: { request: Request; env: E }) => Promise<Response>;

type Env = {
  DB: LocalD1Database;
  JWT_SECRET: string;
  FIREBASE_ADMIN_PROJECT_ID?: string;
  FIREBASE_ADMIN_CLIENT_EMAIL?: string;
  FIREBASE_ADMIN_PRIVATE_KEY?: string;
};

type UserSyncPayload = {
  id: string;
  email: string;
  name: string;
  googleId?: string;
  profilePicture?: string;
};

export const onRequest: LocalPagesFunction<Env> = async (context) => {
  const { request, env } = context;

  switch (request.method.toUpperCase()) {
    case 'POST':
      return syncUser(env, request);
    default:
      return methodNotAllowed();
  }
};

async function syncUser(env: Env, request: Request): Promise<Response> {
  // Authenticate the request
  const authResult = await authenticateRequest(request, env);
  if (!authResult.success) {
    return errorResponse(authResult.error || 'Authentication failed', 401);
  }

  let payload: UserSyncPayload;
  try {
    payload = await readJson<UserSyncPayload>(request);
  } catch (error: any) {
    return errorResponse(error?.message ?? 'Invalid JSON payload', 400);
  }

  // Validate required fields
  if (!payload.id || !payload.email || !payload.name) {
    return errorResponse('User id, email, and name are required', 422);
  }

  // Ensure the authenticated user matches the payload user
  if (authResult.user!.id !== payload.id) {
    return errorResponse('User ID mismatch', 403);
  }

  const now = Date.now();

  try {
    // Upsert user in database
    const stmt = env.DB.prepare(`
      INSERT INTO users (
        id, email, name, google_id, profile_picture, created_at, updated_at, last_login
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        name = excluded.name,
        google_id = excluded.google_id,
        profile_picture = excluded.profile_picture,
        updated_at = excluded.updated_at,
        last_login = excluded.last_login
    `).bind(
      payload.id,
      payload.email,
      payload.name,
      payload.googleId ?? null,
      payload.profilePicture ?? null,
      now, // created_at
      now, // updated_at
      now  // last_login
    );

    await stmt.all();

    // Return the synced user data
    const userStmt = env.DB.prepare(`
      SELECT id, email, name, google_id, profile_picture, created_at, updated_at, last_login
      FROM users WHERE id = ?1
    `).bind(payload.id);

    const userResult = await userStmt.first<{
      id: string;
      email: string;
      name: string;
      google_id: string | null;
      profile_picture: string | null;
      created_at: number;
      updated_at: number;
      last_login: number | null;
    }>();

    if (!userResult) {
      return errorResponse('Failed to retrieve user data', 500);
    }

    return jsonResponse({
      user: {
        id: userResult.id,
        email: userResult.email,
        name: userResult.name,
        googleId: userResult.google_id,
        profilePicture: userResult.profile_picture,
        createdAt: userResult.created_at,
        updatedAt: userResult.updated_at,
        lastLogin: userResult.last_login,
      }
    });

  } catch (error) {
    console.error('Failed to sync user', error);
    return errorResponse('Failed to sync user data', 500);
  }
}