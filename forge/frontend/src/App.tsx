import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Sparkline } from "./components/sparkline";
import { CommandPalette, type Command } from "./components/CommandPalette";
import { Icon, type IconName } from "./components/icons";
import { StudySelect, TelemetryProvider, useTelemetry } from "./components/live";
import { Kbd, Skeleton, cx } from "./components/ui";
import { api } from "./lib/api";
import { useApi, useHashRoute } from "./lib/hooks";
import { PrefsProvider, usePrefs } from "./lib/prefs";
import type { OverviewT } from "./lib/types";

const Overview = lazy(() => import("./pages/Overview"));
const Observatory = lazy(() => import("./pages/Observatory"));
const Studio = lazy(() => import("./pages/Studio"));
const Trajectories = lazy(() => import("./pages/Trajectories"));
const Datasets = lazy(() => import("./pages/Datasets"));
const Training = lazy(() => import("./pages/Training"));
const Evaluation = lazy(() => import("./pages/Evaluation"));
const Factory = lazy(() => import("./pages/Factory"));
const Settings = lazy(() => import("./pages/Settings"));
const Guide = lazy(() => import("./pages/guide/Guide"));
const Knowledge = lazy(() => import("./pages/Knowledge"));
const KnowledgeStudio = lazy(() => import("./pages/KnowledgeStudio"));
const Lens = lazy(() => import("./pages/Lens"));
const AgentStudio = lazy(() => import("./pages/AgentStudio"));

const NAV = [
  { group: "Orientation", items: [{ key: "guide", label: "Guide", icon: "guide" }, { key: "overview", label: "Overview", icon: "overview" }] },
  { group: "Models", items: [{ key: "observatory", label: "Model Observatory", icon: "observatory" }] },
  { group: "Research", items: [
    { key: "agent-studio", label: "Agent Studio", icon: "agent" },
    { key: "knowledge-studio", label: "Knowledge Studio", icon: "layers" },
    { key: "studio", label: "Experiment Studio", icon: "studio" }, { key: "trajectories", label: "Trajectory Explorer", icon: "trajectory" },
    { key: "datasets", label: "Dataset Factory", icon: "dataset" }, { key: "training", label: "Training Lab", icon: "training" },
    { key: "evaluation", label: "Evaluation Lab", icon: "evaluation" }, { key: "knowledge", label: "Knowledge Graph", icon: "graph" },
    { key: "lens", label: "Distillation Lens", icon: "lens" },
    { key: "factory", label: "Model Factory", icon: "factory" }] },
  { group: "System", items: [{ key: "settings", label: "System Settings", icon: "settings" }] },
] as const;
type Key = (typeof NAV)[number]["items"][number]["key"];
/** Workspace pages that lock to the viewport on wide screens (no page scroll; panels scroll inside). */
const FIT = new Set<string>(["overview", "observatory", "studio", "trajectories", "evaluation", "knowledge", "knowledge-studio", "lens", "agent-studio"]);
const KEYS = NAV.flatMap((g) => g.items.map((i) => i.key)) as Key[];
const LABEL = Object.fromEntries(NAV.flatMap((g) => g.items.map((i) => [i.key, i.label]))) as Record<Key, string>;

function InstrumentBar({ onMenu, onCommand }: { onMenu: () => void; onCommand: () => void }) {
  const { data } = useTelemetry();
  const { prefs, set } = usePrefs();
  const ov = useApi<OverviewT>("/api/overview", 5000);
  const health = useApi<{ status: string; version: string }>("/api/system/health", 15000);
  const samples = (data?.samples ?? []).slice(-60);
  const last = samples.at(-1);
  const g = last?.gpus[0];
  const vramPct = g?.vram_used_mb != null && g.vram_total_mb ? (g.vram_used_mb / g.vram_total_mb) * 100 : null;
  const job = ov.data?.gpu_job;
  const readouts: { k: string; v: string; series: (number | null)[]; max: number; hide?: string }[] = g ? [
    { k: "GPU", v: g.util_pct != null ? `${g.util_pct.toFixed(0)}%` : "—", series: samples.map((s) => s.gpus[0]?.util_pct ?? null), max: 100 },
    { k: "VRAM", v: g.vram_used_mb != null ? `${(g.vram_used_mb / 1024).toFixed(1)}/${((g.vram_total_mb ?? 0) / 1024).toFixed(0)}G` : "—", series: samples.map((s) => (s.gpus[0]?.vram_used_mb != null && s.gpus[0]?.vram_total_mb ? (s.gpus[0].vram_used_mb! / s.gpus[0].vram_total_mb!) * 100 : null)), max: 100 },
    { k: "TEMP", v: g.temp_c != null ? `${g.temp_c.toFixed(0)}°C` : "—", series: samples.map((s) => s.gpus[0]?.temp_c ?? null), max: 100, hide: "max-xl:hidden" },
    { k: "PWR", v: g.power_w != null ? `${g.power_w.toFixed(0)}W` : "—", series: samples.map((s) => s.gpus[0]?.power_w ?? null), max: 320, hide: "max-xl:hidden" },
  ] : [
    { k: "CPU", v: last ? `${last.cpu_pct.toFixed(0)}%` : "—", series: samples.map((s) => s.cpu_pct), max: 100 },
    { k: "RAM", v: last ? `${(last.ram_used_mb / 1024).toFixed(1)}G` : "—", series: samples.map((s) => (s.ram_used_mb / s.ram_total_mb) * 100), max: 100 },
  ];
  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-line bg-surface/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-surface/80 sm:px-4">
      <button type="button" className="rounded p-1.5 text-ink-2 hover:bg-surface-3 lg:hidden" onClick={onMenu} aria-label="Open navigation"><Icon name="sidebar" /></button>
      <div className="hidden min-w-0 md:block"><StudySelect compact /></div>
      <div className="ml-auto flex min-w-0 items-center gap-4">
        <div className="hidden items-center gap-4 sm:flex" aria-label="Live hardware readouts">
          {readouts.map((r) => (
            <div key={r.k} className={cx("flex items-center gap-2", r.hide)} title={`${r.k} · measured · nvidia-smi / psutil`}>
              <div className="leading-none">
                <div className="micro !text-[9px] text-ink-3">{r.k}</div>
                <div className="num mt-0.5 font-mono text-[12px] font-medium text-ink">{r.v}</div>
              </div>
              <Sparkline values={r.series} max={r.max} w={46} h={18} />
            </div>
          ))}
          {vramPct != null && vramPct > 90 && <span className="micro text-crit-ink">VRAM {vramPct.toFixed(0)}%</span>}
        </div>
        <div className={cx("hidden items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] md:flex", job ? "border-accent-line bg-accent-soft text-accent" : "border-line text-ink-3")}
          title={job ? `GPU job ${job.id}: ${job.label}` : "No GPU job running"}>
          <span className={cx("h-1.5 w-1.5 rounded-full", job ? "live-dot bg-accent" : "bg-line-strong")} />
          {job ? <span className="max-w-[180px] truncate">{job.label}</span> : "GPU idle"}
        </div>
        <button type="button" onClick={onCommand} className="hidden items-center gap-2 rounded-[var(--radius)] border border-line px-2 py-1 text-[11.5px] text-ink-3 hover:border-accent-line hover:text-ink md:flex" aria-label="Open command palette">
          <Icon name="search" size={13} />Command <Kbd>Ctrl K</Kbd>
        </button>
        <button type="button" onClick={() => set("theme", prefs.theme === "dark" ? "light" : "dark")} className="rounded p-1.5 text-ink-2 hover:bg-surface-3" aria-label="Toggle theme">
          <Icon name={prefs.theme === "dark" ? "sun" : "moon"} />
        </button>
        <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-ink-3" title="API health">
          <span className={cx("h-1.5 w-1.5 rounded-full", health.data?.status === "ok" ? "bg-good" : health.error ? "bg-crit" : "bg-line-strong")} />
          <span className="max-sm:hidden">{health.data ? `v${health.data.version}` : health.error ? "offline" : "…"}</span>
        </span>
      </div>
    </header>
  );
}

function Sidebar({ route, go, open, onClose }: { route: Key; go: (k: Key) => void; open: boolean; onClose: () => void }) {
  const { prefs, set } = usePrefs();
  const collapsed = prefs.sidebarCollapsed && !open;
  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={onClose} aria-hidden />}
      <aside className={cx("z-50 flex shrink-0 flex-col border-r border-line bg-surface transition-[width,transform] duration-200",
        "fixed inset-y-0 left-0 lg:sticky lg:top-0 lg:h-screen", open ? "translate-x-0" : "-translate-x-full lg:translate-x-0", collapsed ? "w-[60px]" : "w-[232px]")}
        aria-label="Primary">
        <div className={cx("flex h-12 items-center border-b border-line", collapsed ? "justify-center" : "gap-2.5 px-4")}>
          <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden><rect width="32" height="32" rx="6" fill="var(--ink)" /><path d="M9 23V9h14M9 16h9" stroke="var(--accent)" strokeWidth="3" fill="none" /></svg>
          {!collapsed && (
            <div className="leading-none">
              <div className="font-mono text-[13px] font-semibold tracking-[0.32em] text-ink">FORGE</div>
              <div className="micro mt-1 !text-[8.5px] text-ink-3">Distillation lab · local</div>
            </div>
          )}
        </div>
        <nav className="scroll-thin flex-1 overflow-y-auto px-2 py-3">
          {NAV.map((g) => (
            <div key={g.group} className="mb-3">
              {!collapsed && <div className="micro px-2.5 pb-1.5 !text-[9px] text-ink-3">{g.group}</div>}
              {g.items.map((n) => (
                <button key={n.key} type="button" onClick={() => { go(n.key); onClose(); }} title={collapsed ? n.label : undefined}
                  aria-current={route === n.key ? "page" : undefined}
                  className={cx("group relative mb-px flex h-8 w-full items-center gap-2.5 rounded-[calc(var(--radius)-1px)] text-left text-[12.5px] transition",
                    collapsed ? "justify-center" : "px-2.5",
                    route === n.key ? "bg-accent-soft font-medium text-ink" : "text-ink-2 hover:bg-surface-3 hover:text-ink")}>
                  {route === n.key && <span className="absolute left-0 top-1.5 h-5 w-[2px] rounded-full bg-accent" />}
                  <Icon name={n.icon as IconName} size={16} className={route === n.key ? "text-accent" : "text-ink-3 group-hover:text-ink-2"} />
                  {!collapsed && n.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-line p-2">
          <button type="button" onClick={() => set("sidebarCollapsed", !prefs.sidebarCollapsed)} className="hidden h-8 w-full items-center justify-center gap-2 rounded text-[11.5px] text-ink-3 hover:bg-surface-3 hover:text-ink lg:flex" aria-label="Collapse sidebar">
            <Icon name="sidebar" size={15} />{!collapsed && "Collapse"}
          </button>
          {!collapsed && <div className="px-2.5 pb-1 pt-2 font-mono text-[9.5px] leading-relaxed text-ink-3">loopback 127.0.0.1 · no telemetry leaves this machine</div>}
        </div>
      </aside>
    </>
  );
}

function Shell() {
  const [route, go] = useHashRoute(KEYS, "overview");
  const [menu, setMenu] = useState(false);
  const [palette, setPalette] = useState(false);
  const { prefs, set } = usePrefs();
  useEffect(() => { document.title = `${LABEL[route]} · FORGE`; }, [route]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  const commands = useMemo<Command[]>(() => [
    ...KEYS.map((k) => ({ id: `go:${k}`, label: `Go to ${LABEL[k]}`, group: "Navigate", run: () => go(k) })),
    { id: "theme:light", label: "Theme: light", group: "Appearance", run: () => set("theme", "light") },
    { id: "theme:dark", label: "Theme: dark", group: "Appearance", run: () => set("theme", "dark") },
    { id: "theme:system", label: "Theme: follow system", group: "Appearance", run: () => set("theme", "system") },
    { id: "sidebar", label: prefs.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar", group: "Appearance", run: () => set("sidebarCollapsed", !prefs.sidebarCollapsed) },
    { id: "discover", label: "Run model discovery", group: "Actions", run: () => { void api.post("/api/models/discover"); go("observatory"); } },
    { id: "verify", label: "Verify GPU (forward/backward, BF16)", group: "Actions", run: () => { void api.post("/api/jobs/verify-gpu"); go("overview"); } },
  ], [go, set, prefs.sidebarCollapsed]);
  const Page = { overview: Overview, observatory: Observatory, studio: Studio, trajectories: Trajectories, datasets: Datasets,
    training: Training, evaluation: Evaluation, knowledge: Knowledge, "knowledge-studio": KnowledgeStudio, lens: Lens, "agent-studio": AgentStudio, factory: Factory, settings: Settings, guide: Guide }[route];
  return (
    <div className="flex min-h-full">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[60] focus:rounded focus:bg-surface focus:px-3 focus:py-2">Skip to content</a>
      <Sidebar route={route} go={go} open={menu} onClose={() => setMenu(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <InstrumentBar onMenu={() => setMenu(true)} onCommand={() => setPalette(true)} />
        <main id="main" className={cx("grid-plane min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 3xl:px-10",
          FIT.has(route) && "fit:h-[calc(100dvh-3rem)] fit:min-h-0 fit:flex-none fit:overflow-hidden fit:py-4")}>
          <div className={cx("mx-auto w-full max-w-[3200px]", FIT.has(route) && "fit:h-full")}>
            <Suspense fallback={<div className="space-y-3"><Skeleton h={28} w={260} /><Skeleton h={180} /><Skeleton h={240} /></div>}>
              <div key={route} className={cx("fade-in", FIT.has(route) && "fit:h-full")}><Page /></div>
            </Suspense>
          </div>
        </main>
      </div>
      {palette && <CommandPalette commands={commands} onClose={() => setPalette(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <PrefsProvider>
      <TelemetryProvider>
        <Shell />
      </TelemetryProvider>
    </PrefsProvider>
  );
}
