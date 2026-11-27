import { useMemo, useState } from "react";
import { Figure, Limits, RangeBar, fmtPct } from "./results";
import { Badge, Button, Empty, ErrorLine, Field, Notice, Panel, Prov, Segmented, Skeleton, cx, inputCls, td, th, tr } from "./ui";
import { api } from "../lib/api";
import { goto, handoff } from "../lib/handoff";
import { useAction, useApi } from "../lib/hooks";

/* ------------------------------------------------------------------ training-data overlap */
interface OverlapT { generated_at: string; split: string; index: string; host: string; ngram: number; windows_per_task: number; queries: number; tasks: number;
  tested: number; too_short: number; hits: number; share: number | null; by_skill: Record<string, { tested: number; hits: number; too_short: number }>;
  examples: { task_id: string; skill: string; phrase: string; count: number }[]; honesty: string }
interface IndexT { enabled: boolean; url: string; index: string }

/** Inside "Is this a good test?": were the final-test questions in the base model's training data? */
export function OverlapBlock({ sid, onJob }: { sid: string; onJob?: () => void }) {
  const ov = useApi<OverlapT>(`/api/studies/${sid}/overlap`);
  const ix = useApi<IndexT>("/api/lineage/index");
  const act = useAction();
  const d = ov.data;
  const ready = ix.data?.enabled && ix.data.index;
  return (
    <div className="mt-3 rounded-[var(--radius)] border border-line p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-ink">Seen in training?</span>
        {d ? <Badge tone={d.hits ? "warn" : "good"}>{d.hits ? `${d.hits} of ${d.tested} ${d.split} questions overlap` : `no exact overlap in ${d.tested} ${d.split} questions`}</Badge> : <Badge>not checked</Badge>}
        <span className="ml-auto flex items-center gap-2">
          {ready ? <Button size="sm" busy={act.busy} onClick={() => void act.run(async () => { await api.post(`/api/studies/${sid}/overlap`, { split: "test" }); onJob?.(); })}>{d ? "Check again" : "Check the final test"}</Button>
            : <Button size="sm" onClick={() => goto("settings")}>Set up a training-data index</Button>}
        </span>
      </div>
      <p className="mt-1 text-[11.5px] text-ink-3">Looks up {d?.ngram ?? 13}-word windows of each question in an index of the base model's training data (open-data models such as OLMo publish theirs). Only the synthetic questions are sent.</p>
      <ErrorLine error={act.error} />
      {d && (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-1.5">{Object.entries(d.by_skill).map(([k, v]) => <Badge key={k} tone={v.hits ? "warn" : "default"}>{k}: {v.hits}/{v.tested}{v.too_short ? ` · ${v.too_short} too short` : ""}</Badge>)}</div>
          {d.examples.length > 0 && <ul className="space-y-1">{d.examples.slice(0, 5).map((e) => <li key={e.task_id} className="text-[11.5px]"><span className="font-mono text-ink-3">{e.skill} · {e.task_id}</span> “{e.phrase}” <span className="text-ink-3">— {e.count.toLocaleString()} occurrence(s)</span></li>)}</ul>}
          <p className="text-[11px] text-ink-3">Index {d.index} at {d.host} · {d.queries} lookups · {new Date(d.generated_at).toLocaleString()}. {d.honesty}</p>
        </div>)}
    </div>
  );
}

/** Settings → where the training-data index lives. Off by default. */
export function IndexSettings() {
  const ix = useApi<IndexT>("/api/lineage/index");
  const [f, setF] = useState<IndexT | null>(null);
  const v = f ?? ix.data;
  const act = useAction();
  if (!v) return <Skeleton h={120} />;
  return (
    <Panel title="Training-data index" prov={<Prov kind="declared" source="settings" />}>
      <div className="space-y-3 text-[12.5px]">
        <p className="text-ink-2">Used by <b>Is this a good test? → Seen in training?</b> to look up final-test questions in the base model's training data. It speaks the
          infini-gram API (AI2 hosts indexes of its open corpora; you can also run an index on this machine). Copy the index name exactly as the provider lists it for your base model.</p>
        <Notice tone="warn">Turning this on sends the <b>synthetic test questions</b> of a study to the index URL when you press the button — nothing else, never real data. Use it only with synthetic tasks unless your organisation approves otherwise.</Notice>
        <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={v.enabled} onChange={(e) => setF({ ...v, enabled: e.target.checked })} /> Enable the overlap check</label>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Index URL" hint="https, or http on this machine"><input className={inputCls} value={v.url} onChange={(e) => setF({ ...v, url: e.target.value })} /></Field>
          <Field label="Index name" hint="as listed by the provider for your base model's training data"><input className={inputCls} value={v.index} placeholder="e.g. the OLMo corpus index name" onChange={(e) => setF({ ...v, index: e.target.value })} /></Field>
        </div>
        <div className="flex items-center gap-3"><Button tone="primary" icon="check" busy={act.busy} disabled={!f} onClick={() => void act.run(async () => { await api.put("/api/lineage/index", v); setF(null); await ix.reload(); })}>Save</Button>
          {f && <span className="text-[12px] text-warn-ink">Unsaved changes</span>}</div>
        <ErrorLine error={act.error} />
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ checkpoint timeline */
interface Point { kind: "checkpoint" | "study_base" | "study_trained" | "teacher"; label: string; stage: string; order: number; split: string; ref: string;
  rate: number | null; ci: number[] | null; n: number; per_skill: Record<string, { rate: number; n: number }>; revision?: string | null }
interface TimelineT { points: Point[]; sealed: boolean; honesty: string }
interface ModelT { id: string; name: string; provider: string; storage_path: string | null; parameter_count: number | null; capabilities: Record<string, { status: string }> }

const KIND: Record<Point["kind"], { color: string; label: string }> = {
  checkpoint: { color: "var(--ink-3)", label: "base-model checkpoint" }, study_base: { color: "var(--s-base)", label: "this study's untrained student" },
  study_trained: { color: "var(--s-tuned)", label: "this study's trained student" }, teacher: { color: "var(--s-teacher)", label: "teacher" } };

function Chart({ pts, skill }: { pts: Point[]; skill: string }) {
  const W = 760, H = 250, L = 44, R = 14, T = 10, B = 64;
  const x = (i: number) => L + ((i + 0.5) / pts.length) * (W - L - R);
  const y = (v: number) => T + (1 - v) * (H - T - B);
  const val = (p: Point) => (skill ? p.per_skill[skill]?.rate ?? null : p.rate);
  // Connect only the training path (checkpoints → untrained → trained); the teacher is a reference, not a next stage.
  const line = pts.map((p, i) => [x(i), val(p), p.kind] as const).filter(([, v, k]) => v != null && k !== "teacher");
  const short = (p: Point) => (p.kind === "study_base" ? "untrained" : p.kind === "study_trained" ? "trained (adapter)" : p.kind === "teacher" ? "teacher" : p.label);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full max-w-[980px]" role="img" aria-label={`Success rate across the base model's checkpoints and this study's models${skill ? `, skill ${skill}` : ""}; the table lists every value.`}>
      {[0, 0.25, 0.5, 0.75, 1].map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" /><text x={L - 6} y={y(v) + 4} fontSize={11} textAnchor="end" fill="var(--ink-3)">{v * 100}%</text></g>)}
      <polyline fill="none" stroke="var(--line-strong)" strokeWidth={1.5} strokeDasharray="4 3" points={line.map(([a, b]) => `${a},${y(b as number)}`).join(" ")} />
      {pts.map((p, i) => { const v = val(p); const c = KIND[p.kind].color; return (
        <g key={`${p.ref}${p.split}`}>
          {v != null && !skill && p.ci && <line x1={x(i)} x2={x(i)} y1={y(p.ci[1])} y2={y(p.ci[0])} stroke={c} strokeWidth={2} strokeOpacity={0.6} />}
          {v != null && <circle cx={x(i)} cy={y(v)} r={6} fill={c} stroke="var(--surface)" strokeWidth={1.5}><title>{`${p.label}: ${fmtPct(v, 1)}${p.ci && !skill ? ` (95% ${fmtPct(p.ci[0])}–${fmtPct(p.ci[1])})` : ""}, n=${skill ? p.per_skill[skill]?.n ?? 0 : p.n}`}</title></circle>}
          <text x={x(i)} y={H - B + 16} fontSize={10.5} textAnchor="middle" fill="var(--ink-2)">{short(p).length > 22 ? `${short(p).slice(0, 21)}…` : short(p)}<title>{p.label}</title></text>
          <text x={x(i)} y={H - B + 30} fontSize={10} textAnchor="middle" fill="var(--ink-3)">{p.kind === "checkpoint" ? p.stage || "checkpoint" : p.kind === "teacher" ? "reference" : "this study"}</text>
        </g>); })}
    </svg>
  );
}

/** History → Checkpoint timeline: the skill through the base model's own training stages, then through this study. */
export function CheckpointTimeline({ sid }: { sid: string | null }) {
  const tl = useApi<TimelineT>(sid ? `/api/studies/${sid}/checkpoints` : null, 15000);
  const models = useApi<{ models: ModelT[] }>("/api/models");
  const [split, setSplit] = useState("dev");
  const [skill, setSkill] = useState("");
  const [f, setF] = useState({ model_id: "", label: "", stage: "", order: "1" });
  const act = useAction();
  const local = (models.data?.models ?? []).filter((m) => m.storage_path && m.capabilities?.inference?.status === "supported");
  const pts = useMemo(() => (tl.data?.points ?? []).filter((p) => p.split === split).sort((a, b) => a.order - b.order), [tl.data, split]);
  const skills = useMemo(() => [...new Set(pts.flatMap((p) => Object.keys(p.per_skill)))].sort(), [pts]);
  if (!sid) return <Panel><Empty icon="clock">Choose a study in the top bar.</Empty></Panel>;
  const compare = (p: Point) => { handoff("compare.a", p.ref); goto("compare"); };
  return (
    <div className="space-y-4">
      <Panel title="Checkpoint timeline" prov={<Prov kind="measured" source="this study's tasks" />}
        right={<div className="flex flex-wrap gap-2"><Segmented label="Split" value={split} onChange={setSplit} options={[{ value: "dev", label: "practice (dev)" }, { value: "test", label: "final test" }]} />
          <select className={cx(inputCls, "!w-auto font-sans")} value={skill} onChange={(e) => setSkill(e.target.value)} aria-label="Skill"><option value="">all skills</option>{skills.map((s) => <option key={s}>{s}</option>)}</select></div>}>
        <ErrorLine error={tl.error} />
        {!tl.data ? <Skeleton h={250} /> : !pts.some((p) => p.kind === "checkpoint") ? (
          <Empty icon="clock">No checkpoints measured yet on {split === "dev" ? "practice tasks" : "the final test"}. Add one below — for OLMo 3, e.g. the base, SFT, DPO and Instruct stages.</Empty>) : (
          <Figure title={`Success rate (strict) through training${skill ? ` · ${skill}` : ""}`} y="success rate" x="the base model's checkpoints in the order you gave, then this study"
            legend={Object.values(KIND).map((k) => ({ label: k.label, color: k.color }))}
            caption={<>{skill ? "Per-skill rates (no range shown; small n)." : "Whiskers: Wilson 95 % range."} All points ran the same {split === "dev" ? "practice" : "final-test"} tasks with the same tools and scoring — open any point in Compare to test a difference.</>}>
            <Chart pts={pts} skill={skill} />
          </Figure>)}
        {pts.length > 0 && (
          <div className="mt-3 overflow-x-auto" tabIndex={0} aria-label="Timeline values, scrollable">
            <table className="w-full min-w-[640px] text-[12px]"><thead><tr><th className={th}>order</th><th className={th}>model</th><th className={th}>stage</th><th className={cx(th, "w-[26%]")}>rate · 95 % range</th><th className={cx(th, "text-right")}>n</th><th className={th}><span className="sr-only">actions</span></th></tr></thead>
              <tbody>{pts.map((p) => (
                <tr key={`${p.ref}${p.split}`} className={tr}><td className={cx(td, "num font-mono text-ink-3")}>{p.kind === "checkpoint" ? p.order : "—"}</td>
                  <td className={td}><span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: KIND[p.kind].color }} />{p.label}</span>{p.revision && <span className="ml-1 font-mono text-[10.5px] text-ink-3">@{p.revision.slice(0, 10)}</span>}</td>
                  <td className={cx(td, "text-ink-2")}>{p.stage || "—"}</td>
                  <td className={td}><div className="flex items-center gap-2"><span className="num w-10 font-mono">{fmtPct(p.rate)}</span><RangeBar rate={p.rate} ci={p.ci} className="flex-1" /></div></td>
                  <td className={cx(td, "num text-right font-mono text-ink-3")}>{p.n}</td>
                  <td className={cx(td, "text-right")}><Button size="sm" onClick={() => compare(p)}>Compare</Button></td></tr>))}</tbody></table>
          </div>)}
      </Panel>
      <Panel title="Add a checkpoint" prov={<Prov kind="declared" source="local models" />}>
        <div className="space-y-3 text-[12.5px]">
          <p className="text-ink-2">Download the checkpoint first (Model Hub, or <code className="font-mono">get-student.ps1 -Repo … -Revision …</code>) and run discovery. It runs this study's {split === "dev" ? "practice" : "final-test"} tasks with its own chat template; a raw base checkpoint, never trained for chat or tools, is expected to score low — that is part of the story.</p>
          <div className="grid gap-3 md:grid-cols-[2fr_1.2fr_1fr_0.6fr]">
            <Field label="Checkpoint (local model)"><select className={inputCls} value={f.model_id} onChange={(e) => setF({ ...f, model_id: e.target.value, label: f.label || (local.find((m) => m.id === e.target.value)?.name.split("/").pop() ?? "") })}>
              <option value="">—</option>{local.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
            <Field label="Label"><input className={inputCls} value={f.label} placeholder="e.g. OLMo 3 7B SFT" onChange={(e) => setF({ ...f, label: e.target.value })} /></Field>
            <Field label="Stage"><input className={inputCls} value={f.stage} placeholder="base / SFT / DPO / RL" onChange={(e) => setF({ ...f, stage: e.target.value })} /></Field>
            <Field label="Order"><input className={inputCls} value={f.order} inputMode="decimal" onChange={(e) => setF({ ...f, order: e.target.value })} /></Field>
          </div>
          {split === "test" && !tl.data?.sealed && <Notice tone="info">The final test opens for checkpoints after the study is sealed; practice tasks work now.</Notice>}
          <Button tone="primary" icon="play" busy={act.busy} disabled={!f.model_id || !f.label.trim() || (split === "test" && !tl.data?.sealed)}
            onClick={() => void act.run(async () => { await api.post(`/api/studies/${sid}/checkpoints`, { ...f, order: Number(f.order) || 0, split }); setF({ model_id: "", label: "", stage: "", order: String((Number(f.order) || 0) + 1) }); })}>
            Measure on {split === "dev" ? "practice tasks" : "the final test"}</Button>
          <ErrorLine error={act.error} />
        </div>
      </Panel>
      {tl.data && <Limits>{tl.data.honesty}</Limits>}
    </div>
  );
}
