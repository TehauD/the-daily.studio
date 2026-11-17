import { useState, type FormEvent } from "react";
import { LearningCurve } from "../components/charts";
import { StudySelect } from "../components/live";
import { Button, Checklist, Empty, ErrorLine, Field, Hash, KV, PageHeader, Panel, Prov, Readout, Status, Toggle, cx, inputCls, td, th, tr } from "../components/ui";
import { api, fmt, qs } from "../lib/api";
import { useAction, useApi } from "../lib/hooks";
import { usePrefs } from "../lib/prefs";
import type { Estimate, Model, StudySummary } from "../lib/types";

interface Profiles { gpu: boolean; summary: string; budget_mb?: number; profiles: { params_b: number; method: string; fits: boolean; max_safe_seq_len: number | null; est_total_mb: number | null }[] }
interface RunT { rows: Record<string, unknown>[]; run: Record<string, unknown> & { preflight?: { check: string; status: string; detail: string }[]; token_stats?: Record<string, number> } | null }

export default function Training() {
  return (
    <div className="space-y-4">
      <PageHeader kicker="Research" title="Training Lab" subtitle="Plan memory against measured VRAM, then inspect each LoRA run: pre-flight gates, the zero-adapter check, loss curves, token exposure, and peak memory."
        right={<StudySelect />} />
      <Runs />
      <Estimator />
    </div>
  );
}

function Runs() {
  const { prefs } = usePrefs();
  const sid = prefs.activeStudy;
  const s = useApi<StudySummary>(sid ? `/api/studies/${sid}` : null);
  const arms = s.data?.plan.arms ?? [];
  const seeds = s.data?.plan.seeds ?? [];
  const [arm, setArm] = useState<string | null>(null);
  const [seed, setSeed] = useState<number | null>(null);
  const a = arm ?? arms[0], sd = seed ?? seeds[0];
  const run = useApi<RunT>(sid && a != null && sd != null ? `/api/studies/${sid}/training${qs({ arm: a, seed: sd })}` : null, 5000);
  const r = run.data?.run;
  const last = run.data?.rows.at(-1);
  return (
    <Panel title="Runs" prov={<Prov kind="measured" source="training.jsonl · run.json" />}
      right={arms.length > 0 && <div className="flex gap-2">
        <select className={cx(inputCls, "h-7 w-auto")} value={a} onChange={(e) => setArm(e.target.value)} aria-label="Arm">{arms.map((x) => <option key={x}>{x}</option>)}</select>
        <select className={cx(inputCls, "h-7 w-auto")} value={sd} onChange={(e) => setSeed(Number(e.target.value))} aria-label="Seed">{seeds.map((x) => <option key={x} value={x}>seed {x}</option>)}</select></div>}>
      {!sid ? <Empty icon="training">No study selected.</Empty> : !run.data?.rows.length && !r ? <Empty icon="training">No training output for {a} · seed {sd} yet. Run the train stage in Experiment Studio.</Empty> : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
            <Readout label="global step" value={(r?.global_step as number) ?? (last?.step as number) ?? "—"} size="sm" />
            <Readout label="tokens seen" value={fmt.exact((last?.tokens_seen as number) ?? null)} size="sm" sub="exact (Trainer counter)" />
            <Readout label="throughput" value={(last?.tokens_per_s as number) ?? "—"} unit="tok/s" size="sm" />
            <Readout label="peak VRAM" value={r?.peak_vram_mb ? fmt.mb(r.peak_vram_mb as number) : last?.peak_vram_mb ? fmt.mb(last.peak_vram_mb as number) : "—"} size="sm" sub="torch.max_memory_allocated" />
            <Readout label="trainable" value={fmt.params(r?.trainable_params as number)} size="sm" sub={r ? `of ${fmt.params(r.total_params as number)}` : ""} />
            <Readout label="wall time" value={r?.wall_s ? `${Number(r.wall_s).toFixed(0)}` : "—"} unit="s" size="sm" />
          </div>
          <LearningCurve rows={run.data?.rows ?? []} />
          {r && (
            <div className="grid gap-5 xl:grid-cols-2">
              <div><div className="micro mb-2 text-ink-3">Pre-flight & integrity gates</div>
                <Checklist items={[...(r.preflight ?? []).map((c) => ({ check: c.check, status: c.status, detail: c.detail })),
                  { check: "zero_adapter_logits", status: r.zero_adapter_max_abs_diff === 0 ? "pass" : "fail", detail: `max |Δlogit| with B=0 → ${r.zero_adapter_max_abs_diff}` },
                  { check: "lora_only_trainable", status: "pass", detail: "every requires_grad parameter name contains 'lora_'" },
                  { check: "base_hash_unchanged", status: r.base_hash_before === r.base_hash_after ? "pass" : "fail", detail: `${String(r.base_hash_before).slice(0, 16)} before = after` }]} /></div>
              <div><div className="micro mb-2 text-ink-3">Artifacts</div>
                <KV rows={[["adapter sha256", <Hash key="a" value={r.adapter_sha256 as string} n={20} />], ["base sha256", <Hash key="b" value={r.base_hash_before as string} n={20} />],
                  ["records", fmt.exact(r.token_stats?.records)], ["supervised tokens", fmt.exact(r.token_stats?.supervised_tokens)], ["total tokens", fmt.exact(r.token_stats?.tokens_total)],
                  ["max seq", fmt.exact(r.token_stats?.max_len)], ["resumed from", String(r.resumed_from ?? "—")], ["ended", fmt.time(r.ended_at as string)]]} /></div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function Estimator() {
  const profiles = useApi<Profiles>("/api/system/profiles");
  const models = useApi<{ models: Model[] }>("/api/models");
  const students = (models.data?.models ?? []).filter((m) => m.capabilities.lora?.status === "supported");
  const [f, setF] = useState({ params_b: 1.72, quant: "bf16", lora_rank: 16, seq_len: 2048, micro_batch: 1, grad_checkpointing: true, target_all_linear: true,
    hidden: 2048, layers: 28, intermediate: 6144, vocab: 151936, num_heads: 16, num_kv_heads: 8, head_dim: 128, override: "" });
  const [est, setEst] = useState<Estimate | null>(null);
  const act = useAction();
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const fromModel = (id: string) => {
    const m = students.find((x) => x.id === id);
    if (!m) return;
    const md = m.metadata as Record<string, number | undefined>;
    const unique = m.metadata.parameter_report?.unique_total ?? m.parameter_count ?? 0;
    setF((x) => ({ ...x, params_b: Number((unique / 1e9).toFixed(3)), hidden: md.hidden_size ?? x.hidden, layers: md.num_hidden_layers ?? x.layers,
      intermediate: md.intermediate_size ?? x.intermediate, vocab: md.vocab_size ?? x.vocab, num_heads: md.num_attention_heads ?? x.num_heads,
      num_kv_heads: md.num_key_value_heads ?? x.num_kv_heads, head_dim: md.head_dim ?? x.head_dim }));
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const { override, ...rest } = f;
    void act.run(async () => setEst(await api.post<Estimate>("/api/system/estimate", { ...rest, available_vram_mb: override ? Number(override) : null })));
  };
  const parts = est ? [{ k: "weights", v: est.weights_mb }, { k: "LoRA + AdamW state", v: est.trainable_state_mb }, { k: "activations", v: est.activations_mb }, { k: "logits (fp32 + grad)", v: est.logits_mb }, { k: "CUDA context", v: est.overhead_mb }].sort((a, b) => b.v - a.v) : [];
  const maxPart = Math.max(1, ...parts.map((p) => p.v));
  const num = (k: keyof typeof f, label: string, step = 1) => (
    <Field label={label}><input className={inputCls} type="number" step={step} value={f[k] as number} onChange={(e) => set(k, Number(e.target.value) as never)} /></Field>);
  return (
    <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
      <Panel title="Memory estimator" prov={<Prov kind="estimate" source="analytic upper bound" />}>
        <form onSubmit={submit} className="space-y-3">
          {students.length > 0 && <Field label="Load shape from student"><select className={inputCls} defaultValue="" onChange={(e) => fromModel(e.target.value)}><option value="">—</option>{students.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>}
          <div className="grid grid-cols-3 gap-2">{num("params_b", "Params (B)", 0.01)}{num("lora_rank", "Rank")}{num("seq_len", "Seq len", 256)}</div>
          <div className="grid grid-cols-3 gap-2">{num("hidden", "Hidden")}{num("layers", "Layers")}{num("intermediate", "MLP dim")}</div>
          <div className="grid grid-cols-3 gap-2">{num("num_heads", "Heads")}{num("num_kv_heads", "KV heads")}{num("head_dim", "Head dim")}</div>
          <div className="grid grid-cols-3 gap-2">{num("vocab", "Vocab")}{num("micro_batch", "Micro-batch")}
            <Field label="Base precision"><select className={inputCls} value={f.quant} onChange={(e) => set("quant", e.target.value)}><option value="bf16">bf16</option><option value="nf4">nf4</option><option value="int8">int8</option></select></Field></div>
          <div className="flex flex-wrap gap-4"><Toggle checked={f.grad_checkpointing} onChange={(v) => set("grad_checkpointing", v)} label="Grad checkpointing" /><Toggle checked={f.target_all_linear} onChange={(v) => set("target_all_linear", v)} label="All linear" /></div>
          <Field label="VRAM budget override (MB)" hint="Blank = measured free VRAM."><input className={inputCls} type="number" value={f.override} onChange={(e) => set("override", e.target.value)} /></Field>
          <Button type="submit" tone="primary" busy={act.busy}>Estimate</Button>
          <ErrorLine error={act.error} />
        </form>
      </Panel>
      <div className="min-w-0 space-y-4">
        <Panel title="Projected peak" prov={<Prov kind="estimate" source="±25%" />} right={est && <Status s={{ safe: "pass", tight: "warn", unsafe: "fail", no_gpu: "unknown" }[est.verdict as string] ?? "unknown"} label={est.verdict.replace("_", " ")} />}>
          {!est ? <Empty>Run an estimate. Bars rank the memory components; the verdict compares the total with measured free VRAM.</Empty> : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Readout label="projected peak" value={fmt.mb(est.total_mb)} tone="accent" />
                <Readout label="budget" value={fmt.mb(est.available_mb)} sub={est.available_mb ? "measured free" : "no GPU"} />
                <Readout label="utilization" value={est.utilization != null ? fmt.pct(est.utilization, 0) : "—"} />
                <Readout label="LoRA params" value={fmt.exact(est.lora_params)} sub={est.lora_breakdown?.exact ? "exact (GQA shape)" : "upper bound"} />
              </div>
              <ul className="space-y-1.5">{parts.map((p) => (
                <li key={p.k} className="grid grid-cols-[150px_1fr_80px] items-center gap-3 text-[11.5px]"><span className="text-ink-2">{p.k}</span>
                  <span className="h-[8px] rounded-[2px] bg-surface-3"><span className="block h-full rounded-[2px] bg-[color:var(--seq-2)]" style={{ width: `${(p.v / maxPart) * 100}%` }} /></span>
                  <span className="num text-right font-mono text-ink">{fmt.mb(p.v)}</span></li>))}
              </ul>
              {est.lora_breakdown && (
                <div className="scroll-thin overflow-x-auto"><table className="w-full text-[11.5px]"><thead><tr><th className={th}>Module</th>{Object.keys(est.lora_breakdown.per_layer).map((k) => <th key={k} className={cx(th, "text-right")}>{k.replace("_proj", "")}</th>)}<th className={cx(th, "text-right")}>× layers</th></tr></thead>
                  <tbody><tr className={tr}><td className={cx(td, "text-ink-3")}>r·(in+out)</td>{Object.values(est.lora_breakdown.per_layer).map((v, i) => <td key={i} className={cx(td, "num text-right font-mono")}>{fmt.exact(v)}</td>)}<td className={cx(td, "num text-right font-mono font-medium")}>{fmt.exact(est.lora_breakdown.total)}</td></tr></tbody></table></div>
              )}
              <ul className="list-inside list-disc text-[11.5px] text-ink-3">{est.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            </div>
          )}
        </Panel>
        <Panel flush title="Adaptive profiles" prov={<Prov kind="estimate" source="reference shapes" />}>
          <div className="px-[var(--pad)] pt-3 text-[12px] text-ink-2">{profiles.data?.summary}</div>
          {profiles.data?.gpu && (
            <table className="mt-2 w-full text-[12px]"><thead><tr className="bg-surface-2"><th className={th}>Size</th><th className={th}>LoRA · bf16</th><th className={th}>QLoRA · nf4 (post-MVP)</th></tr></thead>
              <tbody>{[...new Set(profiles.data.profiles.map((p) => p.params_b))].map((size) => (
                <tr key={size} className={tr}><td className={cx(td, "num font-mono")}>{size}B</td>
                  {["lora", "qlora"].map((m) => { const p = profiles.data!.profiles.find((x) => x.params_b === size && x.method === m)!; return (
                    <td key={m} className={td}>{p.fits ? <span className="num font-mono text-[11.5px] text-ink">≤ {p.max_safe_seq_len} tok · {fmt.mb(p.est_total_mb)}</span> : <Status s="fail" label="exceeds budget" />}</td>); })}
                </tr>))}
              </tbody></table>
          )}
        </Panel>
      </div>
    </div>
  );
}
