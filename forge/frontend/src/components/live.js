import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { api, fmt, qs } from "../lib/api";
import { useApi } from "../lib/hooks";
import { usePrefs } from "../lib/prefs";
import { Icon } from "./icons";
import { Button, Status, cx, inputCls } from "./ui";
const TCtx = createContext({ data: null, error: null, updatedAt: null });
export function TelemetryProvider({ children }) {
    const { prefs } = usePrefs();
    const t = useApi("/api/system/telemetry", prefs.telemetryPollMs);
    return _jsx(TCtx.Provider, { value: { data: t.data, error: t.error, updatedAt: t.updatedAt }, children: children });
}
export const useTelemetry = () => useContext(TCtx);
/* ------------------------------------------------------------- job log (incremental tail) */
const KEEP = 600;
function describe(e) {
    switch (e.event) {
        case "episode": return { text: `${e.arm}/${e.split}/s${e.seed} ${e.task_id} → ${e.strict_success ? "strict ✓" : "✕"} (${e.progress})`, tone: e.strict_success ? "default" : "muted" };
        case "log": return { text: `step ${e.step} · loss ${typeof e.loss === "number" ? e.loss.toFixed(4) : "—"}${e.eval_loss != null ? ` · dev ${e.eval_loss.toFixed(4)}` : ""} · ${e.tokens_seen} tok · ${e.tokens_per_s ?? "—"} tok/s${e.peak_vram_mb ? ` · peak ${fmt.mb(e.peak_vram_mb)}` : ""}`, tone: "default" };
        case "error": return { text: `ERROR ${e.error}`, tone: "crit" };
        case "stage_completed": return { text: `stage ${e.stage} completed`, tone: "good" };
        case "stage_start": return { text: `stage ${e.stage} started · ${e.python}`, tone: "default" };
        case "preflight_passed": return { text: `pre-flight passed (${e.checks.length} checks)`, tone: "good" };
        case "gates_passed": return { text: `gates passed · zero-adapter max|Δlogit| = ${e.zero_adapter_max_abs_diff} · trainable ${fmt.exact(e.trainable_params)} / ${fmt.exact(e.total_params)}`, tone: "good" };
        case "tokenized": return { text: `tokenized ${e.records} records · ${e.supervised_tokens} supervised tokens · max len ${e.max_len}`, tone: "default" };
        case "trained": return { text: `adapter saved · sha256 ${String(e.adapter_sha256).slice(0, 16)} · ${e.global_step} steps`, tone: "good" };
        case "pack_step_start": return { text: `${e.step} started · ${e.pack}`, tone: "default" };
        case "pack_step_completed": return { text: `${e.step} completed · ${JSON.stringify(e.result).slice(0, 200)}`, tone: "good" };
        case "imported": return { text: `imported ${e.documents} documents → ${e.passages} passages (${e.skipped} files skipped)`, tone: "good" };
        case "embedded": return { text: `embedded ${e.done}/${e.total} passages`, tone: "muted" };
        case "indexed": return { text: `index ready · ${e.mode}${e.model ? ` · ${e.model} (${e.dim} dims)` : ""}`, tone: "good" };
        case "question": return { text: `question ${e.done}/${e.total} · ${e.accepted} accepted · ${e.rejected} rejected`, tone: "muted" };
        case "backend_retry": return { text: `model server trouble (${e.kind}) — retry ${e.attempt}/${e.of} in ${e.wait_s}s · ${String(e.detail).slice(0, 160)}`, tone: "muted" };
        case "keep_awake": return { text: String(e.detail), tone: "muted" };
        case "hardware_guard": return { text: `hardware guard · pause ≥ ${e.max_temp_c} °C, resume ≤ ${e.resume_temp_c} °C · ${e.threads} CPU threads${e.low_priority ? " · low priority" : ""}${e.enabled ? "" : " · thermal pause OFF"}`, tone: "muted" };
        case "thermal_pause": return { text: `GPU at ${e.temp_c} °C — pausing at a safe point until ≤ ${e.resume_c} °C (results unaffected)`, tone: "crit" };
        case "thermal_resume": return { text: `cooled to ${e.temp_c ?? "—"} °C after ${e.paused_s}s — resuming`, tone: "good" };
        case "hardware_summary": return { text: `energy ${e.energy_wh} Wh${e.avg_power_w ? ` · avg ${e.avg_power_w} W` : ""}${e.peak_temp_c != null ? ` · peak ${e.peak_temp_c} °C` : " · GPU not measured"} · paused ${e.paused_s}s (${e.thermal_pauses}×) · ${e.wall_s}s wall`, tone: "muted" };
        case "lens_start": return { text: `lens ${e.arm} s${e.seed}: ${e.episodes} dev episodes · ${e.records} teacher turns · ${e.tokens} tokens`, tone: "default" };
        case "lens_point": return { text: `${e.label}${e.total ? ` (${e.done}/${e.total})` : ""} · surprise ${e.nll.toFixed(3)} nats/token · same top guess ${fmt.pct(e.agreement, 1)}`, tone: "default" };
        case "lens_done": return { text: `lens saved · ${e.points} points`, tone: "good" };
        case "dataset": return { text: `dataset ${e.arm}: ${e.records} records from ${e.episodes_used} episodes`, tone: "default" };
        case undefined: return { text: e.text ?? "", tone: "muted" };
        default: return { text: `${e.event} ${JSON.stringify(Object.fromEntries(Object.entries(e).filter(([k]) => !["ts", "event"].includes(k)))).slice(0, 220)}`, tone: "default" };
    }
}
function eventTime(e) {
    if (typeof e.ts === "number")
        return new Date(e.ts * 1000);
    if (typeof e.ts === "string") {
        const d = new Date(e.ts);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
}
/** Third-party progress-bar / dict noise (tqdm, Trainer printouts) that older engines wrote to stdout. */
const NOISE = /(\d+%\|)|(\d+\/\d+ \[\d\d:\d\d)|^\{'(loss|train_runtime|eval_loss)'/;
function fmtDur(s) {
    if (!Number.isFinite(s) || s < 0)
        return "—";
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.round(s % 60);
    return h ? `${h}h ${m}m` : m ? `${m}m ${sec}s` : `${sec}s`;
}
/** Live summary derived from the event stream: stage, episode progress + ETA, latest training step. */
function Progress({ lines, running }) {
    let stage = null, ep = null, log = null, train = null;
    const counted = [...lines].reverse().find((l) => (l.e.event === "question" || l.e.event === "embedded") && typeof l.e.done === "number");
    for (let i = lines.length - 1; i >= 0 && !(stage && ep && log && train); i--) {
        const e = lines[i].e;
        if (!stage && (e.event === "stage_start" || e.event === "pack_step_start"))
            stage = String(e.stage ?? e.step);
        if (!ep && e.event === "episode")
            ep = e;
        if (!log && e.event === "log" && e.step != null)
            log = e;
        if (!train && e.event === "train_start")
            train = e;
    }
    let bar = null;
    if (ep && typeof ep.progress === "string") {
        const [d, t] = ep.progress.split("/").map(Number);
        // Rate from episodes of the same arm/split in this log (resumed runs: only what this process did).
        const same = lines.filter((l) => l.e.event === "episode" && l.e.arm === ep.arm && l.e.split === ep.split);
        const t0 = eventTime(same[0].e), t1 = eventTime(same[same.length - 1].e);
        const per = same.length > 1 && t0 && t1 ? (t1.getTime() - t0.getTime()) / 1000 / (same.length - 1) : null;
        bar = { done: d, total: t, label: `${ep.arm} · ${ep.split}${ep.arm !== "teacher" && ep.arm !== "base" ? ` · seed ${ep.seed}` : ""}`,
            eta: per && running ? `${per.toFixed(1)} s/episode · ~${fmtDur((t - d) * per)} left in this split` : per ? `${per.toFixed(1)} s/episode` : null };
    }
    if (!bar && counted) {
        const c = counted.e, same = lines.filter((l) => l.e.event === c.event);
        const t0 = eventTime(same[0].e), t1 = eventTime(c);
        const per = same.length > 1 && t0 && t1 ? (t1.getTime() - t0.getTime()) / 1000 / (same.length - 1) : null;
        const left = per && running ? Math.max(0, c.total - c.done) * per : null;
        bar = { done: c.done, total: c.total, label: c.event === "question" ? `writing questions · ${c.accepted} accepted · ${c.rejected} rejected` : "embedding passages",
            eta: left != null ? `~${fmtDur(left)} left` : null };
    }
    if (!stage && !bar && !log)
        return null;
    return (_jsxs("div", { className: "grid gap-x-6 gap-y-1.5 border-b border-line px-3 py-2 sm:grid-cols-[auto_minmax(0,1fr)]", children: [stage && _jsxs("div", { className: "font-mono text-[11px] text-ink", children: [_jsx("span", { className: "micro mr-2 text-ink-3", children: "stage" }), stage] }), _jsxs("div", { className: "min-w-0 space-y-1", children: [bar && (_jsxs("div", { children: [_jsxs("div", { className: "flex flex-wrap justify-between gap-x-3 font-mono text-[10.5px] text-ink-2", children: [_jsx("span", { children: bar.label }), _jsxs("span", { className: "num", children: [bar.done, "/", bar.total, bar.eta && _jsx("span", { className: "ml-2 text-ink-3", children: bar.eta })] })] }), _jsx("div", { className: "mt-1 h-[4px] rounded-full bg-surface-3", children: _jsx("div", { className: "h-full rounded-full bg-accent transition-[width] duration-500", style: { width: `${(bar.done / Math.max(1, bar.total)) * 100}%` } }) })] })), log && (_jsxs("div", { className: "num font-mono text-[10.5px] text-ink-2", children: [train && _jsxs("span", { className: "mr-2 text-ink-3", children: [String(train.arm), " \u00B7 seed ", String(train.seed)] }), "step ", String(log.step), typeof log.loss === "number" && _jsxs(_Fragment, { children: [" \u00B7 loss ", log.loss.toFixed(4)] }), log.tokens_per_s != null && _jsxs(_Fragment, { children: [" \u00B7 ", String(log.tokens_per_s), " tok/s"] }), log.peak_vram_mb ? _jsxs(_Fragment, { children: [" \u00B7 peak ", fmt.mb(log.peak_vram_mb)] }) : null] }))] })] }));
}
export function JobLog({ jobId, height = 280, onDone, fill = false }) {
    const [lines, setLines] = useState([]);
    const [job, setJob] = useState(null);
    const [follow, setFollow] = useState(true);
    const off = useRef(0);
    const seq = useRef(0);
    const box = useRef(null);
    const done = useRef(false);
    const firstN = useRef(null); // last line present at first load (those are not highlighted)
    // The completion callback is read through a ref: parents re-create it on every poll, and making it an
    // effect dependency reset the log on each render (the "flashing" — and, for finished jobs, a reset loop).
    const onDoneRef = useRef(onDone);
    useEffect(() => { onDoneRef.current = onDone; }, [onDone]);
    useEffect(() => {
        setLines([]);
        off.current = 0;
        seq.current = 0;
        done.current = false;
        firstN.current = null;
        let alive = true, busy = false;
        const tick = async () => {
            if (busy)
                return; // never overlap requests
            busy = true;
            try {
                // Status FIRST, then the log: the server closes the log before recording a terminal status.
                const j = await api.get(`/api/jobs/${jobId}`);
                const finished = j.status !== "running" && j.status !== "cancelling";
                for (let page = 0; page < 50; page++) {
                    const log = await api.get(`/api/jobs/${jobId}/log${qs({ offset: off.current })}`);
                    if (!alive)
                        return;
                    const moved = log.offset !== off.current;
                    off.current = log.offset;
                    const fresh = log.events.filter((e) => !(e.event === undefined && (!e.text?.trim() || NOISE.test(e.text))));
                    if (fresh.length)
                        setLines((cur) => [...cur, ...fresh.map((e) => ({ n: ++seq.current, e }))].slice(-KEEP));
                    if (!finished || !moved)
                        break;
                }
                if (alive)
                    setJob((prev) => (prev && prev.status === j.status && prev.exit_code === j.exit_code ? prev : j));
                if (finished && !done.current) {
                    done.current = true;
                    onDoneRef.current?.(j);
                }
            }
            catch { /* transient; next tick retries */ }
            finally {
                busy = false;
            }
        };
        void tick();
        const t = window.setInterval(() => { if (!done.current)
            void tick(); }, 1000);
        return () => { alive = false; window.clearInterval(t); };
    }, [jobId]);
    useEffect(() => { if (follow && box.current)
        box.current.scrollTop = box.current.scrollHeight; }, [lines, follow]);
    if (firstN.current === null && lines.length)
        firstN.current = lines[lines.length - 1].n; // lines present on first load: no highlight
    return (_jsxs("div", { className: cx("overflow-hidden rounded-[var(--radius)] border border-line bg-surface-2", fill && "fit:flex fit:h-full fit:min-h-0 fit:flex-col"), children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-1.5", children: [_jsxs("div", { className: "flex min-w-0 items-center gap-2", children: [job && _jsx(Status, { s: job.status }), _jsx("span", { className: "truncate font-mono text-[11px] text-ink-2", children: job?.label ?? jobId }), job?.pid && _jsxs("span", { className: "font-mono text-[10px] text-ink-3", children: ["pid ", job.pid] }), job?.exit_code != null && _jsxs("span", { className: "font-mono text-[10px] text-ink-3", children: ["exit ", job.exit_code] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("label", { className: "flex items-center gap-1 text-[11px] text-ink-3", children: [_jsx("input", { type: "checkbox", checked: follow, onChange: (e) => setFollow(e.target.checked) }), "follow"] }), job?.status === "running" && _jsx(Button, { size: "sm", tone: "danger", icon: "stop", onClick: () => void api.post(`/api/jobs/${jobId}/cancel`), children: "Cancel" })] })] }), _jsx(Progress, { lines: lines, running: job?.status === "running" }), _jsxs("div", { ref: box, className: cx("scroll-thin overflow-y-auto px-3 py-2 font-mono text-[11px] leading-[1.55]", fill && "fit:!h-auto fit:min-h-0 fit:flex-1"), style: { height }, "aria-live": "polite", children: [lines.length === 0 && _jsx("div", { className: "text-ink-3", children: job && job.status !== "running" ? "no output recorded" : "waiting for output…" }), lines.map(({ n, e }) => {
                        const d = describe(e);
                        const t = eventTime(e);
                        return (_jsxs("div", { className: cx("whitespace-pre-wrap break-words rounded-[2px]", firstN.current !== null && n > firstN.current && "log-new", { default: "text-ink-2", good: "text-good-ink", crit: "text-crit-ink", muted: "text-ink-3" }[d.tone]), children: [_jsx("span", { className: "mr-2 text-ink-3", children: t ? t.toLocaleTimeString() : "        " }), d.text, typeof e.traceback === "string" && _jsxs("details", { className: "text-ink-3", children: [_jsx("summary", { children: "traceback" }), e.traceback] })] }, n));
                    })] })] }));
}
/* ------------------------------------------------------------- active study selector */
export function useStudies() { return useApi("/api/studies", 8000); }
export function StudySelect({ compact = false }) {
    const { prefs, set } = usePrefs();
    const s = useStudies();
    const list = s.data ?? [];
    const recheck = useRef(null);
    const reloadStudies = s.reload;
    useEffect(() => {
        if (!prefs.activeStudy && list.length) {
            set("activeStudy", list[0].id);
            return;
        }
        if (!prefs.activeStudy || !s.data || list.some((x) => x.id === prefs.activeStudy))
            return;
        // Unknown id: usually a study created moments ago that this (cached) list predates. Refresh once
        // before falling back — otherwise a just-created study gets replaced by an older one.
        if (recheck.current !== prefs.activeStudy) {
            recheck.current = prefs.activeStudy;
            void reloadStudies();
            return;
        }
        set("activeStudy", list[0]?.id ?? null);
    }, [list, prefs.activeStudy, s.data, set, reloadStudies]);
    if (!list.length)
        return compact ? null : _jsx("span", { className: "text-[12px] text-ink-3", children: "No studies yet" });
    return (_jsxs("label", { className: cx("flex items-center gap-2", compact && "max-w-[260px]"), children: [_jsx(Icon, { name: "flask", size: 14, className: "text-ink-3" }), _jsx("span", { className: "sr-only", children: "Active study" }), _jsx("select", { className: cx(inputCls, "h-7 py-0 font-sans text-[12px]"), value: prefs.activeStudy ?? "", onChange: (e) => set("activeStudy", e.target.value), children: list.map((x) => _jsxs("option", { value: x.id, children: [x.name, " \u00B7 ", x.profile, x.sealed ? " · sealed" : ""] }, x.id)) })] }));
}
