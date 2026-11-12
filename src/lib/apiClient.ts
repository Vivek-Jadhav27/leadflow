import { auth } from '@/lib/firebase';

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

async function getToken(forceRefresh = false): Promise<string | null> {
  await auth.authStateReady();
  const user = auth.currentUser;
  return user ? user.getIdToken(forceRefresh) : null;
}

async function request(path: string, method: string, body: unknown, token: string | null): Promise<Response> {
  return fetch(path, {
    method,
    cache: 'no-store',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/**
 * Authenticated JSON call to the app's own API. Always sends a fresh Firebase ID token as a Bearer
 * header (the SDK refreshes it automatically), retries once on 401 with a forced refresh, and turns
 * every non-2xx response into an ApiError carrying the server's message so callers can show it.
 */
export async function api<T = any>(
  path: string,
  options: { method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; body?: unknown } = {}
): Promise<T> {
  const method = options.method || 'GET';
  let token = await getToken();
  let res = await request(path, method, options.body, token);

  if (res.status === 401 && token) {
    token = await getToken(true);
    res = await request(path, method, options.body, token);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data?.error || `Request failed (${res.status})`, data?.code);
  }
  return data as T;
}

export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof TypeError) return 'Network error. Check your connection and try again.';
  return err instanceof Error && err.message ? err.message : fallback;
}
