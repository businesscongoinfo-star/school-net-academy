export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: unknown;
  signal?: AbortSignal;
};

const listeners = new Set<(status: number) => void>();

export function onUnauthorized(listener: (status: number) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const DEMO = import.meta.env.VITE_DEMO === '1';

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;

  if (DEMO) {
    try {
      const { demoRequest } = await import('../demo/mock');
      return await demoRequest<T>(method, path, body);
    } catch (error) {
      const status = (error as { status?: number }).status ?? 500;
      if (status === 401) listeners.forEach((listener) => listener(401));
      throw new ApiError((error as Error).message || 'Une erreur est survenue.', status);
    }
  }

  const res = await fetch(`/api${path}`, {
    method,
    signal,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    if (res.status === 401) listeners.forEach((l) => l(401));
    const message = (payload as { error?: string } | null)?.error ?? 'Une erreur est survenue.';
    throw new ApiError(message, res.status, (payload as { details?: unknown } | null)?.details);
  }
  return payload as T;
}

export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body });
export const patch = <T>(path: string, body?: unknown) => api<T>(path, { method: 'PATCH', body });
export const del = <T>(path: string) => api<T>(path, { method: 'DELETE' });

export function qs(params: Record<string, string | number | null | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const str = search.toString();
  return str ? `?${str}` : '';
}
