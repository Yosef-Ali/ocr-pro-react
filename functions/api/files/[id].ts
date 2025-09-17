import { jsonResponse, errorResponse, methodNotAllowed } from '../../utils/http';

type Env = {
  DB: D1Database;
};

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const fileId = params?.id as string | undefined;
  if (!fileId) {
    return errorResponse('File ID missing', 400);
  }

  switch (request.method.toUpperCase()) {
    case 'GET':
      return getFile(env, fileId);
    case 'DELETE':
      return deleteFile(env, fileId);
    default:
      return methodNotAllowed();
  }
};

async function getFile(env: Env, fileId: string): Promise<Response> {
  const file = await env.DB.prepare(
    `SELECT id, project_id, name, size, mime_type, status, preview, original_preview,
            created_at, updated_at
       FROM files WHERE id = ?1`
  ).bind(fileId).first();

  if (!file) {
    return errorResponse('File not found', 404);
  }

  return jsonResponse({ file });
}

async function deleteFile(env: Env, fileId: string): Promise<Response> {
  try {
    await env.DB.prepare('DELETE FROM results WHERE file_id = ?1').bind(fileId).run();
    await env.DB.prepare('DELETE FROM files WHERE id = ?1').bind(fileId).run();
  } catch (error) {
    console.error('Failed to delete file', error);
    return errorResponse('Failed to delete file', 500);
  }

  return jsonResponse({ success: true });
}
