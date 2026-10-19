export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api/v1";

/** Fetch helper used by every API module. Throws an Error carrying the server's message (and `code`, `status`). */
export class ApiRequestError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function request<T>(endpoint: string, token?: string | null, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers, credentials: "include" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiRequestError(data.message || `HTTP error ${response.status}`, response.status, data.code);
  return data as T;
}

/** Every successful API response is `{ error: false, data }`. */
export async function requestData<T>(endpoint: string, token?: string | null, options: RequestInit = {}): Promise<T> {
  return (await request<{ data: T }>(endpoint, token, options)).data;
}

export const jsonBody = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });

/** Query string from an object, skipping empty values. */
export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}
