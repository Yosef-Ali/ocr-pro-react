export function jsonResponse(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...init.headers,
    },
    status: init.status ?? 200,
  });
}

export function errorResponse(message: string, status = 400, extra?: Record<string, unknown>): Response {
  return jsonResponse({ error: message, ...(extra ?? {}) }, { status });
}

export async function readJson<T>(request: Request): Promise<T> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error('Expected application/json request body');
  }
  return (await request.json()) as T;
}

export const methodNotAllowed = () => errorResponse('Method not allowed', 405);
