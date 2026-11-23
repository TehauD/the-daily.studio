import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
export const DEFAULT_PREFS = {
    theme: "light", accent: "teal", density: "standard", contrast: "standard", textScale: 1, radius: 6, grid: true,
    motion: "system", chartAnimation: true, telemetryPollMs: 2000, telemetryWindow: 120, sidebarCollapsed: false,
    activeStudy: null, showIneligible: false, mode: "simple", role: null,
};
const KEY = "forge.ui.v1";
function load() {
    try {
        return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
    }
    catch {
        return DEFAULT_PREFS;
    }
}
function resolvedTheme(t) {
    return t === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : t;
}
function apply(p) {
    const d = document.documentElement;
    d.dataset.theme = resolvedTheme(p.theme);
    d.dataset.accent = p.accent;
    d.dataset.density = p.density;
    d.dataset.contrast = p.contrast;
    d.dataset.grid = p.grid ? "on" : "off";
    d.dataset.motion = p.motion;
    d.style.setProperty("--text-scale", String(p.textScale));
    d.style.setProperty("--radius", `${p.radius}px`);
}
const PrefsCtx = createContext(null);
export function PrefsProvider({ children }) {
    const [prefs, setPrefs] = useState(load);
    useEffect(() => {
        apply(prefs);
        try {
            localStorage.setItem(KEY, JSON.stringify(prefs));
        }
        catch { /* private mode: prefs stay in memory */ }
    }, [prefs]);
    useEffect(() => {
        if (prefs.theme !== "system")
            return;
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        const h = () => apply(prefs);
        mq.addEventListener("change", h);
        return () => mq.removeEventListener("change", h);
    }, [prefs]);
    const set = useCallback((k, v) => setPrefs((p) => ({ ...p, [k]: v })), []);
    const replace = useCallback((p) => setPrefs((cur) => ({ ...cur, ...p })), []);
    const value = useMemo(() => ({ prefs, set, replace }), [prefs, set, replace]);
    return _jsx(PrefsCtx.Provider, { value: value, children: children });
}
export function usePrefs() {
    const c = useContext(PrefsCtx);
    if (!c)
        throw new Error("PrefsProvider missing");
    return c;
}
/** Live CSS variable values for charts; re-reads whenever theme/accent/contrast attributes change. */
export function useCssVars(names) {
    const read = useCallback(() => {
        const cs = getComputedStyle(document.documentElement);
        return Object.fromEntries(names.map((n) => [n, cs.getPropertyValue(`--${n}`).trim()]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [names.join("|")]);
    const [vals, setVals] = useState(read);
    useEffect(() => {
        const obs = new MutationObserver(() => setVals(read()));
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-accent", "data-contrast"] });
        setVals(read());
        return () => obs.disconnect();
    }, [read]);
    return vals;
}
export const CHART_VARS = ["ink", "ink-2", "ink-3", "line", "line-strong", "surface", "surface-2", "accent", "s-teacher",
    "s-base", "s-tuned", "good", "warn", "crit", "div-pos", "div-neg", "div-mid", "seq-0", "seq-1", "seq-2", "seq-3", "seq-4"];
export const useChartVars = () => useCssVars(CHART_VARS);
