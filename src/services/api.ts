export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

type RequestOptions = {
  method?: string;
  token?: string | null;
  body?: unknown;
};

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function handleAuthFailure(status: number) {
  if ((status === 401 || status === 403) && unauthorizedHandler) {
    unauthorizedHandler();
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (options.token) {
      handleAuthFailure(response.status);
    }
    throw new Error(data?.message || "Erro na requisicao.");
  }

  return data as T;
}
