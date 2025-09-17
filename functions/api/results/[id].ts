import { jsonResponse, errorResponse, methodNotAllowed } from '../../utils/http';

type Env = {
  DB: D1Database;
};

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const resultId = params?.id as string | undefined;
  if (!resultId) {
    return errorResponse('Result ID missing', 400);
  }

  switch (request.method.toUpperCase()) {
    case 'DELETE':
      return deleteResult(env, resultId);
    case 'GET':
      return getResult(env, resultId);
    default:
      return methodNotAllowed();
  }
};

async function getResult(env: Env, resultId: string): Promise<Response> {
  const result = await env.DB.prepare(
    `SELECT id, file_id, project_id, extracted_text, layout_preserved, detected_language,
            confidence, document_type, metadata, created_at, updated_at
       FROM results WHERE id = ?1`
  ).bind(resultId).first();

  if (!result) {
    return errorResponse('Result not found', 404);
  }

  return jsonResponse({ result });
}

async function deleteResult(env: Env, resultId: string): Promise<Response> {
  try {
    await env.DB.prepare('DELETE FROM results WHERE id = ?1').bind(resultId).run();
  } catch (error) {
    console.error('Failed to delete result', error);
    return errorResponse('Failed to delete result', 500);
  }

  return jsonResponse({ success: true });
}
