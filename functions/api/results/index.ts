import { jsonResponse, methodNotAllowed } from '../../utils/http';

type Env = {
  DB: D1Database;
};

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId');
  const fileId = url.searchParams.get('fileId');

  switch (request.method.toUpperCase()) {
    case 'GET':
      return listResults(env, { projectId, fileId });
    default:
      return methodNotAllowed();
  }
};

type Filters = {
  projectId: string | null;
  fileId: string | null;
};

async function listResults(env: Env, filters: Filters): Promise<Response> {
  let stmt: D1PreparedStatement;
  if (filters.fileId) {
    stmt = env.DB.prepare(
      `SELECT id, file_id, project_id, extracted_text, layout_preserved, detected_language,
              confidence, document_type, metadata, created_at, updated_at
         FROM results WHERE file_id = ?1`
    ).bind(filters.fileId);
  } else if (filters.projectId) {
    stmt = env.DB.prepare(
      `SELECT id, file_id, project_id, extracted_text, layout_preserved, detected_language,
              confidence, document_type, metadata, created_at, updated_at
         FROM results WHERE project_id = ?1`
    ).bind(filters.projectId);
  } else {
    stmt = env.DB.prepare(
      `SELECT id, file_id, project_id, extracted_text, layout_preserved, detected_language,
              confidence, document_type, metadata, created_at, updated_at
         FROM results`
    );
  }

  const results = await stmt.all();
  return jsonResponse({ results: results.results ?? [] });
}
