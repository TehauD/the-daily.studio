import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

/** GET with optional polling. Keeps the last good value on transient errors (stale data is marked, never faked). */
export function useApi<T>(path: string | null, intervalMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const alive = useRef(true);

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      const d = await api.get<T>(path);
      if (alive.current) { setData(d); setError(null); setUpdatedAt(Date.now()); }
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    alive.current = true;
    setData(null);
    void reload();
    if (!intervalMs) return () => { alive.current = false; };
    const t = window.setInterval(() => { if (!document.hidden) void reload(); }, intervalMs);
    return () => { alive.current = false; window.clearInterval(t); };
  }, [reload, intervalMs]);

  return { data, error, loading, reload, updatedAt };
}

/** Run an async action with busy/error state. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true); setError(null);
    try { return await fn(); }
    catch (e) { setError((e as Error).message); return undefined; }
    finally { setBusy(false); }
  }, []);
  return { busy, error, run, setError };
}

export function useHashRoute<K extends string>(keys: readonly K[], fallback: K): [K, (k: K) => void] {
  const read = useCallback(() => {
    const h = window.location.hash.replace(/^#\/?/, "").split("?")[0];
    return (keys.includes(h as K) ? h : fallback) as K;
  }, [keys, fallback]);
  const [k, setK] = useState<K>(read);
  useEffect(() => {
    const h = () => setK(read());
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, [read]);
  return [k, (next) => { window.location.hash = `/${next}`; }];
}
