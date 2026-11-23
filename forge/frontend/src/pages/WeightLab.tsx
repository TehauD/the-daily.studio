import { Fragment, useMemo, useState } from "react";
import { JobLog } from "../components/live";
import { Badge, Button, Empty, ErrorLine, Field, Notice, PageHeader, Panel, Prov, Segmented, Status, cx, inputCls, td, th, tr } from "../components/ui";
import { api, fmt } from "../lib/api";
import { useAction, useApi } from "../lib/hooks";
import { usePrefs } from "../lib/prefs";
import type { Job, StudyRow } from "../lib/types";

interface Rates { overall: number | null; n: number; per_skill: Record<string, number> }
interface Evaluation { study_id: string; study_name: string; split: string; variant: Rates; base: Rates; tuned: Rates & { arm: string; seed: number }; teacher: Rates; invalid_rate: number; generated_at: string }
interface Variant {
  id: string; name: string; created_at: string; status: string; built: boolean; strength: number; layers: [number, number] | null; modules: string; rank: number | null;
  student: string | null; base_hash: string | null; sources: { study_id: string; study_name: string; arm: string; seed: number; weight: number }[];
  report?: { modules: number; rank: number; masked_modules: number; size_bytes: number; rank_energy_kept: number | null; layers_seen: number[] };
  evaluations: Record<string, Evaluation>;
}
interface Src { study_id: string; arm: string; seed: number; weight: number }

const DIALS: [string, string][] = [
  ["Strength", "Multiplies everything the adapter learned. 0 = the untrained student, 1 = as trained, above 1 = exaggerated. Shows whether training went too far or not far enough — without retraining."],
  ["Mix sources", "Adds adapters together with weights: average the seeds of one study (often steadier), or combine skills from different agents (e.g. IT service desk + patient access) into one student. The sum is exact."],
  ["Layers & modules", "Keeps the change only in some layers or only in attention / MLP blocks. Reveals where in the network a skill lives."],
  ["Rank", "Compresses the change to fewer dimensions (SVD). Shows how much capacity a skill really needs; smaller adapters are faster to load and ship."],
];

export default function WeightLab() {
  const studies = useApi<StudyRow[]>("/api/studies", 10000);
  const variants = useApi<Variant[]>("/api/weightlab", 4000);
  const trained = (studies.data ?? []).filter((s) => s.stages?.train === "completed");
  const [jobId, setJobId] = useState<string | null>(null);
  return (
    <div className="space-y-4 fit:flex fit:h-full fit:min-h-0 fit:flex-col fit:gap-3 fit:space-y-0">
      <PageHeader kicker="Control the weights" title="Weight Lab"
        subtitle="Build new adapters from trained ones — turn their strength up or down, mix them, keep only some layers, compress them — then measure each variant on held-out tasks and try it in the Playground. Originals are never changed." />
      <div className="grid gap-4 fit:min-h-0 fit:flex-1 fit:grid-cols-[440px_minmax(0,1fr)] fit:gap-3">
        <div className="scroll-thin flex min-w-0 flex-col gap-4 fit:min-h-0 fit:gap-3 fit:overflow-auto fit:pr-1">
          <Builder studies={trained} onStarted={(j) => { setJobId(j); void variants.reload(); }} />
          {jobId && <Panel title="Working…" eyebrow="live"><JobLog key={jobId} jobId={jobId} height={150} onDone={() => { setJobId(null); void variants.reload(); }} /></Panel>}
          <Panel title="The four dials" eyebrow="what each one does">
            <dl className="space-y-2.5">{DIALS.map(([k, v]) => <div key={k}><dt className="text-[12.5px] font-semibold text-ink">{k}</dt><dd className="text-[12px] leading-relaxed text-ink-2">{v}</dd></div>)}</dl>
          </Panel>
        </div>
        <div className="scroll-thin min-w-0 space-y-4 fit:min-h-0 fit:space-y-3 fit:overflow-auto fit:pr-1">
          {!(variants.data ?? []).length ? <Panel><Empty icon="factory">No variants yet. Build one from a trained study.</Empty></Panel>
            : (variants.data ?? []).map((v) => <VariantCard key={v.id} v={v} studies={trained} onJob={setJobId} onChange={() => void variants.reload()} />)}
        </div>
      </div>
    </div>
  );
}

function Builder({ studies, onStarted }: { studies: StudyRow[]; onStarted: (job: string) => void }) {
  const [name, setName] = useState("");
  const [srcs, setSrcs] = useState<Src[]>([]);
  const [strength, setStrength] = useState(1);
  const [modules, setModules] = useState<"all" | "attention" | "mlp">("all");
  const [layers, setLayers] = useState<[string, string]>(["", ""]);
  const [rank, setRank] = useState("");
  const act = useAction();
  const first = studies[0];
  const add = (s?: StudyRow) => { const x = s ?? first; if (x) setSrcs([...srcs, { study_id: x.id, arm: x.arms[0], seed: x.seeds[0], weight: 1 }]); };
  const averageSeeds = (s: StudyRow) => { setSrcs(s.seeds.map((sd) => ({ study_id: s.id, arm: s.arms[0], seed: sd, weight: +(1 / s.seeds.length).toFixed(3) }))); setName(`${s.name} · seed average`); };
  const study = (id: string) => studies.find((s) => s.id === id);
  const build = () => void act.run(async () => {
    const r = await api.post<{ job: Job }>("/api/weightlab", { name: name || "variant", sources: srcs, strength, modules,
      layers: layers[0] !== "" && layers[1] !== "" ? [Number(layers[0]), Number(layers[1])] : null, rank: rank ? Number(rank) : null });
    onStarted(r.job.id);
  });
  return (
    <Panel title="Build a variant" eyebrow="new adapter" prov={<Prov kind="declared" source="recipe" />}>
      {!studies.length ? <Empty>Train a study first (Experiment Studio → Train).</Empty> : (
        <div className="space-y-3">
          <Field label="Name"><input className={cx(inputCls, "font-sans")} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. ITSM at 1.5× strength" /></Field>
          <div>
            <div className="micro mb-1.5 flex items-center justify-between text-ink-3"><span>sources (trained adapters)</span>
              <span className="flex gap-2"><button type="button" className="text-accent" onClick={() => add()}>+ add</button></span></div>
            {srcs.length === 0 && <div className="flex flex-wrap gap-1.5">{studies.slice(0, 6).map((s) => (
              <button key={s.id} type="button" onClick={() => (s.seeds.length > 1 ? averageSeeds(s) : add(s))} className="rounded-full border border-line px-2.5 py-1 text-[11.5px] text-ink-2 hover:border-accent-line">
                {s.seeds.length > 1 ? `average seeds · ${s.name}` : `start from ${s.name}`}</button>))}</div>}
            <div className="space-y-2">{srcs.map((x, i) => {
              const s = study(x.study_id);
              return (
                <div key={i} className="grid grid-cols-[1fr_auto] gap-2 rounded-[var(--radius)] border border-line p-2">
                  <div className="space-y-1.5">
                    <select className={inputCls} value={x.study_id} aria-label="Study" onChange={(e) => { const t = study(e.target.value)!; setSrcs(srcs.map((y, j) => (j === i ? { ...y, study_id: t.id, arm: t.arms[0], seed: t.seeds[0] } : y))); }}>
                      {studies.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                    <div className="grid grid-cols-2 gap-1.5">
                      <select className={inputCls} value={x.arm} aria-label="Arm" onChange={(e) => setSrcs(srcs.map((y, j) => (j === i ? { ...y, arm: e.target.value } : y)))}>{s?.arms.map((a) => <option key={a}>{a}</option>)}</select>
                      <select className={inputCls} value={x.seed} aria-label="Seed" onChange={(e) => setSrcs(srcs.map((y, j) => (j === i ? { ...y, seed: Number(e.target.value) } : y)))}>{s?.seeds.map((sd) => <option key={sd} value={sd}>seed {sd}</option>)}</select>
                    </div>
                    <label className="flex items-center gap-2 text-[11.5px] text-ink-2">weight <input type="range" min={-1} max={2} step={0.05} value={x.weight} className="flex-1 accent-[var(--accent)]"
                      onChange={(e) => setSrcs(srcs.map((y, j) => (j === i ? { ...y, weight: Number(e.target.value) } : y)))} /><span className="num w-10 text-right font-mono">{x.weight.toFixed(2)}</span></label>
                  </div>
                  <button type="button" className="micro self-start px-1 text-ink-3" onClick={() => setSrcs(srcs.filter((_, j) => j !== i))} aria-label="Remove source">×</button>
                </div>
              );
            })}</div>
          </div>
          <label className="block text-[12px] text-ink-2"><span className="micro text-ink-3">strength · {strength.toFixed(2)}×</span>
            <input type="range" min={0} max={2.5} step={0.05} value={strength} onChange={(e) => setStrength(Number(e.target.value))} className="mt-1 w-full accent-[var(--accent)]" aria-label="Strength" /></label>
          <Field label="Modules"><Segmented label="Modules" value={modules} onChange={setModules} options={[{ value: "all", label: "all" }, { value: "attention", label: "attention only" }, { value: "mlp", label: "MLP only" }]} /></Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="From layer"><input className={inputCls} type="number" min={0} value={layers[0]} placeholder="all" onChange={(e) => setLayers([e.target.value, layers[1]])} /></Field>
            <Field label="To layer"><input className={inputCls} type="number" min={0} value={layers[1]} placeholder="all" onChange={(e) => setLayers([layers[0], e.target.value])} /></Field>
            <Field label="Rank"><input className={inputCls} type="number" min={1} value={rank} placeholder="keep" onChange={(e) => setRank(e.target.value)} /></Field>
          </div>
          <Button tone="primary" icon="factory" busy={act.busy} disabled={!srcs.length} onClick={build}>Build variant</Button>
          <div className="text-[11px] text-ink-3">Builds in seconds on the CPU; the sources and the base model are untouched.</div>
          <ErrorLine error={act.error} />
        </div>
      )}
    </Panel>
  );
}

function bar(v: number | null | undefined, color: string) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-[6px] w-24 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full" style={{ width: `${(v ?? 0) * 100}%`, background: color }} /></div>
      <span className="num w-10 font-mono text-[11px] text-ink">{fmt.pct(v, 0)}</span>
    </div>
  );
}

function VariantCard({ v, studies, onJob, onChange }: { v: Variant; studies: StudyRow[]; onJob: (j: string) => void; onChange: () => void }) {
  const { set } = usePrefs();
  const compatible = useMemo(() => studies, [studies]);
  const [target, setTarget] = useState(v.sources[0]?.study_id ?? "");
  const act = useAction();
  const evals = Object.values(v.evaluations);
  const recipe = [
    v.sources.map((s) => `${s.weight >= 0 ? "" : "−"}${Math.abs(s.weight).toFixed(2)} × ${s.study_name} (${s.arm} s${s.seed})`).join(" + "),
    `strength ${v.strength}×`, v.modules !== "all" ? `${v.modules} only` : null, v.layers ? `layers ${v.layers[0]}–${v.layers[1]}` : null, v.rank ? `rank ${v.rank}` : null,
  ].filter(Boolean).join(" · ");
  return (
    <Panel title={v.name} eyebrow={`variant · ${fmt.ago(v.created_at)}`} prov={<Prov kind={v.built ? "computed" : "declared"} source={v.built ? "built adapter" : "recipe"} />}
      right={<Status s={v.status === "built" ? "pass" : v.status === "pending" ? "running" : "fail"} label={v.status} />}>
      <div className="space-y-3">
        <div className="break-words font-mono text-[11.5px] leading-relaxed text-ink-2">{recipe}</div>
        {v.report && <div className="flex flex-wrap gap-1.5"><Badge>{v.report.modules} modules</Badge><Badge>rank {v.report.rank}</Badge><Badge>{fmt.bytes(v.report.size_bytes)}</Badge>
          {v.report.masked_modules > 0 && <Badge tone="warn">{v.report.masked_modules} switched off</Badge>}
          {v.report.rank_energy_kept != null && <Badge tone="accent">keeps {fmt.pct(v.report.rank_energy_kept, 0)} of the change</Badge>}</div>}
        {evals.length > 0 && (
          <div className="scroll-thin overflow-x-auto"><table className="w-full min-w-[620px] text-[12px]">
            <thead><tr><th className={th}>Measured on (dev)</th><th className={th}>Untrained</th><th className={th}>Trained</th><th className={th}>This variant</th><th className={th}>Teacher</th></tr></thead>
            <tbody>{evals.map((e) => (
              <Fragment key={e.study_id}>
                <tr className={tr}><td className={cx(td, "font-medium text-ink")}>{e.study_name} <span className="text-ink-3">· {e.variant.n} tasks</span></td>
                  <td className={td}>{bar(e.base.overall, "var(--s-base)")}</td><td className={td}>{bar(e.tuned.overall, "var(--s-tuned)")}</td>
                  <td className={td}>{bar(e.variant.overall, "var(--cat-7)")}</td><td className={td}>{bar(e.teacher.overall, "var(--s-teacher)")}</td></tr>
                {Object.keys(e.variant.per_skill).map((k) => (
                  <tr key={e.study_id + k} className="border-t border-line/50 text-ink-3"><td className={cx(td, "pl-6 text-[11.5px]")}>{k}</td>
                    <td className={td}>{bar(e.base.per_skill[k], "var(--s-base)")}</td><td className={td}>{bar(e.tuned.per_skill[k], "var(--s-tuned)")}</td>
                    <td className={td}>{bar(e.variant.per_skill[k], "var(--cat-7)")}</td><td className={td}>{bar(e.teacher.per_skill[k], "var(--s-teacher)")}</td></tr>
                ))}
              </Fragment>
            ))}</tbody>
          </table></div>
        )}
        {v.built && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-2.5">
            <select className={cx(inputCls, "!w-auto font-sans")} value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Study to measure on">
              {compatible.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <Button size="sm" icon="evaluation" busy={act.busy} onClick={() => void act.run(async () => onJob((await api.post<Job>(`/api/weightlab/${v.id}/evaluate`, { study_id: target })).id))}>Measure on dev</Button>
            <Button size="sm" icon="play" onClick={() => { try { sessionStorage.setItem("forge.playground.variant", v.id); } catch { /* ignore */ } set("activeStudy", target); window.location.hash = "/playground"; }}>Try in Playground</Button>
            <Button size="sm" tone="ghost" onClick={() => void act.run(async () => { await api.del(`/api/weightlab/${v.id}`); onChange(); })}>Delete</Button>
          </div>
        )}
        {evals.length === 0 && v.built && <Notice tone="info">Measure it to compare with the untrained student, the trained student and the teacher, skill by skill.</Notice>}
        <ErrorLine error={act.error} />
      </div>
    </Panel>
  );
}
