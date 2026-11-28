import { useEffect, useMemo, useState } from "react";
import { PathGraph } from "../components/graphs";
import { JobLog, StudySelect } from "../components/live";
import { Badge, Button, Empty, ErrorLine, Field, Notice, PageHeader, Panel, Prov, Segmented, Skeleton, Status, cx, inputCls, td, th, tr } from "../components/ui";
import { api, fmt } from "../lib/api";
import { useAction, useApi } from "../lib/hooks";
import { usePrefs } from "../lib/prefs";
import { useReviewer } from "../lib/reviewer";
import type { Job, PathGraphT, StudySummary } from "../lib/types";

interface LaneSpec { kind: "base" | "adapter" | "variant" | "teacher"; arm?: string; seed?: number; variant?: string; label: string }
interface LaneOut { label: string; model: string; answer: string | null; termination: string; errors: string[]; score: { strict_success: boolean; answer_correct: boolean } | null;
  evidence: boolean | null; usage: { latency_ms: number; prompt_tokens: number; completion_tokens: number }; graph: PathGraphT; diverges_at: number | null; lane: LaneSpec }
interface RunOut { id: string; prompt: string; task: { task_id: string; family: string; split: string; reference_answer: string | null }; lanes: LaneOut[]; agent: boolean; honesty: string }
interface Variant { id: string; name: string; status: string; base_hash: string | null; strength: number; sources: { study_name: string; arm: string; seed: number; weight: number }[] }
interface Decision { at: string; lane: string; model: string; prompt: string; agent_answer: string | null; decision: "accept" | "override"; correct_answer: string | null; reviewer: string; evidence: boolean | null }

const ACCENT: Record<string, string> = { teacher: "var(--s-teacher)", base: "var(--s-base)", adapter: "var(--s-tuned)", variant: "var(--cat-7)" };

export default function Playground() {
  const { prefs } = usePrefs();
  const sid = prefs.activeStudy;
  const s = useApi<StudySummary & { jobs?: Job[] }>(sid ? `/api/studies/${sid}` : null, 4000);
  const plan = s.data?.plan;
  const variants = useApi<Variant[]>("/api/weightlab", 10000);
  const tasks = useApi<{ tasks: { task_id: string; family: string; split: string; prompt: string }[]; sealed: boolean }>(sid ? `/api/studies/${sid}/playground/tasks` : null);
  const runs = useApi<{ id: string; created_at: string; prompt: string; lanes: string[] }[]>(sid ? `/api/studies/${sid}/playground` : null, 6000);
  const [mode, setMode] = useState<"message" | "task">("message");
  const [msg, setMsg] = useState("");
  const [taskId, setTaskId] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const preVariant = (() => { try { return sessionStorage.getItem("forge.playground.variant"); } catch { return null; } })();
  const options = useMemo<LaneSpec[]>(() => {
    if (!plan) return [];
    const isTrained = s.data?.state.stages.train?.status === "completed";
    const trained = isTrained ? plan.arms.flatMap((a) => plan.seeds.map((sd) => ({ kind: "adapter" as const, arm: a, seed: sd, label: `${a} · seed ${sd}` }))) : [];
    const vs = (variants.data ?? []).filter((v) => v.status === "built" && (!v.base_hash || !plan.base_hash || v.base_hash === plan.base_hash))
      .map((v) => ({ kind: "variant" as const, variant: v.id, label: `variant · ${v.name}` }));
    return [{ kind: "teacher", label: "teacher" }, { kind: "base", label: "untrained student" }, ...trained, ...vs];
  }, [plan, variants.data, s.data]);
  const [sel, setSel] = useState<string[]>([]);
  useEffect(() => {
    if (!options.length) return;
    setSel((cur) => (cur.length ? cur.filter((x) => options.some((o) => o.label === x)) : ["teacher", "untrained student", options[2]?.label, ...(preVariant ? options.filter((o) => o.variant === preVariant).map((o) => o.label) : [])].filter(Boolean) as string[]));
  }, [options]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setRunId(null); setJobId(null); }, [sid]);
  useEffect(() => { if (!runId && runs.data?.length) setRunId(runs.data[0].id); }, [runs.data, runId]);
  const running = s.data?.jobs?.find((j) => j.status === "running" && j.kind === "playground");
  const act = useAction();
  const start = () => void act.run(async () => {
    const lanes = options.filter((o) => sel.includes(o.label)).map(({ kind, arm, seed, variant, label }) => ({ kind, arm, seed, variant, label }));
    const j = await api.post<Job>(`/api/studies/${sid}/playground`, { prompt: mode === "message" ? msg : null, task_id: mode === "task" ? taskId : null, lanes });
    setJobId(j.id); setRunId(null);
  });
  const run = useApi<RunOut>(sid && runId ? `/api/studies/${sid}/playground/${runId}` : null);
  const isAgent = plan?.taskset.kind === "agent";
  const example = isAgent ? "e.g. Night shift says the barcode scanner keeps failing on 5 East. Which assignment group should it go to?" : "Ask the agent something its tools can answer…";
  return (
    <div className="space-y-4 fit:flex fit:h-full fit:min-h-0 fit:flex-col fit:gap-3 fit:space-y-0">
      <PageHeader kicker="See inside & control" title="Agent Playground"
        subtitle="One message, several models, side by side — the untrained student, trained students, Weight Lab variants and the teacher — with every tool call they make. A person decides whether to accept each recommendation."
        right={<StudySelect />} />
      <ErrorLine error={s.error} />
      {!sid ? <Panel><Empty icon="play">Select a study (an agent study shows the most).</Empty></Panel> : !plan ? <Skeleton h={400} /> : (
        <div className="grid gap-4 fit:min-h-0 fit:flex-1 fit:grid-cols-[400px_minmax(0,1fr)] fit:gap-3">
          <div className="scroll-thin flex min-w-0 flex-col gap-4 fit:min-h-0 fit:gap-3 fit:overflow-auto fit:pr-1">
            <Panel title="Ask" eyebrow={plan.name}>
              <div className="space-y-3">
                <Segmented label="Input" value={mode} onChange={setMode} options={[{ value: "message", label: "your message" }, { value: "task", label: "a practice task" }]} />
                {mode === "message" ? (
                  <textarea className={cx(inputCls, "h-28 py-2 font-sans text-[13px] leading-relaxed")} placeholder={example} value={msg} onChange={(e) => setMsg(e.target.value)} aria-label="Message" />
                ) : (
                  <Field label="Task" hint={tasks.data?.sealed ? "All splits available (sealed)." : "Train and dev only — the final test stays untouched until you seal."}>
                    <select className={inputCls} value={taskId} onChange={(e) => setTaskId(e.target.value)}><option value="">— choose —</option>
                      {(tasks.data?.tasks ?? []).map((t) => <option key={t.task_id} value={t.task_id}>[{t.split}] {t.prompt.slice(0, 90)}</option>)}</select>
                  </Field>
                )}
                <div>
                  <div className="micro mb-1.5 text-ink-3">models to compare (up to 6)</div>
                  <div className="flex flex-wrap gap-1.5">{options.map((o) => {
                    const on = sel.includes(o.label);
                    return <button key={o.label} type="button" aria-pressed={on} onClick={() => setSel(on ? sel.filter((x) => x !== o.label) : sel.length < 6 ? [...sel, o.label] : sel)}
                      className={cx("inline-flex items-center gap-1.5 rounded-[3px] border px-2 py-1 text-[11.5px] transition", on ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-3 hover:text-ink")}>
                      <span className="h-2 w-2 rounded-full" style={{ background: ACCENT[o.kind] }} />{o.label}</button>;
                  })}</div>
                </div>
                <Notice tone="info">Students run on your GPU; the teacher runs in LM Studio. A 1.7B student usually fits next to the teacher — if VRAM is tight, compare students without the teacher.</Notice>
                <Button tone="primary" icon="play" busy={act.busy} disabled={!sel.length || (mode === "message" ? !msg.trim() : !taskId) || !!running} onClick={start}>Run side by side</Button>
                <ErrorLine error={act.error} />
              </div>
            </Panel>
            {(jobId || running) && <Panel title="Working…" eyebrow="live"><JobLog key={jobId ?? running!.id} jobId={jobId ?? running!.id} height={150}
              onDone={() => { setJobId(null); void runs.reload().then(() => setRunId(null)); }} /></Panel>}
            <Panel flush title="Recent runs">
              {!(runs.data ?? []).length ? <Empty>No runs yet.</Empty> : (runs.data ?? []).map((r) => (
                <button key={r.id} type="button" onClick={() => setRunId(r.id)} className={cx("block w-full border-b border-line px-[var(--pad)] py-2 text-left last:border-0 hover:bg-surface-2", r.id === runId && "!bg-accent-soft")}>
                  <div className="line-clamp-2 text-[12px] text-ink">{r.prompt}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-ink-3">{fmt.ago(r.created_at)} · {r.lanes.join(" · ")}</div>
                </button>))}
            </Panel>
          </div>
          <div className="scroll-thin min-w-0 space-y-4 fit:min-h-0 fit:space-y-3 fit:overflow-auto fit:pr-1">
            {!run.data ? <Panel><Empty icon="play">Run a message to see the models side by side.</Empty></Panel> : <Results r={run.data} sid={sid} agentId={plan.taskset.agent?.id ?? null} />}
            <Decisions sid={sid} agentId={plan.taskset.agent?.id ?? null} />
          </div>
        </div>
      )}
    </div>
  );
}

function Results({ r, sid, agentId }: { r: RunOut; sid: string; agentId: string | null }) {
  return (
    <>
      <Panel title="The message" eyebrow={r.task.task_id === "playground" ? "your message" : `${r.task.split} task · ${r.task.family}`} prov={<Prov kind="measured" source="playground run" />}>
        <div className="text-[13.5px] text-ink">{r.prompt}</div>
        {r.task.reference_answer && <div className="mt-1.5 text-[12px] text-ink-3">Verified answer: <span className="font-mono text-ink">{r.task.reference_answer}</span></div>}
      </Panel>
      <div className={cx("grid gap-3", r.lanes.length > 1 && "xl:grid-cols-2", r.lanes.length > 2 && "3xl:grid-cols-3")}>
        {r.lanes.map((l) => <LaneCard key={l.label} l={l} run={r} sid={sid} agentId={agentId} />)}
      </div>
      <div className="text-[11px] text-ink-3">{r.honesty}</div>
    </>
  );
}

function LaneCard({ l, run, sid, agentId }: { l: LaneOut; run: RunOut; sid: string; agentId: string | null }) {
  const [reviewer, setReviewer] = useReviewer();
  const [ov, setOv] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const act = useAction();
  const decide = (decision: "accept" | "override") => void act.run(async () => {
    await api.post("/api/decisions", { study_id: sid, run_id: run.id, lane: l.label, decision, correct_answer: decision === "override" ? ov : null, reviewer });
    setDone(decision === "accept" ? "Accepted" : `Overridden → ${ov}`); setOv(null);
  });
  const color = ACCENT[l.lane.kind] ?? "var(--s-tuned)";
  return (
    <Panel title={l.label} eyebrow={l.model} right={<span className="num font-mono text-[10.5px] text-ink-3">{(l.usage.latency_ms / 1000).toFixed(1)} s · {l.usage.completion_tokens} tok</span>}>
      <div className="space-y-3">
        <div className="h-1 rounded-full" style={{ background: color }} />
        <div className="rounded-[var(--radius)] border border-line bg-surface-2 p-2.5">
          <div className="micro mb-1 text-ink-3">recommendation</div>
          <div className="font-mono text-[13px] text-ink">{l.answer ?? <span className="text-crit-ink">no answer ({l.termination})</span>}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {l.score && <Status s={l.score.strict_success ? "pass" : "fail"} label={l.score.strict_success ? "strict ✓" : l.score.answer_correct ? "answer right, path wrong" : "wrong"} />}
            {l.evidence !== null && <Badge tone={l.evidence ? "good" : "warn"} title="Is the answer a value a tool returned in this run?">{l.evidence ? "backed by a tool result" : "not backed by a tool result"}</Badge>}
            {l.lane.kind !== "teacher" && l.diverges_at !== null && <Badge tone="warn">differs from teacher at step {l.diverges_at + 1}</Badge>}
            {l.lane.kind !== "teacher" && l.diverges_at === null && run.lanes.some((x) => x.lane.kind === "teacher") && <Badge tone="good">same steps as teacher</Badge>}
            {l.errors.length > 0 && <Badge tone="crit">{l.errors.join(", ")}</Badge>}
          </div>
        </div>
        <PathGraph g={l.graph} accent={color} />
        <div className="border-t border-line pt-2.5">
          {done ? <div className="text-[12px] text-good-ink">{done} · recorded for {reviewer}</div> : (
            <div className="flex flex-wrap items-center gap-2">
              <input className={cx(inputCls, "!w-32 font-sans")} placeholder="your initials" value={reviewer} onChange={(e) => setReviewer(e.target.value)} aria-label="Reviewer" />
              <Button size="sm" icon="check" disabled={!reviewer.trim() || l.answer == null} busy={act.busy} onClick={() => decide("accept")}>Accept</Button>
              {ov === null ? <Button size="sm" tone="ghost" disabled={!reviewer.trim()} onClick={() => setOv("")}>Override…</Button> : (
                <>
                  <input className={cx(inputCls, "!w-40")} placeholder="correct answer" value={ov} onChange={(e) => setOv(e.target.value)} aria-label="Correct answer" autoFocus />
                  <Button size="sm" tone="primary" disabled={!ov.trim()} busy={act.busy} onClick={() => decide("override")}>Save</Button>
                </>
              )}
            </div>
          )}
          {agentId && <div className="mt-1 text-[10.5px] text-ink-3">Overrides appear below and can become new examples for the agent.</div>}
          <ErrorLine error={act.error} />
        </div>
      </div>
    </Panel>
  );
}

function Decisions({ sid, agentId }: { sid: string; agentId: string | null }) {
  const d = useApi<{ decisions: Decision[]; by_lane: Record<string, { accept: number; override: number }> }>(`/api/decisions?study_id=${sid}`, 5000);
  const agent = useApi<{ skills: { id: string; name: string; tools: string[]; not_found: number; description: string; examples: unknown[] }[] }>(agentId ? `/api/agents/${agentId}` : null);
  const [added, setAdded] = useState<Record<number, string>>({});
  const act = useAction();
  const rows = d.data?.decisions ?? [];
  const addExample = (i: number, r: Decision, skillId: string) => void act.run(async () => {
    const skills = (agent.data?.skills ?? []).map((k) => (k.id === skillId ? { ...k, examples: [...k.examples, { prompt: r.prompt, answer: r.correct_answer, calls: [] }] } : k));
    await api.put(`/api/agents/${agentId}`, { skills }); setAdded({ ...added, [i]: skillId });
  });
  return (
    <Panel flush title="Human decisions" eyebrow="accept / override" prov={<Prov kind="declared" source="decisions.jsonl" />}
      right={<div className="flex gap-2">{Object.entries(d.data?.by_lane ?? {}).map(([k, v]) => <Badge key={k}>{k}: {v.accept}✓ {v.override}✎</Badge>)}</div>}>
      {!rows.length ? <Empty>No decisions yet. Accept or override a recommendation above.</Empty> : (
        <table className="w-full text-[12px]">
          <thead><tr><th className={th}>Message</th><th className={th}>Model</th><th className={th}>Agent said</th><th className={th}>Decision</th><th className={th}>By</th>{agentId && <th className={th} />}</tr></thead>
          <tbody>{rows.slice(0, 30).map((r, i) => (
            <tr key={i} className={tr}>
              <td className={cx(td, "max-w-[280px]")}><div className="line-clamp-2 text-ink-2">{r.prompt}</div></td>
              <td className={cx(td, "text-ink-3")}>{r.lane}</td>
              <td className={cx(td, "font-mono")}>{r.agent_answer ?? "—"}</td>
              <td className={td}>{r.decision === "accept" ? <Badge tone="good">accepted</Badge> : <span><Badge tone="warn">override</Badge> <span className="font-mono text-ink">{r.correct_answer}</span></span>}</td>
              <td className={cx(td, "text-ink-3")}>{r.reviewer}</td>
              {agentId && <td className={td}>{r.decision === "override" && (added[i] ? <span className="text-[11px] text-good-ink">added to {added[i]}</span> : (
                <select className={cx(inputCls, "h-7 !w-auto font-sans text-[11px]")} defaultValue="" aria-label="Add as example to skill"
                  onChange={(e) => e.target.value && addExample(i, r, e.target.value)}>
                  <option value="">add as example to…</option>{(agent.data?.skills ?? []).map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select>))}</td>}
            </tr>))}</tbody>
        </table>
      )}
      <div className="px-[var(--pad)] pb-2"><ErrorLine error={act.error} /></div>
    </Panel>
  );
}
