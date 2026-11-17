import { useMemo, useState, type FormEvent } from "react";
import { HeatStrip, Spectrum } from "../components/charts";
import { LineageGraph } from "../components/graphs";
import { StudySelect } from "../components/live";
import { Badge, Button, Empty, ErrorLine, Field, KV, Notice, PageHeader, Panel, Prov, Readout, Segmented, Status, cx, inputCls, td, th, tr } from "../components/ui";
import { api, fmt, qs } from "../lib/api";
import { useAction, useApi } from "../lib/hooks";
import { usePrefs } from "../lib/prefs";
import type { Inspection, LineageNode, LineageT, StudySummary } from "../lib/types";

export default function Factory() {
  const { prefs } = usePrefs();
  const sid = prefs.activeStudy;
  const s = useApi<StudySummary>(sid ? `/api/studies/${sid}` : null);
  return (
    <div className="space-y-4">
      <PageHeader kicker="Research" title="Model Factory" subtitle="What the adapter actually changed, measured from its weights; the provenance of every artifact; and merged exports. Original weights are never modified — every derivative is a new hashed artifact."
        right={<StudySelect />} />
      {!sid ? <Panel><Empty icon="factory">No study selected.</Empty></Panel> : (
        <>
          {s.data && <Inspector sid={sid} s={s.data} />}
          {s.data && <Lineage sid={sid} />}
          {s.data && <ExportPanel s={s.data} />}
        </>
      )}
      <ManualInspect />
    </div>
  );
}

function Inspector({ sid, s }: { sid: string; s: StudySummary }) {
  const [arm, setArm] = useState(s.plan.arms[0]);
  const [seed, setSeed] = useState(s.plan.seeds[0]);
  const insp = useApi<Inspection>(`/api/studies/${sid}/inspection${qs({ arm, seed })}`);
  return (
    <Panel title="Adapter inspector" prov={<Prov kind="computed" source="safetensors · QR-core SVD" />}
      right={<div className="flex gap-2">
        <select className={cx(inputCls, "h-7 w-auto")} value={arm} onChange={(e) => setArm(e.target.value)} aria-label="Arm">{s.plan.arms.map((a) => <option key={a}>{a}</option>)}</select>
        <select className={cx(inputCls, "h-7 w-auto")} value={seed} onChange={(e) => setSeed(Number(e.target.value))} aria-label="Seed">{s.plan.seeds.map((x) => <option key={x} value={x}>seed {x}</option>)}</select></div>}>
      {insp.error ? <Empty icon="factory">{insp.error}</Empty> : insp.data ? <InspectionView d={insp.data} /> : <div className="h-40" />}
    </Panel>
  );
}

export function InspectionView({ d }: { d: Inspection }) {
  const [metric, setMetric] = useState<"relative" | "fro">(d.base_available ? "relative" : "fro");
  const [sel, setSel] = useState<string | null>(null);
  const layers = useMemo(() => [...new Set(d.modules.map((m) => m.layer).filter((x): x is number => x != null))].sort((a, b) => a - b), [d]);
  const kinds = useMemo(() => [...new Set(d.modules.map((m) => m.kind))], [d]);
  const cells = d.modules.filter((m) => m.layer != null).map((m) => ({ layer: m.layer!, kind: m.kind, module: m.module, value: metric === "relative" ? m.relative_change : m.delta_fro }));
  const cur = d.modules.find((m) => m.module === sel) ?? [...d.modules].sort((a, b) => b.delta_fro - a.delta_fro)[0];
  const top = [...d.modules].sort((a, b) => (b.relative_change ?? b.delta_fro) - (a.relative_change ?? a.delta_fro)).slice(0, 8);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Readout label="rank r" value={d.r} size="sm" />
        <Readout label="α · scale" value={`${d.alpha}`} unit={`s=${d.scale.toFixed(2)}${d.use_rslora ? " (rsLoRA)" : ""}`} size="sm" />
        <Readout label="adapted modules" value={d.modules.length} size="sm" />
        <Readout label="trainable params" value={fmt.exact(d.total_trainable_params)} size="sm" />
        <Readout label="mean eff. rank" value={(d.modules.reduce((a, m) => a + m.effective_rank, 0) / d.modules.length).toFixed(2)} unit={`/ ${d.r}`} size="sm" />
      </div>
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="micro text-ink-3">Per-layer weight change · layer × module</span>
          <Segmented label="Metric" value={metric} onChange={setMetric} options={[{ value: "relative", label: "‖ΔW‖/‖W‖" }, { value: "fro", label: "‖ΔW‖_F" }]} />
        </div>
        {metric === "relative" && !d.base_available && <div className="mb-2 text-[11.5px] text-warn-ink">Base weights unavailable — relative change cannot be computed.</div>}
        <HeatStrip cells={cells} layers={layers} kinds={kinds} metric={metric === "relative" ? "‖ΔW‖_F / ‖W‖_F" : "‖ΔW‖_F"} onSelect={setSel} selected={cur?.module} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <div className="micro mb-2 text-ink-3">Largest changes</div>
          <div className="scroll-thin overflow-x-auto"><table className="w-full text-[11.5px]"><thead><tr><th className={th}>Module</th><th className={cx(th, "text-right")}>‖ΔW‖_F</th><th className={cx(th, "text-right")}>relative</th><th className={cx(th, "text-right")}>eff. rank</th></tr></thead>
            <tbody>{top.map((m) => (
              <tr key={m.module} onClick={() => setSel(m.module)} className={cx(tr, "cursor-pointer", cur?.module === m.module && "!bg-accent-soft")}>
                <td className={cx(td, "font-mono text-[10.5px]")}>{m.module.replace(/^model\./, "")}</td><td className={cx(td, "num text-right font-mono")}>{m.delta_fro.toExponential(3)}</td>
                <td className={cx(td, "num text-right font-mono")}>{m.relative_change == null ? "—" : m.relative_change.toExponential(2)}</td><td className={cx(td, "num text-right font-mono")}>{m.effective_rank.toFixed(2)}</td>
              </tr>))}</tbody></table></div>
        </div>
        {cur && (
          <div>
            <div className="micro mb-1 !normal-case !tracking-normal text-ink-3">Singular spectrum · {cur.module.replace(/^model\./, "")}</div>
            <div className="mb-2 font-mono text-[10.5px] text-ink-3">shape {cur.shape.join(" × ")} · ‖ΔW‖_F {cur.delta_fro.toExponential(3)}</div>
            <Spectrum sigma={cur.singular_values} effRank={cur.effective_rank} />
          </div>
        )}
      </div>
      <div className="text-[11px] leading-relaxed text-ink-3">ΔW = s·B·A. σ(ΔW) is computed from the r×r core after thin QR of B and Aᵀ — the full matrix is never materialized. ‖ΔW‖_F = √Σσ²; effective rank = exp(H(σ/Σσ)). These are measured weight changes, not explanations of behavior.</div>
    </div>
  );
}

function Lineage({ sid }: { sid: string }) {
  const g = useApi<LineageT>(`/api/studies/${sid}/lineage`, 15000);
  const [open, setOpen] = useState<LineageNode | null>(null);
  const [text, setText] = useState<string | null>(null);
  const act = useAction();
  const openNode = (n: LineageNode) => {
    setOpen(n); setText(null);
    if (!n.path) return;
    void act.run(async () => setText(await api.get<string>(`/api/studies/${sid}/file${qs({ path: n.path!.endsWith("adapter") ? n.path!.replace(/adapter$/, "run.json") : n.path })}`)));
  };
  return (
    <Panel title="Lineage" prov={<Prov kind="measured" source="manifests on disk" />} right={<span className="text-[11px] text-ink-3">click a node to open its evidence</span>}>
      {g.data ? <LineageGraph g={g.data} onOpen={openNode} /> : <ErrorLine error={g.error} />}
      {open && (
        <div className="mt-3 rounded-[var(--radius)] border border-line">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-1.5"><span className="font-mono text-[11px] text-ink-2">{open.path ?? open.label}</span>{open.digest && <span className="font-mono text-[10.5px] text-ink-3">sha {open.digest}</span>}</div>
          <ErrorLine error={act.error} />
          <pre className="scroll-thin max-h-80 overflow-auto p-3 font-mono text-[10.5px] text-ink-2">{open.path ? (text ?? "loading…") : "No file: this node is an external reference."}</pre>
        </div>
      )}
    </Panel>
  );
}

function ExportPanel({ s }: { s: StudySummary }) {
  const st = s.state.stages.export;
  return (
    <Panel title="Export" prov={<Prov kind="declared" />} right={<Status s={st?.status ?? "pending"} />}>
      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="space-y-2 text-[12px] text-ink-2">
          <p>Export merges the primary arm's seed-0 adapter into a <b className="text-ink">new</b> bf16 directory and immediately re-evaluates it on the test split. An export is only usable if its post-merge behaviour agrees with the adapter run.</p>
          {st?.summary ? <KV rows={Object.entries(st.summary as Record<string, unknown>).map(([k, v]) => [k, typeof v === "number" ? (k.includes("agreement") ? fmt.pct(v) : String(v)) : String(v)])} /> : null}
          <Notice tone="warn">GGUF conversion and Ollama deployment are deferred until after the MVP. A merged export is not deployment approval.</Notice>
        </div>
        <div className="flex flex-col items-start gap-2">
          <Badge>{s.state.sealed ? "sealed" : "requires SEAL + test analysis"}</Badge>
          <Button icon="studio" onClick={() => { window.location.hash = "/studio"; }}>Run from Studio</Button>
        </div>
      </div>
    </Panel>
  );
}

function ManualInspect() {
  const [path, setPath] = useState("");
  const [base, setBase] = useState("");
  const [d, setD] = useState<Inspection | null>(null);
  const act = useAction();
  const submit = (e: FormEvent) => { e.preventDefault(); void act.run(async () => setD(await api.get<Inspection>(`/api/analysis/adapter${qs({ path, base: base || undefined })}`))); };
  return (
    <Panel title="Inspect any adapter" eyebrow="manual" prov={<Prov kind="computed" />}>
      <form onSubmit={submit} className="grid gap-2 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <Field label="Adapter directory" hint="Under FORGE home or a registered model directory. safetensors only."><input className={inputCls} value={path} onChange={(e) => setPath(e.target.value)} placeholder="C:\\…\\adapter" /></Field>
        <Field label="Base model directory (optional)"><input className={inputCls} value={base} onChange={(e) => setBase(e.target.value)} placeholder="for ‖ΔW‖/‖W‖" /></Field>
        <Button type="submit" tone="primary" disabled={!path} busy={act.busy}>Inspect</Button>
      </form>
      <div className="mt-2"><ErrorLine error={act.error} /></div>
      {d && <div className="mt-4"><InspectionView d={d} /></div>}
    </Panel>
  );
}
