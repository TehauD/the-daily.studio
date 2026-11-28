import { useState } from "react";
import { Icon } from "./icons";
import { JobLog } from "./live";
import { Button, ErrorLine, Notice, Panel, Prov, cx, inputCls } from "./ui";
import { api } from "../lib/api";
import { goto } from "../lib/handoff";
import { useAction, useApi } from "../lib/hooks";
import type { Job } from "../lib/types";

interface Step { key: string; label: string; done: boolean; status?: string | null; optional?: boolean; needs_confirm?: boolean }
interface PlanT { steps: Step[]; running: Job | null }

/** Run everything that is left in the study — the validation kit, inside the app, with a live checklist. */
export function Autopilot({ sid, sealed, onChange }: { sid: string; sealed: boolean; onChange?: () => void }) {
  const [quant, setQuant] = useState(true);
  const plan = useApi<PlanT>(`/api/studies/${sid}/autopilot?quant=${quant}`, 4000);
  const [seal, setSeal] = useState("");
  const [job, setJob] = useState<string | null>(null);
  const act = useAction();
  const steps = plan.data?.steps ?? [];
  const running = plan.data?.running ?? null;
  const jid = job ?? running?.id ?? null;
  const left = steps.filter((s) => !s.done);
  const nextIdx = steps.findIndex((s) => !s.done);
  const sealPending = !sealed && steps.some((s) => s.key === "seal" && !s.done);
  if (!plan.data) return null;
  if (!left.length && !jid) return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border border-line bg-surface px-4 py-2.5 text-[12.5px] text-ink-2">
      <span className="flex items-center gap-2"><Icon name="check" size={14} className="text-good-ink" />All {steps.length} steps of the validation run are done for this study.</span>
      <Button size="sm" icon="chevron" onClick={() => goto("evidence")}>Read the answer</Button>
    </div>);
  return (
    <Panel title="Run everything that's left" prov={<Prov kind="declared" source="same steps as the buttons — resumable" />}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div>
          <p className="mb-2 text-[12.5px] text-ink-2">{left.length ? <>One job runs the remaining {left.length} step{left.length === 1 ? "" : "s"} in order. Finished steps are skipped, so if one fails, fix the cause and start again.</> : <>Every step is done. Read the answer on <b>Evidence</b>.</>}</p>
          <ol className="space-y-1" aria-label="Steps">
            {steps.map((s, i) => {
              const now = !!jid && i === nextIdx;
              return (
                <li key={s.key} className={cx("flex items-center gap-2 text-[12.5px]", s.done ? "text-ink-2" : now ? "font-medium text-ink" : "text-ink-2")}>
                  <span className={cx("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", s.done ? "border-[color:var(--good)] bg-[color:var(--good)]/10 text-good-ink" : now ? "border-accent bg-accent-soft text-accent" : "border-line-strong text-ink-3")}>
                    {s.done ? <Icon name="check" size={11} /> : now ? <Icon name="refresh" size={11} className="animate-spin" /> : <span className="font-mono text-[9.5px]">{i + 1}</span>}</span>
                  <span>{s.label}{s.optional ? <span className="text-ink-3"> (check)</span> : null}{s.status === "failed" ? <span className="text-crit-ink"> · failed last time</span> : null}</span>
                </li>); })}
          </ol>
        </div>
        <div className="min-w-0 space-y-3">
          {left.length > 0 && !jid && (<>
            <label className="flex items-center gap-2 text-[12.5px] text-ink-2"><input type="checkbox" checked={quant} onChange={(e) => setQuant(e.target.checked)} /> include quantization (8-bit and 4-bit variants on the final test)</label>
            {sealPending && (
              <div className="rounded-[var(--radius)] border border-line bg-surface-2 p-2.5">
                <div className="text-[12.5px] text-ink"><b>Sealing</b> locks the study: no more training, and the final test is used once.</div>
                <label className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-ink-2">Type <span className="font-mono text-ink">SEAL</span> to let this run seal and run the final test — leave empty to stop after practice results.
                  <input aria-label="Type SEAL to allow sealing" className={cx(inputCls, "!w-28 font-mono")} value={seal} onChange={(e) => setSeal(e.target.value)} placeholder="optional" /></label>
              </div>)}
            <Button tone="primary" icon="play" busy={act.busy} disabled={seal !== "" && seal !== "SEAL"}
              onClick={() => void act.run(async () => { const j = await api.post<Job>(`/api/studies/${sid}/autopilot`, { quant, seal_confirm: seal === "SEAL" ? "SEAL" : null }); setJob(j.id); })}>
              {sealPending && seal !== "SEAL" ? "Run up to the seal" : "Run everything that's left"}</Button>
            <ErrorLine error={act.error} />
          </>)}
          {jid && <JobLog key={jid} jobId={jid} height={220} onDone={() => { setJob(null); void plan.reload(); onChange?.(); }} />}
          {!left.length && <Notice tone="info">Nothing left to run for this study.</Notice>}
        </div>
      </div>
    </Panel>
  );
}

/** A phase's next step that acts in place (starts a job) instead of navigating — shown with its live log. */
export function InlineAction({ label, path, body, onDone }: { label: string; path: string; body?: unknown; onDone?: () => void }) {
  const [job, setJob] = useState<string | null>(null);
  const act = useAction();
  return (
    <div className="space-y-2">
      {!job && <Button size="sm" tone="primary" icon="play" busy={act.busy} onClick={() => void act.run(async () => setJob((await api.post<Job>(path, body ?? {})).id))}>{label}</Button>}
      <ErrorLine error={act.error} />
      {job && <JobLog key={job} jobId={job} height={140} onDone={() => { setJob(null); onDone?.(); }} />}
    </div>
  );
}
