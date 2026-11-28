import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/** UI preferences: localStorage `forge.ui.v1`, applied to <html> data attributes (see index.html pre-paint). */
export interface Prefs {
  theme: "light" | "dark" | "system";
  accent: "teal" | "cyan" | "green" | "blue" | "graphite";
  density: "compact" | "standard" | "comfortable";
  contrast: "standard" | "high";
  textScale: number;
  radius: number;
  grid: boolean;
  motion: "system" | "full" | "reduced";
  chartAnimation: boolean;
  telemetryPollMs: number;
  telemetryWindow: number;
  sidebarCollapsed: boolean;
  activeStudy: string | null;
  showIneligible: boolean;
  /** Simple hides expert pages (datasets, raw trajectories…); Expert shows everything. */
  mode: "simple" | "expert";
  /** Role chosen on Home, for the guided tour. */
  role: string | null;
  /** Model shown in the Model Hub and the inspector. */
  activeModel: string | null;
}

export const DEFAULT_PREFS: Prefs = {
  theme: "light", accent: "teal", density: "standard", contrast: "standard", textScale: 1, radius: 6, grid: true,
  motion: "system", chartAnimation: true, telemetryPollMs: 2000, telemetryWindow: 120, sidebarCollapsed: false,
  activeStudy: null, showIneligible: false, mode: "simple", role: null, activeModel: null,
};
const KEY = "forge.ui.v1";

function load(): Prefs {
  try { return { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<Prefs>) }; }
  catch { return DEFAULT_PREFS; }
}

function resolvedTheme(t: Prefs["theme"]): "light" | "dark" {
  return t === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : t;
}

function apply(p: Prefs) {
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

interface Ctx { prefs: Prefs; set: <K extends keyof Prefs>(k: K, v: Prefs[K]) => void; replace: (p: Partial<Prefs>) => void }
const PrefsCtx = createContext<Ctx | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(load);
  useEffect(() => {
    apply(prefs);
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* private mode: prefs stay in memory */ }
  }, [prefs]);
  useEffect(() => {
    if (prefs.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h = () => apply(prefs);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, [prefs]);
  const set = useCallback(<K extends keyof Prefs>(k: K, v: Prefs[K]) => setPrefs((p) => ({ ...p, [k]: v })), []);
  const replace = useCallback((p: Partial<Prefs>) => setPrefs((cur) => ({ ...cur, ...p })), []);
  const value = useMemo(() => ({ prefs, set, replace }), [prefs, set, replace]);
  return <PrefsCtx.Provider value={value}>{children}</PrefsCtx.Provider>;
}

export function usePrefs(): Ctx {
  const c = useContext(PrefsCtx);
  if (!c) throw new Error("PrefsProvider missing");
  return c;
}

/** Live CSS variable values for charts; re-reads whenever theme/accent/contrast attributes change. */
export function useCssVars<T extends string>(names: readonly T[]): Record<T, string> {
  const read = useCallback(() => {
    const cs = getComputedStyle(document.documentElement);
    return Object.fromEntries(names.map((n) => [n, cs.getPropertyValue(`--${n}`).trim()])) as Record<T, string>;
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
  "s-base", "s-tuned", "good", "warn", "crit", "div-pos", "div-neg", "div-mid", "seq-0", "seq-1", "seq-2", "seq-3", "seq-4"] as const;
export type ChartVars = Record<(typeof CHART_VARS)[number], string>;
export const useChartVars = () => useCssVars(CHART_VARS);
