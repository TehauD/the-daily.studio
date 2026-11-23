export class ApiError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
let token = null;
let tokenPromise = null;
/** Per-session token required on mutating requests (fetched same-origin; never persisted). */
async function getToken() {
    if (token)
        return token;
    tokenPromise ??= fetch("/api/system/session").then(async (r) => {
        if (!r.ok)
            throw new ApiError(r.status, "Could not obtain session token");
        token = (await r.json()).token;
        return token;
    }).finally(() => { tokenPromise = null; });
    return tokenPromise;
}
async function request(method, path, body, retry = true) {
    const headers = {};
    if (body !== undefined)
        headers["Content-Type"] = "application/json";
    if (method !== "GET")
        headers["X-Forge-Token"] = await getToken();
    const res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    if (res.status === 403 && method !== "GET" && retry) {
        token = null;
        return request(method, path, body, false);
    }
    if (!res.ok) {
        let detail = res.statusText;
        try {
            const j = await res.json();
            detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
        }
        catch { /* non-JSON error body */ }
        throw new ApiError(res.status, detail);
    }
    const ct = res.headers.get("content-type") || "";
    return (ct.includes("application/json") ? res.json() : res.text());
}
export const api = {
    get: (p) => request("GET", p),
    post: (p, b) => request("POST", p, b ?? {}),
    put: (p, b) => request("PUT", p, b ?? {}),
    del: (p, b) => request("DELETE", p, b),
};
export const qs = (o) => "?" + Object.entries(o).filter(([, v]) => v != null && v !== "").map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
const nf = (d) => new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmt = {
    params: (n) => (n == null ? "—" : n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n)),
    exact: (n) => (n == null ? "—" : n.toLocaleString("en-US")),
    bytes: (n) => (n == null ? "—" : n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(0)} MB` : `${(n / 1e3).toFixed(0)} KB`),
    mb: (n) => (n == null ? "—" : n >= 1024 ? `${(n / 1024).toFixed(2)} GB` : `${Math.round(n)} MB`),
    ctx: (n) => (n == null ? "—" : n >= 1024 ? `${Math.round(n / 1024)}K` : String(n)),
    time: (iso) => (iso ? new Date(iso).toLocaleString() : "never"),
    ago: (iso) => {
        if (!iso)
            return "never";
        const s = (Date.now() - new Date(iso).getTime()) / 1000;
        return s < 60 ? `${Math.round(s)}s ago` : s < 3600 ? `${Math.round(s / 60)}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`;
    },
    pct: (x, d = 1) => (x == null ? "—" : `${nf(d).format(x * 100)}%`),
    pp: (x, d = 1) => (x == null ? "—" : `${x >= 0 ? "+" : "−"}${nf(d).format(Math.abs(x * 100))} pp`),
    p: (x) => (x == null ? "—" : x < 0.0001 ? "< 0.0001" : x.toFixed(4)),
    fixed: (x, d = 3) => (x == null ? "—" : nf(d).format(x)),
    sha: (s, n = 12) => (s ? s.slice(0, n) : "—"),
};
