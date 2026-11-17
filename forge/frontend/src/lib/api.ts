export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch { /* non-JSON error body */ }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T,>(p: string) => request<T>("GET", p),
  post: <T,>(p: string, b?: unknown) => request<T>("POST", p, b ?? {}),
  put: <T,>(p: string, b?: unknown) => request<T>("PUT", p, b ?? {}),
  del: <T,>(p: string, b?: unknown) => request<T>("DELETE", p, b),
};

export const fmt = {
  params: (n: number | null) => (n == null ? "—" : n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : `${(n / 1e6).toFixed(0)}M`),
  bytes: (n: number | null) => (n == null ? "—" : n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : `${(n / 1e6).toFixed(0)} MB`),
  mb: (n: number | null | undefined) => (n == null ? "—" : n >= 1024 ? `${(n / 1024).toFixed(1)} GB` : `${Math.round(n)} MB`),
  ctx: (n: number | null) => (n == null ? "—" : n >= 1024 ? `${Math.round(n / 1024)}K` : String(n)),
  time: (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "never"),
};
