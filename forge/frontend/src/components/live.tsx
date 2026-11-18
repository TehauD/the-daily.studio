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
    case "dataset": return { text: `dataset ${e.arm}: ${e.records} records from ${e.episodes_used} episodes`, tone: "default" };
    case undefined: return { text: e.text ?? "", tone: "muted" };
    default: return { text: `${e.event} ${JSON.stringify(Object.fromEntries(Object.entries(e).filter(([k]) => !["ts", "event"].includes(k)))).slice(0, 220)}`, tone: "default" };
  }
}

export function JobLog({ jobId, height = 280, onDone }: { jobId: string; height?: number; onDone?: (j: Job) => void }) {
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [follow, setFollow] = useState(true);
  const off = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  useEffect(() => {
    setEvents([]); off.current = 0; done.current = false;
    let alive = true;
    const tick = async () => {
      try {
        // Status FIRST, then the log. The server closes the log file before it records a terminal
        // status, so a log read issued after seeing "finished" is complete. (Fetching both in parallel
        // lost the final lines of fast-failing jobs, e.g. a pre-flight refusal.)
        const j = await api.get<Job>(`/api/jobs/${jobId}`);
        const finished = j.status !== "running" && j.status !== "cancelling";
        for (let page = 0; page < 50; page++) {
          const log = await api.get<{ events: JobEvent[]; offset: number }>(`/api/jobs/${jobId}/log${qs({ offset: off.current })}`);
          if (!alive) return;
          const moved = log.offset !== off.current;
          off.current = log.offset;
          if (log.events.length) setEvents((ev) => [...ev, ...log.events].slice(-KEEP));
          if (!finished || !moved) break; // drain fully only once the job has ended
        }
        setJob(j);
        if (finished && !done.current) { done.current = true; onDone?.(j); }
      } catch { /* transient; next tick retries */ }
    };
    void tick();
    const t = window.setInterval(() => { if (!done.current) void tick(); }, 1000);
    return () => { alive = false; window.clearInterval(t); };
  }, [jobId, onDone]);
  useEffect(() => { if (follow && box.current) box.current.scrollTop = box.current.scrollHeight; }, [events, follow]);
  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-line bg-surface-2">
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
      <div ref={box} className="scroll-thin overflow-y-auto px-3 py-2 font-mono text-[11px] leading-[1.55]" style={{ height }} aria-live="polite">
        {events.length === 0 && <div className="text-ink-3">waiting for output…</div>}
        {events.map((e, i) => {
          const d = describe(e);
          return (
            <div key={i} className={cx("whitespace-pre-wrap break-words", { default: "text-ink-2", good: "text-good-ink", crit: "text-crit-ink", muted: "text-ink-3" }[d.tone])}>
              <span className="mr-2 text-ink-3">{e.ts ? new Date(e.ts * 1000).toLocaleTimeString() : "        "}</span>{d.text}
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
  useEffect(() => {
    if (!prefs.activeStudy && list.length) set("activeStudy", list[0].id);
    if (prefs.activeStudy && s.data && !list.some((x) => x.id === prefs.activeStudy)) set("activeStudy", list[0]?.id ?? null);
  }, [list, prefs.activeStudy, s.data, set]);
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
