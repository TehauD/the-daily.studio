import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
/** GET with optional polling. Keeps the last good value on transient errors (stale data is marked, never faked). */
export function useApi(path, intervalMs) {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [updatedAt, setUpdatedAt] = useState(null);
    const alive = useRef(true);
    const reload = useCallback(async () => {
        if (!path)
            return;
        setLoading(true);
        try {
            const d = await api.get(path);
            if (alive.current) {
                setData(d);
                setError(null);
                setUpdatedAt(Date.now());
            }
        }
        catch (e) {
            if (alive.current)
                setError(e.message);
        }
        finally {
            if (alive.current)
                setLoading(false);
        }
    }, [path]);
    useEffect(() => {
        alive.current = true;
        setData(null);
        void reload();
        if (!intervalMs)
            return () => { alive.current = false; };
        const t = window.setInterval(() => { if (!document.hidden)
            void reload(); }, intervalMs);
        return () => { alive.current = false; window.clearInterval(t); };
    }, [reload, intervalMs]);
    return { data, error, loading, reload, updatedAt };
}
/** Run an async action with busy/error state. */
export function useAction() {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const run = useCallback(async (fn) => {
        setBusy(true);
        setError(null);
        try {
            return await fn();
        }
        catch (e) {
            setError(e.message);
            return undefined;
        }
        finally {
            setBusy(false);
        }
    }, []);
    return { busy, error, run, setError };
}
export function useHashRoute(keys, fallback) {
    const read = useCallback(() => {
        const h = window.location.hash.replace(/^#\/?/, "").split("?")[0];
        return (keys.includes(h) ? h : fallback);
    }, [keys, fallback]);
    const [k, setK] = useState(read);
    useEffect(() => {
        const h = () => setK(read());
        window.addEventListener("hashchange", h);
        return () => window.removeEventListener("hashchange", h);
    }, [read]);
    return [k, (next) => { window.location.hash = `/${next}`; }];
}
