import { useState } from "react";
import { api } from "../lib/api";
import { useAssistant } from "../lib/assistant";
import { useAction, useApi } from "../lib/hooks";
import { useReviewer } from "../lib/reviewer";
import type { StudyRow } from "../lib/types";
import { Badge, Button, ErrorLine, Field, Notice, Panel, Status, Toggle, cx, inputCls } from "./ui";

interface Recipe { sources: { arm: string; seed: number; weight: number }[]; strength: number; layers: [number, number] | null; modules: string; rank: number | null }
interface Round { round: number; at: string; action: string; rationale: string; recipe: Recipe | null; decision: string; decided_by?: string; note?: string; error?: string; model?: string;
  variant_id?: string; result?: { overall: number | null; per_skill: Record<string, number>; delta_vs_trained: number | null; guardrail_violated: boolean; n: number } }
interface RunT { id: string; study_id: string; status: string; max_rounds: number; approve_each: boolean; goal: string; started_by?: string; rounds: Round[];
  best: { round: number; overall: number; delta_vs_trained: number | null; improved?: boolean } | null; caution?: string | null;
  context: { baseline: { untrained: number | null; trained: number | null; teacher: number | null } } }
const pct = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const describe = (r: Recipe) => `${r.sources.map((s) => `${s.arm}/s${s.seed}×${s.weight}`).join(" + ")} · strength ${r.strength}${r.layers ? ` · layers ${r.layers[0]}–${r.layers[1]}` : ""}${r.modules !== "all" ? ` · ${r.modules} only` : ""}${r.rank ? ` · rank ${r.rank}` : ""}`;

/** Weight Lab → Auto-tune with Azure: the frontier model proposes recipes, a person approves, FORGE builds and measures them. */
export function AutoTune({ studies }: { studies: StudyRow[] }) {
  const a = useAssistant();
  const [sid, setSid] = useState("");
  const [rounds, setRounds] = useState(6);
  const [approve, setApprove] = useState(true);
  const [goal, setGoal] = useState("");
  const [who] = useReviewer();
  const runs = useApi<{ id: string; study_id: string; status: string; rounds: number }[]>("/api/autotune", 5000);
  const latest = runs.data?.[0];
  const run = useApi<RunT>(latest ? `/api/autotune/${latest.id}` : null, 3000);
  const act = useAction();
  const [notes, setNotes] = useState<Record<number, string>>({});
  if (!a.available) return null;
  const r = run.data;
  const active = r?.status === "running";
  const s = sid || studies[0]?.id || "";
  return (
    <Panel title="Auto-tune with Azure" eyebrow="you approve each step" right={r ? <Status s={active ? "running" : r.status === "completed" ? "pass" : r.status === "failed" ? "fail" : "warn"} label={r.status} /> : undefined}>
      <div className="space-y-3 text-[12.5px]">
        {!active && (
          <>
            <p className="text-ink-2">Your Azure model ({a.deployment}) suggests one Weight Lab recipe per round from per-skill practice results and failure types. You approve or reject each one; FORGE builds it with exact arithmetic and measures it on practice (dev) tasks. It never sees task text or weights, and the sealed test is never used.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Study (trained and analysed)"><select className={inputCls} value={s} onChange={(e) => setSid(e.target.value)}>{studies.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
              <Field label={`Rounds · ${rounds}`}><input type="range" min={1} max={20} value={rounds} onChange={(e) => setRounds(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Rounds" /></Field>
            </div>
            <Field label="Goal (optional, no personal data)"><input className={cx(inputCls, "font-sans")} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. improve routing accuracy without losing hand-backs" /></Field>
            <div className="flex flex-wrap items-center gap-3">
              <Toggle checked={approve} onChange={setApprove} label="I approve each proposal (recommended)" />
              <Button tone="primary" icon="spark" busy={act.busy} disabled={!s} onClick={() => void act.run(async () => { await api.post("/api/autotune", { study_id: s, rounds, approve_each: approve, goal }); await runs.reload(); })}>Start auto-tune</Button>
            </div>
            {!who && <Notice tone="warn">Set your name (Governance page or a review panel) so approvals are recorded with it.</Notice>}
          </>
        )}
        {r && (
          <div className="space-y-2 border-t border-line pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-ink-2">Baseline (dev): untrained {pct(r.context.baseline.untrained)} · trained <b className="text-ink">{pct(r.context.baseline.trained)}</b> · teacher {pct(r.context.baseline.teacher)}</span>
              <span className="flex items-center gap-2">{r.best && (r.best.improved ? <Badge tone="good">best: round {r.best.round} · {pct(r.best.overall)}</Badge> : <Badge tone="warn">no variant beat the trained adapter</Badge>)}
                {active && <Button size="sm" tone="danger" onClick={() => void act.run(async () => { await api.post(`/api/autotune/${r.id}/stop`); await run.reload(); })}>Stop</Button>}</span>
            </div>
            <ol className="space-y-2">{[...r.rounds].reverse().map((x) => (
              <li key={x.round} className={cx("rounded-[var(--radius)] border p-2.5", x.decision === "pending" ? "border-accent" : "border-line")}>
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-ink">Round {x.round}</span>
                  <Badge tone={x.decision === "approved" ? "good" : x.decision === "pending" ? "accent" : x.decision === "rejected" || x.decision === "invalid" ? "warn" : "default"}>{x.decision}{x.decided_by ? ` · ${x.decided_by}` : ""}</Badge></div>
                {x.rationale && <p className="mt-1 text-ink-2">“{x.rationale}”</p>}
                {x.recipe && <div className="mt-1 font-mono text-[11.5px] text-ink">{describe(x.recipe)}</div>}
                {x.error && <div className="mt-1 text-[11.5px] text-crit-ink">Refused by FORGE: {x.error}</div>}
                {x.note && <div className="mt-1 text-[11.5px] text-ink-3">note: {x.note}</div>}
                {x.decision === "pending" && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input className={cx(inputCls, "!w-56 font-sans")} placeholder="note (optional)" value={notes[x.round] ?? ""} onChange={(e) => setNotes({ ...notes, [x.round]: e.target.value })} aria-label="Decision note" />
                    <Button size="sm" tone="primary" onClick={() => void act.run(async () => { await api.post(`/api/autotune/${r.id}/decision`, { round: x.round, decision: "approved", note: notes[x.round] ?? "" }); await run.reload(); })}>Approve & build</Button>
                    <Button size="sm" onClick={() => void act.run(async () => { await api.post(`/api/autotune/${r.id}/decision`, { round: x.round, decision: "rejected", note: notes[x.round] ?? "" }); await run.reload(); })}>Reject</Button>
                  </div>)}
                {x.result && (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-1.5 text-[11.5px]">
                    <span>dev <b className="text-ink">{pct(x.result.overall)}</b>{x.result.delta_vs_trained != null && <span className={x.result.delta_vs_trained > 0 ? "text-good-ink" : x.result.delta_vs_trained < 0 ? "text-crit-ink" : "text-ink-3"}> ({x.result.delta_vs_trained > 0 ? "+" : ""}{Math.round(x.result.delta_vs_trained * 100)} pts vs trained)</span>}</span>
                    {Object.entries(x.result.per_skill).map(([k, v]) => <span key={k} className="text-ink-2">{k} {pct(v)}</span>)}
                    {x.result.guardrail_violated && <span className="text-crit-ink">hand-back success dropped — not eligible as best</span>}
                  </div>)}
              </li>))}</ol>
            {r.caution && <Notice tone="honesty">{r.caution}</Notice>}
          </div>
        )}
        <ErrorLine error={act.error ?? run.error} />
      </div>
    </Panel>
  );
}
