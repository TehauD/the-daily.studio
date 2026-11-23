import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Sparkline } from "./components/sparkline";
import { CommandPalette } from "./components/CommandPalette";
import { Icon } from "./components/icons";
import { AssistantDrawer } from "./components/AssistantDrawer";
import { JobDock } from "./components/JobDock";
import { StudySelect, TelemetryProvider, useTelemetry } from "./components/live";
import { AssistantProvider } from "./lib/assistant";
import { Kbd, Skeleton, cx } from "./components/ui";
import { api } from "./lib/api";
import { useApi, useHashRoute } from "./lib/hooks";
import { PrefsProvider, usePrefs } from "./lib/prefs";
const Home = lazy(() => import("./pages/Home"));
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
const Playground = lazy(() => import("./pages/Playground"));
const WeightLab = lazy(() => import("./pages/WeightLab"));
const ModelMap = lazy(() => import("./pages/ModelMap"));
/** Four workspaces, in the order people work: build it, see and steer it, measure it, run the lab. `expert` pages are hidden in Simple mode. */
const NAV = [
    { group: "", items: [{ key: "home", label: "Home", icon: "home" }] },
    { group: "Build", items: [
            { key: "agent-studio", label: "Agent Studio", icon: "agent" },
            { key: "knowledge-studio", label: "Knowledge Studio", icon: "layers" },
            { key: "studio", label: "Experiment Studio", icon: "studio" },
            { key: "datasets", label: "Dataset Factory", icon: "dataset", expert: true },
            { key: "training", label: "Training Lab", icon: "training", expert: true }
        ] },
    { group: "See & control", items: [
            { key: "playground", label: "Playground", icon: "play" },
            { key: "modelmap", label: "Model Map", icon: "map" },
            { key: "lens", label: "Distillation Lens", icon: "lens" },
            { key: "weightlab", label: "Weight Lab", icon: "sliders" },
            { key: "trajectories", label: "Trajectory Explorer", icon: "trajectory", expert: true },
            { key: "knowledge", label: "Knowledge Graph", icon: "graph", expert: true }
        ] },
    { group: "Measure", items: [
            { key: "evaluation", label: "Evaluation Lab", icon: "evaluation" }
        ] },
    { group: "Operate", items: [
            { key: "overview", label: "System Overview", icon: "overview", expert: true },
            { key: "observatory", label: "Model Observatory", icon: "observatory" },
            { key: "factory", label: "Model Factory", icon: "factory", expert: true },
            { key: "guide", label: "Guide", icon: "guide" },
            { key: "settings", label: "Settings", icon: "settings" }
        ] },
];
/** Workspace pages that lock to the viewport on wide screens (no page scroll; panels scroll inside). */
const FIT = new Set(["overview", "observatory", "studio", "trajectories", "evaluation", "knowledge", "knowledge-studio", "lens", "agent-studio", "playground", "weightlab", "modelmap"]);
const KEYS = NAV.flatMap((g) => g.items.map((i) => i.key));
const LABEL = Object.fromEntries(NAV.flatMap((g) => g.items.map((i) => [i.key, i.label])));
function InstrumentBar({ onMenu, onCommand }) {
    const { data } = useTelemetry();
    const { prefs, set } = usePrefs();
    const ov = useApi("/api/overview", 5000);
    const health = useApi("/api/system/health", 15000);
    const samples = (data?.samples ?? []).slice(-60);
    const last = samples.at(-1);
    const g = last?.gpus[0];
    const vramPct = g?.vram_used_mb != null && g.vram_total_mb ? (g.vram_used_mb / g.vram_total_mb) * 100 : null;
    const job = ov.data?.gpu_job;
    const readouts = g ? [
        { k: "GPU", v: g.util_pct != null ? `${g.util_pct.toFixed(0)}%` : "—", series: samples.map((s) => s.gpus[0]?.util_pct ?? null), max: 100 },
        { k: "VRAM", v: g.vram_used_mb != null ? `${(g.vram_used_mb / 1024).toFixed(1)}/${((g.vram_total_mb ?? 0) / 1024).toFixed(0)}G` : "—", series: samples.map((s) => (s.gpus[0]?.vram_used_mb != null && s.gpus[0]?.vram_total_mb ? (s.gpus[0].vram_used_mb / s.gpus[0].vram_total_mb) * 100 : null)), max: 100 },
        { k: "TEMP", v: g.temp_c != null ? `${g.temp_c.toFixed(0)}°C` : "—", series: samples.map((s) => s.gpus[0]?.temp_c ?? null), max: 100, hide: "max-xl:hidden" },
        { k: "PWR", v: g.power_w != null ? `${g.power_w.toFixed(0)}W` : "—", series: samples.map((s) => s.gpus[0]?.power_w ?? null), max: 320, hide: "max-xl:hidden" },
    ] : [
        { k: "CPU", v: last ? `${last.cpu_pct.toFixed(0)}%` : "—", series: samples.map((s) => s.cpu_pct), max: 100 },
        { k: "RAM", v: last ? `${(last.ram_used_mb / 1024).toFixed(1)}G` : "—", series: samples.map((s) => (s.ram_used_mb / s.ram_total_mb) * 100), max: 100 },
    ];
    return (_jsxs("header", { className: "sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-line bg-surface/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-surface/80 sm:px-4", children: [_jsx("button", { type: "button", className: "rounded p-1.5 text-ink-2 hover:bg-surface-3 lg:hidden", onClick: onMenu, "aria-label": "Open navigation", children: _jsx(Icon, { name: "sidebar" }) }), _jsx("div", { className: "hidden min-w-0 md:block", children: _jsx(StudySelect, { compact: true }) }), _jsxs("div", { className: "ml-auto flex min-w-0 items-center gap-4", children: [_jsxs("div", { className: "hidden items-center gap-4 sm:flex", "aria-label": "Live hardware readouts", children: [readouts.map((r) => (_jsxs("div", { className: cx("flex items-center gap-2", r.hide), title: `${r.k} · measured · nvidia-smi / psutil`, children: [_jsxs("div", { className: "leading-none", children: [_jsx("div", { className: "micro !text-[9px] text-ink-3", children: r.k }), _jsx("div", { className: "num mt-0.5 font-mono text-[12px] font-medium text-ink", children: r.v })] }), _jsx(Sparkline, { values: r.series, max: r.max, w: 46, h: 18 })] }, r.k))), vramPct != null && vramPct > 90 && _jsxs("span", { className: "micro text-crit-ink", children: ["VRAM ", vramPct.toFixed(0), "%"] })] }), _jsxs("div", { className: cx("hidden items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] md:flex", job ? "border-accent-line bg-accent-soft text-accent" : "border-line text-ink-3"), title: job ? `GPU job ${job.id}: ${job.label}` : "No GPU job running", children: [_jsx("span", { className: cx("h-1.5 w-1.5 rounded-full", job ? "live-dot bg-accent" : "bg-line-strong") }), job ? _jsx("span", { className: "max-w-[180px] truncate", children: job.label }) : "GPU idle"] }), _jsxs("button", { type: "button", onClick: onCommand, className: "hidden items-center gap-2 rounded-[var(--radius)] border border-line px-2 py-1 text-[11.5px] text-ink-3 hover:border-accent-line hover:text-ink md:flex", "aria-label": "Open command palette", children: [_jsx(Icon, { name: "search", size: 13 }), "Command ", _jsx(Kbd, { children: "Ctrl K" })] }), _jsx("button", { type: "button", onClick: () => set("theme", prefs.theme === "dark" ? "light" : "dark"), className: "rounded p-1.5 text-ink-2 hover:bg-surface-3", "aria-label": "Toggle theme", children: _jsx(Icon, { name: prefs.theme === "dark" ? "sun" : "moon" }) }), _jsxs("span", { className: "flex items-center gap-1.5 font-mono text-[10.5px] text-ink-3", title: "API health", children: [_jsx("span", { className: cx("h-1.5 w-1.5 rounded-full", health.data?.status === "ok" ? "bg-good" : health.error ? "bg-crit" : "bg-line-strong") }), _jsx("span", { className: "max-sm:hidden", children: health.data ? `v${health.data.version}` : health.error ? "offline" : "…" })] })] })] }));
}
function Sidebar({ route, go, open, onClose }) {
    const { prefs, set } = usePrefs();
    const collapsed = prefs.sidebarCollapsed && !open;
    return (_jsxs(_Fragment, { children: [open && _jsx("div", { className: "fixed inset-0 z-40 bg-black/30 lg:hidden", onClick: onClose, "aria-hidden": true }), _jsxs("aside", { className: cx("z-50 flex shrink-0 flex-col border-r border-line bg-surface transition-[width,transform] duration-200", "fixed inset-y-0 left-0 lg:sticky lg:top-0 lg:h-screen", open ? "translate-x-0" : "-translate-x-full lg:translate-x-0", collapsed ? "w-[60px]" : "w-[232px]"), "aria-label": "Primary", children: [_jsxs("div", { className: cx("flex h-12 items-center border-b border-line", collapsed ? "justify-center" : "gap-2.5 px-4"), children: [_jsxs("svg", { width: "22", height: "22", viewBox: "0 0 32 32", "aria-hidden": true, children: [_jsx("rect", { width: "32", height: "32", rx: "6", fill: "var(--ink)" }), _jsx("path", { d: "M9 23V9h14M9 16h9", stroke: "var(--accent)", strokeWidth: "3", fill: "none" })] }), !collapsed && (_jsxs("div", { className: "leading-none", children: [_jsx("div", { className: "font-mono text-[13px] font-semibold tracking-[0.32em] text-ink", children: "FORGE" }), _jsx("div", { className: "micro mt-1 !text-[8.5px] text-ink-3", children: "Agent lab \u00B7 local" })] }))] }), _jsx("nav", { className: "scroll-thin flex-1 overflow-y-auto px-2 py-3", children: NAV.map((g) => ({ ...g, items: g.items.filter((n) => prefs.mode === "expert" || !n.expert || n.key === route) })).map((g) => (_jsxs("div", { className: "mb-3", children: [!collapsed && g.group && _jsx("div", { className: "micro px-2.5 pb-1.5 !text-[9px] text-ink-3", children: g.group }), g.items.map((n) => (_jsxs("button", { type: "button", onClick: () => { go(n.key); onClose(); }, title: collapsed ? n.label : undefined, "aria-current": route === n.key ? "page" : undefined, className: cx("group relative mb-px flex h-8 w-full items-center gap-2.5 rounded-[calc(var(--radius)-1px)] text-left text-[12.5px] transition", collapsed ? "justify-center" : "px-2.5", route === n.key ? "bg-accent-soft font-medium text-ink" : "text-ink-2 hover:bg-surface-3 hover:text-ink"), children: [route === n.key && _jsx("span", { className: "absolute left-0 top-1.5 h-5 w-[2px] rounded-full bg-accent" }), _jsx(Icon, { name: n.icon, size: 16, className: route === n.key ? "text-accent" : "text-ink-3 group-hover:text-ink-2" }), !collapsed && n.label] }, n.key)))] }, g.group || "home"))) }), _jsxs("div", { className: "border-t border-line p-2", children: [_jsxs("button", { type: "button", onClick: () => set("sidebarCollapsed", !prefs.sidebarCollapsed), className: "hidden h-8 w-full items-center justify-center gap-2 rounded text-[11.5px] text-ink-3 hover:bg-surface-3 hover:text-ink lg:flex", "aria-label": "Collapse sidebar", children: [_jsx(Icon, { name: "sidebar", size: 15 }), !collapsed && "Collapse"] }), !collapsed && (_jsxs("div", { className: "mb-1 flex items-center justify-between gap-2 px-2.5 pt-1 text-[11px] text-ink-3", title: "Simple hides expert pages; Expert shows everything", children: [_jsx("span", { children: "Mode" }), _jsx("div", { className: "flex rounded-full border border-line p-0.5", role: "group", "aria-label": "Interface mode", children: ["simple", "expert"].map((m) => (_jsx("button", { type: "button", "aria-pressed": prefs.mode === m, onClick: () => set("mode", m), className: cx("rounded-full px-2 py-0.5 text-[10.5px] capitalize", prefs.mode === m ? "bg-accent-soft text-ink" : "text-ink-3 hover:text-ink"), children: m }, m))) })] })), !collapsed && _jsx("div", { className: "px-2.5 pb-1 pt-2 font-mono text-[9.5px] leading-relaxed text-ink-3", children: "loopback 127.0.0.1 \u00B7 no telemetry leaves this machine" })] })] })] }));
}
function Shell() {
    const [route, go] = useHashRoute(KEYS, "home");
    const [menu, setMenu] = useState(false);
    const [palette, setPalette] = useState(false);
    const { prefs, set } = usePrefs();
    useEffect(() => { document.title = `${LABEL[route]} · FORGE`; }, [route]);
    useEffect(() => {
        const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            setPalette((p) => !p);
        } };
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    }, []);
    const commands = useMemo(() => [
        ...KEYS.map((k) => ({ id: `go:${k}`, label: `Go to ${LABEL[k]}`, group: "Navigate", run: () => go(k) })),
        { id: "theme:light", label: "Theme: light", group: "Appearance", run: () => set("theme", "light") },
        { id: "theme:dark", label: "Theme: dark", group: "Appearance", run: () => set("theme", "dark") },
        { id: "theme:system", label: "Theme: follow system", group: "Appearance", run: () => set("theme", "system") },
        { id: "sidebar", label: prefs.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar", group: "Appearance", run: () => set("sidebarCollapsed", !prefs.sidebarCollapsed) },
        { id: "discover", label: "Run model discovery", group: "Actions", run: () => { void api.post("/api/models/discover"); go("observatory"); } },
        { id: "verify", label: "Verify GPU (forward/backward, BF16)", group: "Actions", run: () => { void api.post("/api/jobs/verify-gpu"); go("overview"); } },
    ], [go, set, prefs.sidebarCollapsed]);
    const Page = { home: Home, overview: Overview, observatory: Observatory, studio: Studio, trajectories: Trajectories, datasets: Datasets,
        training: Training, evaluation: Evaluation, knowledge: Knowledge, "knowledge-studio": KnowledgeStudio, lens: Lens, "agent-studio": AgentStudio, playground: Playground, weightlab: WeightLab, modelmap: ModelMap, factory: Factory, settings: Settings, guide: Guide }[route];
    return (_jsx(AssistantProvider, { route: route, children: _jsxs("div", { className: "flex min-h-full", children: [_jsx("a", { href: "#main", className: "sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[60] focus:rounded focus:bg-surface focus:px-3 focus:py-2", children: "Skip to content" }), _jsx(Sidebar, { route: route, go: go, open: menu, onClose: () => setMenu(false) }), _jsxs("div", { className: "flex min-w-0 flex-1 flex-col", children: [_jsx(InstrumentBar, { onMenu: () => setMenu(true), onCommand: () => setPalette(true) }), _jsx("main", { id: "main", className: cx("grid-plane min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 3xl:px-10", FIT.has(route) && "fit:h-[calc(100dvh-3rem)] fit:min-h-0 fit:flex-none fit:overflow-hidden fit:py-4"), children: _jsx("div", { className: cx("mx-auto w-full max-w-[3200px]", FIT.has(route) && "fit:h-full"), children: _jsx(Suspense, { fallback: _jsxs("div", { className: "space-y-3", children: [_jsx(Skeleton, { h: 28, w: 260 }), _jsx(Skeleton, { h: 180 }), _jsx(Skeleton, { h: 240 })] }), children: _jsx("div", { className: cx("fade-in", FIT.has(route) && "fit:h-full"), children: _jsx(Page, {}) }, route) }) }) })] }), palette && _jsx(CommandPalette, { commands: commands, onClose: () => setPalette(false) }), _jsx(JobDock, {}), _jsx(AssistantDrawer, {})] }) }));
}
export default function App() {
    return (_jsx(PrefsProvider, { children: _jsx(TelemetryProvider, { children: _jsx(Shell, {}) }) }));
}
