import type { ApiError } from './types';

const apiBase = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) || '';
const API_BASE = apiBase ? apiBase.replace(/\/$/, '') : '';

interface RequestOptions extends RequestInit {
  parseJson?: boolean;
}

async function handleResponse<T>(response: Response, parseJson: boolean): Promise<T> {
  if (!response.ok) {
    let message = response.statusText || 'Request failed';
    try {
      const body = await response.json();
      if (body?.error) {
        message = body.error;
      }
    } catch {
      // ignore JSON parse errors
    }
    const error: ApiError = new Error(message);
    error.status = response.status;
    throw error;
  }

  if (!parseJson || response.status === 204) {
    return undefined as unknown as T;
  }

  return (await response.json()) as T;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const parseJson = options.parseJson ?? true;
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(options.headers || {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, { ...options, headers });
  return handleResponse<T>(response, parseJson);
}

export function withJsonBody(body: unknown): RequestInit {
  return {
    body: JSON.stringify(body),
  };
}
