import { useEffect, useRef, useState } from "react";
import { useAssistant } from "../lib/assistant";
import { useApi } from "../lib/hooks";
import type { Job } from "../lib/types";
import { Icon } from "./icons";
import { JobLog } from "./live";
import { cx } from "./ui";

interface Toast { id: string; label: string; status: Job["status"]; at: number }

/** Bottom dock: every running job, its live log on demand, and a toast when a job finishes — from any page. */
export function JobDock() {
  const jobs = useApi<{ jobs: Job[] }>("/api/jobs?limit=20", 3000);
  const seen = useRef<Map<string, Job["status"]> | null>(null);
  const mounted = useRef(Date.now() - 5000);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const lift = useAssistant().available;  // keep clear of the assistant button
  const list = jobs.data?.jobs ?? [];
  const running = list.filter((j) => j.status === "running" || j.status === "cancelling");

  useEffect(() => {
    if (!jobs.data) return;
    const prev = seen.current;
    const now = new Map(jobs.data.jobs.map((j) => [j.id, j.status] as const));
    if (prev) {
      const live = (st?: Job["status"]) => st === "running" || st === "cancelling";
      // Finished since the last poll — including short jobs that started and ended between two polls.
      const done = jobs.data.jobs.filter((j) => !live(j.status) && (live(prev.get(j.id)) || (!prev.has(j.id) && Date.parse(j.created_at) >= mounted.current)));
      if (done.length) setToasts((t) => [...t, ...done.map((j) => ({ id: j.id, label: j.label, status: j.status, at: Date.now() }))].slice(-4));
    }
    seen.current = now;
  }, [jobs.data]);
  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => setToasts((x) => x.filter((y) => Date.now() - y.at < 9000)), 9500);
    return () => clearTimeout(t);
  }, [toasts]);
  useEffect(() => { if (open && !running.some((j) => j.id === open)) setOpen(null); }, [open, running]);

  if (!running.length && !toasts.length) return null;
  return (
    <div className={cx("pointer-events-none fixed right-3 z-40 flex max-w-[calc(100vw-1.5rem)] flex-col items-end gap-2", lift ? "bottom-16" : "bottom-3")}>
      <div aria-live="polite" className="flex flex-col items-end gap-2">
        {toasts.map((t) => (
          <div key={t.id} role="status" className={cx("pointer-events-auto fade-in flex max-w-[380px] items-center gap-2 rounded-[var(--radius)] border bg-surface px-3 py-2 text-[12.5px] shadow-lg",
            t.status === "completed" ? "border-good/50" : "border-crit/50")}>
            <Icon name={t.status === "completed" ? "check" : "alert"} size={15} className={t.status === "completed" ? "text-good-ink" : "text-crit-ink"} />
            <span className="min-w-0 truncate text-ink">{t.label}</span>
            <span className={cx("shrink-0 font-mono text-[11px]", t.status === "completed" ? "text-good-ink" : "text-crit-ink")}>{t.status}</span>
            <button type="button" aria-label="Dismiss" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="ml-1 text-ink-3 hover:text-ink"><Icon name="x" size={13} /></button>
          </div>))}
      </div>
      {open && (
        <div className="pointer-events-auto w-[min(640px,calc(100vw-1.5rem))] rounded-[var(--radius)] border border-line-strong bg-surface p-2 shadow-xl">
          <div className="mb-1.5 flex items-center justify-between px-1 text-[12px] text-ink-2"><span className="truncate">{running.find((j) => j.id === open)?.label}</span>
            <button type="button" aria-label="Close log" onClick={() => setOpen(null)} className="text-ink-3 hover:text-ink"><Icon name="x" size={14} /></button></div>
          <JobLog jobId={open} height={220} />
        </div>
      )}
      {running.length > 0 && (
        <div className="pointer-events-auto flex max-w-full flex-wrap justify-end gap-1.5" aria-label="Running jobs">
          {running.map((j) => (
            <button key={j.id} type="button" onClick={() => setOpen(open === j.id ? null : j.id)} aria-expanded={open === j.id}
              className={cx("flex max-w-[300px] items-center gap-2 rounded-full border bg-surface px-3 py-1.5 font-mono text-[11.5px] shadow-md transition",
                open === j.id ? "border-accent text-ink" : "border-accent-line text-ink-2 hover:text-ink")}>
              <span className="live-dot h-1.5 w-1.5 shrink-0 rounded-full bg-accent" /><span className="truncate">{j.label}</span>
              {j.gpu ? <span className="micro !text-[9px] text-ink-3">GPU</span> : null}
            </button>))}
        </div>
      )}
    </div>
  );
}
