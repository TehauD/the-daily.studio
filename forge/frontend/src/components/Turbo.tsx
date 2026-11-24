import { Figure } from "./results";
import { useState } from "react";
import { api } from "../lib/api";
import { goto } from "../lib/handoff";
import { useAction, useApi } from "../lib/hooks";
import { usePrefs } from "../lib/prefs";
import type { StudySummary } from "../lib/types";
import { Badge, Button, ErrorLine, Field, Notice, Panel, Prov, Segmented, Toggle, cx, td, th, tr } from "./ui";

export type TurboT = { attention: string; packing: boolean; liger: boolean; quant_4bit: boolean; optim_8bit: boolean; checkpointing: string; compile: boolean };
interface Opts { defaults: TurboT; labels: Record<string, string>; availability: { cuda: boolean; switches: Record<string, { available: boolean; why_not: string | null }>; install_hint: string } }
const WHAT: Record<string, string> = {
  liger: "Fused GPU kernels (loss without the full vocabulary logits, RMSNorm, RoPE, SwiGLU): less memory, often faster.",
  quant_4bit: "QLoRA: the frozen model loaded in 4-bit, adapters in 16-bit. Lets 16 GB train larger students.",
  optim_8bit: "8-bit optimizer state: less memory for the same updates.",
  packing: "No padding: several short examples share one row, kept separate. Needs flash-attention and micro-batch > 1.",
  compile: "Compiles the model graph: faster steps after a slow start.",
};

/** The FORGE Turbo switches, with what each does and whether this machine can run it. */
export function TurboPicker({ value, onChange, device }: { value: TurboT; onChange: (t: TurboT) => void; device: string }) {
  const o = useApi<Opts>("/api/studies/turbo/options");
  const sw = o.data?.availability.switches ?? {};
  const can = (k: string) => device === "cuda" && (sw[k]?.available ?? false);
  const why = (k: string) => (device !== "cuda" ? "GPU studies only" : sw[k]?.why_not ?? "");
  const set = (p: Partial<TurboT>) => onChange({ ...value, ...p });
  return (
    <div className="space-y-2.5 text-[12px]">
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Attention kernel"><Segmented label="Attention" value={value.attention} onChange={(v) => set({ attention: v, packing: v === "flash_attention_2" ? value.packing : false })}
          options={[{ value: "sdpa", label: "PyTorch fused" }, ...(can("attention:flash_attention_2") ? [{ value: "flash_attention_2", label: "flash-attn 2" }] : []), { value: "eager", label: "reference" }]} /></Field>
        <Field label="Activation memory"><Segmented label="Activation memory" value={value.checkpointing} onChange={(v) => set({ checkpointing: v })}
          options={[{ value: "on", label: "recompute" }, { value: "offload", label: "CPU offload" }, { value: "off", label: "keep (fastest)" }]} /></Field>
      </div>
      {(["liger", "quant_4bit", "optim_8bit", "packing", "compile"] as const).map((k) => {
        const ok = k === "packing" ? can("packing") && value.attention === "flash_attention_2" : can(k);
        return (
          <div key={k} className={cx("flex items-start justify-between gap-3", !ok && "opacity-60")} title={ok ? WHAT[k] : why(k)}>
            <div><div className="text-ink">{o.data?.labels[k] ?? k}</div><div className="text-[11px] text-ink-3">{ok ? WHAT[k] : `Unavailable: ${k === "packing" && can("packing") ? "choose flash-attn 2" : why(k)}`}</div></div>
            <Toggle checked={value[k] && ok} onChange={(v) => ok && set({ [k]: v } as Partial<TurboT>)} label={o.data?.labels[k] ?? k} />
          </div>);
      })}
      {o.data && !Object.values(sw).every((x) => x.available) && <div className="text-[11px] text-ink-3">{o.data.availability.install_hint} (or run <span className="font-mono">setup.ps1 -WithML -WithTurbo</span>)</div>}
    </div>
  );
}

interface Row { study_id: string; name: string; is_source: boolean; engine: string; micro_batch: number; grad_accum: number; trained: boolean; wall_s: number | null; peak_vram_mb: number | null;
  steps: number | null; tokens_per_s: number | null; energy_wh: number | null; final_loss: number | null; loss_curve: [number, number][]; dev_success: number | null }

/** Training Lab → FORGE Turbo: this study's switches, re-train with others on the same data, and compare. */
export function TurboCompare({ s }: { s: StudySummary }) {
  const { set } = usePrefs();
  const cmp = useApi<{ rows: Row[]; note: string }>(`/api/studies/${s.id}/engine-compare`, 8000);
  const opts = useApi<Opts>("/api/studies/turbo/options");
  const cur = { ...(opts.data?.defaults ?? {}), ...((s.plan.train as Record<string, unknown>).turbo as TurboT | undefined) } as TurboT;
  const [t, setT] = useState<TurboT | null>(null);
  const [mb, setMb] = useState<number | null>(null);
  const act = useAction();
  const eff = Number(s.plan.train.micro_batch) * Number(s.plan.train.grad_accum);
  const micro = mb ?? Number(s.plan.train.micro_batch);
  const rows = cmp.data?.rows ?? [];
  const pts = rows.flatMap((r) => r.loss_curve);
  const W = 520, H = 160, P = 28;
  const maxX = Math.max(1, ...pts.map((p) => p[0])), maxY = Math.max(1e-6, ...pts.map((p) => p[1])), minY = Math.min(...pts.map((p) => p[1]), maxY);
  const x = (v: number) => P + (v / maxX) * (W - 2 * P), y = (v: number) => H - P - ((v - minY) / (maxY - minY || 1)) * (H - 2 * P);
  const f = (v: number | null, d = 0, u = "") => (v == null ? "—" : `${v.toFixed(d)}${u}`);
  return (
    <Panel title="FORGE Turbo — training engine" eyebrow="same data, different engine settings" prov={<Prov kind="measured" source="run.json · training.jsonl · dev analysis" />}>
      <div className="space-y-4 text-[12.5px]">
        <p className="text-ink-2">Each switch changes <b className="text-ink">how</b> training runs (speed, memory), not what it learns from. Re-train this study with other switches: FORGE reuses its tasks and the teacher's examples exactly, then you compare speed, memory, energy, the loss curve and task success side by side.</p>
        {rows.length > 0 && (
          <div className="overflow-x-auto"><table className="w-full"><thead><tr>{["Study", "Engine", "Batch", "Wall", "Tokens/s", "Peak VRAM", "Energy", "Final loss", "Dev success"].map((h, i) => <th key={h} className={cx(th, i > 1 && "text-right")}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={r.study_id} className={tr}>
                <td className={td}><button type="button" className="text-left text-accent underline-offset-2 hover:underline" onClick={() => { set("activeStudy", r.study_id); goto("training"); }}>{r.name}</button> {r.is_source && <Badge>source</Badge>}</td>
                <td className={cx(td, "text-ink-2")}><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: `var(--cat-${(i % 8) + 1})` }} />{r.engine}</td>
                <td className={cx(td, "num text-right font-mono")}>{r.micro_batch}×{r.grad_accum}</td>
                {r.trained ? <>
                  <td className={cx(td, "num text-right font-mono")}>{f(r.wall_s, 0, " s")}</td><td className={cx(td, "num text-right font-mono")}>{f(r.tokens_per_s, 0)}</td>
                  <td className={cx(td, "num text-right font-mono")}>{r.peak_vram_mb == null ? "—" : `${(r.peak_vram_mb / 1024).toFixed(1)} GB`}</td><td className={cx(td, "num text-right font-mono")}>{f(r.energy_wh, 1, " Wh")}</td>
                  <td className={cx(td, "num text-right font-mono")}>{f(r.final_loss, 3)}</td><td className={cx(td, "num text-right font-mono")}>{r.dev_success == null ? "—" : `${Math.round(r.dev_success * 100)}%`}</td>
                </> : <td colSpan={6} className={cx(td, "text-ink-3")}>not trained yet — open it and run Build → Train → Evaluate · dev</td>}
              </tr>))}</tbody></table></div>)}
        {pts.length > 1 && (
          <Figure title="Training loss by engine" y="training loss (cross-entropy, nats/token)" x="optimizer step"
            caption="Overlapping curves = same learning, different speed. Colours match the table above.">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[640px]" role="img" aria-label="Training loss by engine">
            <text x={P} y={12} fontSize="10" fill="var(--ink-3)">training loss by step — overlapping curves = same learning, different speed</text>
            {rows.map((r, i) => r.loss_curve.length > 1 && <polyline key={r.study_id} fill="none" stroke={`var(--cat-${(i % 8) + 1})`} strokeWidth="1.6" points={r.loss_curve.map(([a, b]) => `${x(a)},${y(b)}`).join(" ")} />)}
            <text x={W - P} y={H - 8} textAnchor="end" fontSize="10" fill="var(--ink-3)">step {maxX}</text>
          </svg></Figure>)}
        {pts.length > 1 && <div className="flex flex-wrap gap-x-4 text-[11px] text-ink-2">{rows.filter((r) => r.loss_curve.length > 1).map((r) => {
          const i = rows.indexOf(r); return <span key={r.study_id} className="flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ background: `var(--cat-${(i % 8) + 1})` }} />{r.engine}</span>; })}
          <span className="text-ink-3">(drawn in this order; if you see one line, the curves coincide)</span></div>}
        <details className="rounded-[var(--radius)] border border-line p-3" open={!rows.some((r) => !r.is_source)}>
          <summary className="cursor-pointer text-ink">Re-train this study with other settings</summary>
          <div className="mt-3 space-y-3">
            <TurboPicker value={t ?? cur} onChange={setT} device={s.plan.device} />
            <Field label={`Micro-batch · ${micro} (× accumulation ${Math.max(1, Math.round(eff / micro))} = effective batch ${eff}, unchanged)`}>
              <input type="range" min={1} max={Math.min(16, eff)} value={micro} onChange={(e) => setMb(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Micro-batch" /></Field>
            {eff % micro !== 0 && <Notice tone="warn">Choose a micro-batch that divides the effective batch ({eff}).</Notice>}
            <Button tone="primary" icon="flask" busy={act.busy} disabled={eff % micro !== 0} onClick={() => void act.run(async () => {
              const r = await api.post<{ id: string }>(`/api/studies/${s.id}/clone`, { name: `${s.plan.name} · turbo`, turbo: t ?? cur, micro_batch: micro, grad_accum: eff / micro });
              await cmp.reload(); set("activeStudy", r.id); goto("studio"); })}>Create the comparison study</Button>
            <div className="text-[11.5px] text-ink-3">The new study starts with Collect already done (copied). Run Build → Train → Evaluate · dev → Analyze · dev, then come back here.</div>
          </div>
        </details>
        <div className="text-[11.5px] text-ink-3">{cmp.data?.note}</div>
        <ErrorLine error={act.error ?? cmp.error} />
      </div>
    </Panel>
  );
}
