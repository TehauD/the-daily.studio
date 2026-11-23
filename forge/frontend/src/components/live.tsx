import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api, fmt, qs } from "../lib/api";
import { useApi } from "../lib/hooks";
import { usePrefs } from "../lib/prefs";
import type { Job, JobEvent, StudyRow, TelemetryResponse } from "../lib/types";
import { Icon } from "./icons";
import { Button, Status, cx, inputCls } from "./ui";

/* ------------------------------------------------------------- telemetry: one poll shared by the whole app */
interface TelemetryCtx { data: TelemetryResponse | null; error: string | null; updatedAt: number | null }
const TCtx = createContext<TelemetryCtx>({ data: null, error: null, updatedAt: null });

export function TelemetryProvider({ children }: { children: ReactNode }) {
  const { prefs } = usePrefs();
  const t = useApi<TelemetryResponse>("/api/system/telemetry", prefs.telemetryPollMs);
  return <TCtx.Provider value={{ data: t.data, error: t.error, updatedAt: t.updatedAt }}>{children}</TCtx.Provider>;
}
export const useTelemetry = () => useContext(TCtx);

/* ------------------------------------------------------------- job log (incremental tail) */
const KEEP = 600;

function describe(e: JobEvent): { text: string; tone: "default" | "good" | "crit" | "muted" } {
  switch (e.event) {
    case "episode": return { text: `${e.arm}/${e.split}/s${e.seed} ${e.task_id} → ${e.strict_success ? "strict ✓" : "✕"} (${e.progress})`, tone: e.strict_success ? "default" : "muted" };
    case "log": return { text: `step ${e.step} · loss ${typeof e.loss === "number" ? e.loss.toFixed(4) : "—"}${e.eval_loss != null ? ` · dev ${(e.eval_loss as number).toFixed(4)}` : ""} · ${e.tokens_seen} tok · ${e.tokens_per_s ?? "—"} tok/s${e.peak_vram_mb ? ` · peak ${fmt.mb(e.peak_vram_mb as number)}` : ""}`, tone: "default" };
    case "error": return { text: `ERROR ${e.error}`, tone: "crit" };
    case "stage_completed": return { text: `stage ${e.stage} completed`, tone: "good" };
    case "stage_start": return { text: `stage ${e.stage} started · ${e.python}`, tone: "default" };
    case "preflight_passed": return { text: `pre-flight passed (${(e.checks as unknown[]).length} checks)`, tone: "good" };
    case "gates_passed": return { text: `gates passed · zero-adapter max|Δlogit| = ${e.zero_adapter_max_abs_diff} · trainable ${fmt.exact(e.trainable_params as number)} / ${fmt.exact(e.total_params as number)}`, tone: "good" };
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
    case "lens_start": return { text: `lens ${e.arm} s${e.seed}: ${e.episodes} dev episodes · ${e.records} teacher turns · ${e.tokens} tokens`, tone: "default" };
    case "lens_point": return { text: `${e.label}${e.total ? ` (${e.done}/${e.total})` : ""} · surprise ${(e.nll as number).toFixed(3)} nats/token · same top guess ${fmt.pct(e.agreement as number, 1)}`, tone: "default" };
    case "lens_done": return { text: `lens saved · ${e.points} points`, tone: "good" };
    case "dataset": return { text: `dataset ${e.arm}: ${e.records} records from ${e.episodes_used} episodes`, tone: "default" };
    case undefined: return { text: e.text ?? "", tone: "muted" };
    default: return { text: `${e.event} ${JSON.stringify(Object.fromEntries(Object.entries(e).filter(([k]) => !["ts", "event"].includes(k)))).slice(0, 220)}`, tone: "default" };
  }
}

interface Line { n: number; e: JobEvent }

function eventTime(e: JobEvent): Date | null {
  if (typeof e.ts === "number") return new Date(e.ts * 1000);
  if (typeof e.ts === "string") { const d = new Date(e.ts); return Number.isNaN(d.getTime()) ? null : d; }
  return null;
}

/** Third-party progress-bar / dict noise (tqdm, Trainer printouts) that older engines wrote to stdout. */
const NOISE = /(\d+%\|)|(\d+\/\d+ \[\d\d:\d\d)|^\{'(loss|train_runtime|eval_loss)'/;

function fmtDur(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "—";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.round(s % 60);
  return h ? `${h}h ${m}m` : m ? `${m}m ${sec}s` : `${sec}s`;
}

/** Live summary derived from the event stream: stage, episode progress + ETA, latest training step. */
function Progress({ lines, running }: { lines: Line[]; running: boolean }) {
  let stage: string | null = null, ep: JobEvent | null = null, log: JobEvent | null = null, train: JobEvent | null = null;
  const counted = [...lines].reverse().find((l) => (l.e.event === "question" || l.e.event === "embedded") && typeof l.e.done === "number");
  for (let i = lines.length - 1; i >= 0 && !(stage && ep && log && train); i--) {
    const e = lines[i].e;
    if (!stage && (e.event === "stage_start" || e.event === "pack_step_start")) stage = String(e.stage ?? e.step);
    if (!ep && e.event === "episode") ep = e;
    if (!log && e.event === "log" && e.step != null) log = e;
    if (!train && e.event === "train_start") train = e;
  }
  let bar: { done: number; total: number; label: string; eta: string | null } | null = null;
  if (ep && typeof ep.progress === "string") {
    const [d, t] = ep.progress.split("/").map(Number);
    // Rate from episodes of the same arm/split in this log (resumed runs: only what this process did).
    const same = lines.filter((l) => l.e.event === "episode" && l.e.arm === ep!.arm && l.e.split === ep!.split);
    const t0 = eventTime(same[0].e), t1 = eventTime(same[same.length - 1].e);
    const per = same.length > 1 && t0 && t1 ? (t1.getTime() - t0.getTime()) / 1000 / (same.length - 1) : null;
    bar = { done: d, total: t, label: `${ep.arm} · ${ep.split}${ep.arm !== "teacher" && ep.arm !== "base" ? ` · seed ${ep.seed}` : ""}`,
            eta: per && running ? `${per.toFixed(1)} s/episode · ~${fmtDur((t - d) * per)} left in this split` : per ? `${per.toFixed(1)} s/episode` : null };
  }
  if (!bar && counted) {
    const c = counted.e, same = lines.filter((l) => l.e.event === c.event);
    const t0 = eventTime(same[0].e), t1 = eventTime(c);
    const per = same.length > 1 && t0 && t1 ? (t1.getTime() - t0.getTime()) / 1000 / (same.length - 1) : null;
    const left = per && running ? Math.max(0, (c.total as number) - (c.done as number)) * per : null;
    bar = { done: c.done as number, total: c.total as number, label: c.event === "question" ? `writing questions · ${c.accepted} accepted · ${c.rejected} rejected` : "embedding passages",
            eta: left != null ? `~${fmtDur(left)} left` : null };
  }
  if (!stage && !bar && !log) return null;
  return (
    <div className="grid gap-x-6 gap-y-1.5 border-b border-line px-3 py-2 sm:grid-cols-[auto_minmax(0,1fr)]">
      {stage && <div className="font-mono text-[11px] text-ink"><span className="micro mr-2 text-ink-3">stage</span>{stage}</div>}
      <div className="min-w-0 space-y-1">
        {bar && (
          <div>
            <div className="flex flex-wrap justify-between gap-x-3 font-mono text-[10.5px] text-ink-2"><span>{bar.label}</span>
              <span className="num">{bar.done}/{bar.total}{bar.eta && <span className="ml-2 text-ink-3">{bar.eta}</span>}</span></div>
            <div className="mt-1 h-[4px] rounded-full bg-surface-3"><div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${(bar.done / Math.max(1, bar.total)) * 100}%` }} /></div>
          </div>
        )}
        {log && (
          <div className="num font-mono text-[10.5px] text-ink-2">
            {train && <span className="mr-2 text-ink-3">{String(train.arm)} · seed {String(train.seed)}</span>}
            step {String(log.step)}{typeof log.loss === "number" && <> · loss {log.loss.toFixed(4)}</>}
            {log.tokens_per_s != null && <> · {String(log.tokens_per_s)} tok/s</>}{log.peak_vram_mb ? <> · peak {fmt.mb(log.peak_vram_mb as number)}</> : null}
          </div>
        )}
      </div>
    </div>
  );
}

export function JobLog({ jobId, height = 280, onDone, fill = false }: { jobId: string; height?: number; onDone?: (j: Job) => void; fill?: boolean }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [follow, setFollow] = useState(true);
  const off = useRef(0);
  const seq = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const firstN = useRef<number | null>(null);  // last line present at first load (those are not highlighted)
  // The completion callback is read through a ref: parents re-create it on every poll, and making it an
  // effect dependency reset the log on each render (the "flashing" — and, for finished jobs, a reset loop).
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);
  useEffect(() => {
    setLines([]); off.current = 0; seq.current = 0; done.current = false; firstN.current = null;
    let alive = true, busy = false;
    const tick = async () => {
      if (busy) return;  // never overlap requests
      busy = true;
      try {
        // Status FIRST, then the log: the server closes the log before recording a terminal status.
        const j = await api.get<Job>(`/api/jobs/${jobId}`);
        const finished = j.status !== "running" && j.status !== "cancelling";
        for (let page = 0; page < 50; page++) {
          const log = await api.get<{ events: JobEvent[]; offset: number }>(`/api/jobs/${jobId}/log${qs({ offset: off.current })}`);
          if (!alive) return;
          const moved = log.offset !== off.current;
          off.current = log.offset;
          const fresh = log.events.filter((e) => !(e.event === undefined && (!e.text?.trim() || NOISE.test(e.text))));
          if (fresh.length) setLines((cur) => [...cur, ...fresh.map((e) => ({ n: ++seq.current, e }))].slice(-KEEP));
          if (!finished || !moved) break;
        }
        if (alive) setJob((prev) => (prev && prev.status === j.status && prev.exit_code === j.exit_code ? prev : j));
        if (finished && !done.current) { done.current = true; onDoneRef.current?.(j); }
      } catch { /* transient; next tick retries */ } finally { busy = false; }
    };
    void tick();
    const t = window.setInterval(() => { if (!done.current) void tick(); }, 1000);
    return () => { alive = false; window.clearInterval(t); };
  }, [jobId]);
  useEffect(() => { if (follow && box.current) box.current.scrollTop = box.current.scrollHeight; }, [lines, follow]);
  if (firstN.current === null && lines.length) firstN.current = lines[lines.length - 1].n; // lines present on first load: no highlight
  return (
    <div className={cx("overflow-hidden rounded-[var(--radius)] border border-line bg-surface-2", fill && "fit:flex fit:h-full fit:min-h-0 fit:flex-col")}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          {job && <Status s={job.status} />}
          <span className="truncate font-mono text-[11px] text-ink-2">{job?.label ?? jobId}</span>
          {job?.pid && <span className="font-mono text-[10px] text-ink-3">pid {job.pid}</span>}
          {job?.exit_code != null && <span className="font-mono text-[10px] text-ink-3">exit {job.exit_code}</span>}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[11px] text-ink-3"><input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />follow</label>
          {job?.status === "running" && <Button size="sm" tone="danger" icon="stop" onClick={() => void api.post(`/api/jobs/${jobId}/cancel`)}>Cancel</Button>}
        </div>
      </div>
      <Progress lines={lines} running={job?.status === "running"} />
      <div ref={box} className={cx("scroll-thin overflow-y-auto px-3 py-2 font-mono text-[11px] leading-[1.55]", fill && "fit:!h-auto fit:min-h-0 fit:flex-1")} style={{ height }} aria-live="polite">
        {lines.length === 0 && <div className="text-ink-3">{job && job.status !== "running" ? "no output recorded" : "waiting for output…"}</div>}
        {lines.map(({ n, e }) => {
          const d = describe(e);
          const t = eventTime(e);
          return (
            <div key={n} className={cx("whitespace-pre-wrap break-words rounded-[2px]", firstN.current !== null && n > firstN.current && "log-new",
              { default: "text-ink-2", good: "text-good-ink", crit: "text-crit-ink", muted: "text-ink-3" }[d.tone])}>
              <span className="mr-2 text-ink-3">{t ? t.toLocaleTimeString() : "        "}</span>{d.text}
              {typeof e.traceback === "string" && <details className="text-ink-3"><summary>traceback</summary>{e.traceback}</details>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- active study selector */
export function useStudies() { return useApi<StudyRow[]>("/api/studies", 8000); }

export function StudySelect({ compact = false }: { compact?: boolean }) {
  const { prefs, set } = usePrefs();
  const s = useStudies();
  const list = s.data ?? [];
  const recheck = useRef<string | null>(null);
  const reloadStudies = s.reload;
  useEffect(() => {
    if (!prefs.activeStudy && list.length) { set("activeStudy", list[0].id); return; }
    if (!prefs.activeStudy || !s.data || list.some((x) => x.id === prefs.activeStudy)) return;
    // Unknown id: usually a study created moments ago that this (cached) list predates. Refresh once
    // before falling back — otherwise a just-created study gets replaced by an older one.
    if (recheck.current !== prefs.activeStudy) { recheck.current = prefs.activeStudy; void reloadStudies(); return; }
    set("activeStudy", list[0]?.id ?? null);
  }, [list, prefs.activeStudy, s.data, set, reloadStudies]);
  if (!list.length) return compact ? null : <span className="text-[12px] text-ink-3">No studies yet</span>;
  return (
    <label className={cx("flex items-center gap-2", compact && "max-w-[260px]")}>
      <Icon name="flask" size={14} className="text-ink-3" />
      <span className="sr-only">Active study</span>
      <select className={cx(inputCls, "h-7 py-0 font-sans text-[12px]")} value={prefs.activeStudy ?? ""} onChange={(e) => set("activeStudy", e.target.value)}>
        {list.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.profile}{x.sealed ? " · sealed" : ""}</option>)}
      </select>
    </label>
  );
}
