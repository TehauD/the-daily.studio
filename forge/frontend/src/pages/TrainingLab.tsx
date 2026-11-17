import { useState, type FormEvent } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Button, Empty, ErrorLine, PageHeader, Panel, Stat } from "../components/ui";
import { api, fmt } from "../lib/api";
import { useApi } from "../lib/hooks";
import type { Estimate } from "../lib/types";

interface Profiles {
  gpu: boolean; summary: string; budget_mb?: number;
  profiles: { params_b: number; method: string; fits: boolean; max_safe_seq_len: number | null; est_total_mb: number | null }[];
}

const TONE = { safe: "signal", tight: "amber", unsafe: "alert", no_gpu: "default", not_applicable: "default" } as const;

export function TrainingLab() {
  const profiles = useApi<Profiles>("/api/system/profiles");
  const [form, setForm] = useState({ params_b: 1.5, quant: "nf4", lora_rank: 16, seq_len: 2048, micro_batch: 1, grad_checkpointing: true, target_all_linear: true, override: "" });
  const [est, setEst] = useState<Estimate | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(null);
    const { override, ...rest } = form;
    try {
      setEst(await api.post<Estimate>("/api/system/estimate", { ...rest, available_vram_mb: override ? Number(override) : null }));
    } catch (x) { setErr((x as Error).message); }
  };
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const breakdown = est ? [
    { k: "weights", v: est.weights_mb }, { k: "LoRA+optimizer", v: est.trainable_state_mb },
    { k: "activations", v: est.activations_mb }, { k: "logits", v: est.logits_mb }, { k: "CUDA overhead", v: est.overhead_mb },
  ] : [];
  const input = "w-full rounded border border-edge bg-ink px-2 py-1.5 font-mono text-xs text-zinc-200 outline-none focus:border-cyan/50";

  return (
    <div className="space-y-4">
      <PageHeader title="Training Lab" subtitle="Pre-flight memory planning against measured VRAM. Job launch (TRL + PEFT) ships in Phase 3 and will refuse unsafe configurations." />
      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <Panel title="Memory estimator">
          <form onSubmit={submit} className="space-y-3">
            <label className="block text-xs text-zinc-400">Parameters (billions)
              <input className={input} type="number" step="0.1" min="0.05" value={form.params_b} onChange={(e) => set("params_b", Number(e.target.value))} /></label>
            <label className="block text-xs text-zinc-400">Base weight precision
              <select className={input} value={form.quant} onChange={(e) => set("quant", e.target.value)}>
                <option value="nf4">NF4 4-bit (QLoRA)</option><option value="int8">INT8</option><option value="bf16">BF16 (LoRA)</option>
              </select></label>
            <div className="grid grid-cols-3 gap-2">
              <label className="text-xs text-zinc-400">Rank<input className={input} type="number" min="1" value={form.lora_rank} onChange={(e) => set("lora_rank", Number(e.target.value))} /></label>
              <label className="text-xs text-zinc-400">Seq len<input className={input} type="number" min="64" step="256" value={form.seq_len} onChange={(e) => set("seq_len", Number(e.target.value))} /></label>
              <label className="text-xs text-zinc-400">Micro-batch<input className={input} type="number" min="1" value={form.micro_batch} onChange={(e) => set("micro_batch", Number(e.target.value))} /></label>
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-400"><input type="checkbox" checked={form.grad_checkpointing} onChange={(e) => set("grad_checkpointing", e.target.checked)} />Gradient checkpointing</label>
            <label className="flex items-center gap-2 text-xs text-zinc-400"><input type="checkbox" checked={form.target_all_linear} onChange={(e) => set("target_all_linear", e.target.checked)} />Target all linear layers</label>
            <label className="block text-xs text-zinc-400">VRAM budget override (MB, blank = measured free)
              <input className={input} type="number" value={form.override} onChange={(e) => set("override", e.target.value)} /></label>
            <Button type="submit" tone="primary">Estimate</Button>
          </form>
          <div className="mt-3"><ErrorLine error={err} /></div>
        </Panel>
        <div className="space-y-4">
          <Panel title="Estimate">
            {!est ? <Empty>Run an estimate to see the memory breakdown.</Empty> : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-6">
                  <Stat label="Projected peak" value={fmt.mb(est.total_mb)} tone="cyan" />
                  <Stat label="Budget" value={fmt.mb(est.available_mb)} />
                  <Stat label="Utilization" value={est.utilization != null ? `${(est.utilization * 100).toFixed(0)}%` : "—"} />
                  <Stat label="Trainable params" value={fmt.params(est.lora_params)} />
                  <Badge tone={TONE[est.verdict]}>{est.verdict.replace("_", " ")}</Badge>
                </div>
                <div className="h-40">
                  <ResponsiveContainer>
                    <BarChart data={breakdown} layout="vertical" margin={{ left: 30, right: 16 }}>
                      <XAxis type="number" tick={{ fill: "#52525b", fontSize: 10 }} unit=" MB" />
                      <YAxis type="category" dataKey="k" tick={{ fill: "#a1a1aa", fontSize: 11 }} width={110} />
                      <Tooltip contentStyle={{ background: "#0d1112", border: "1px solid #1b2224", fontSize: 12 }} formatter={(v) => fmt.mb(Number(v))} />
                      <Bar dataKey="v" fill="#22d3ee" isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <ul className="list-inside list-disc text-xs text-zinc-500">{est.notes.map((n) => <li key={n}>{n}</li>)}<li>Analytic upper bound, ±25%; calibrated against measured peaks in Phase 3.</li></ul>
              </div>
            )}
          </Panel>
          <Panel title="Adaptive profiles (reference shapes)">
            <ErrorLine error={profiles.error} />
            {profiles.data && <div className="mb-3 text-sm text-zinc-300">{profiles.data.summary}</div>}
            {profiles.data?.gpu && (
              <table className="w-full font-mono text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-zinc-500"><tr><th className="py-1 text-left">Size</th><th className="text-left">LoRA (bf16)</th><th className="text-left">QLoRA (nf4)</th></tr></thead>
                <tbody>
                  {[...new Set(profiles.data.profiles.map((p) => p.params_b))].map((size) => (
                    <tr key={size} className="border-t border-edge/70">
                      <td className="py-1.5">{size}B</td>
                      {["lora", "qlora"].map((m) => {
                        const p = profiles.data!.profiles.find((x) => x.params_b === size && x.method === m)!;
                        return <td key={m} className={p.fits ? "text-signal" : "text-zinc-600"}>{p.fits ? `≤ ${p.max_safe_seq_len} tok · ${fmt.mb(p.est_total_mb)}` : "exceeds budget"}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
