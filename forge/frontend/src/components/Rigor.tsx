import { useState } from "react";
import { Explain } from "./Explain";
import { Figure, fmtPct } from "./results";
import { Badge, Button, Empty, ErrorLine, Notice, Panel, Prov, cx, td, th, tr } from "./ui";
import { api } from "../lib/api";
import { JobLog } from "./live";
import { useAction, useApi } from "../lib/hooks";
import type { Job } from "../lib/types";
import { usePrefs } from "../lib/prefs";

export interface PowerT {
  design: { groups: number; paraphrases: number; seeds: number; alpha: number; target_power: number };
  assumptions: { base_rate: number; sd_group: number; sd_seed: number; source: string };
  min_gain: number; power_at_min_gain: { realized_gain: number; power_groups: number; power_seeds: number; power_both: number };
  mde_groups: number | null; mde_both: number | null; seed_floor_p: number; notes: string[];
  alternatives: { seeds: number; groups: number; tasks: number; mde_groups: number | null; seed_test_possible: boolean }[];
  observed_gain?: number; reading?: string;
}
interface ForgetArm { status: string; pooled: { perplexity: number; change: number; ci: number[]; passages_worse: number; passages: number }; seeds: Record<string, { perplexity: number; change: number }> }
export interface ForgettingT { computed?: false; source: string; passages: number; threshold: number; base: { perplexity: number; tokens: number }; arms: Record<string, ForgetArm>; method: string; honesty: string }

const pts = (v: number | null | undefined) => (v == null ? "—" : `${(v * 100).toFixed(1)} pts`);
const pct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)} %`;

/** Preregistered power: what this design can detect, frozen before training. */
export function PowerPanel({ p }: { p: PowerT | null }) {
  const { prefs } = usePrefs();
  if (!p) return (
    <Panel title="Could this study tell?" prov={<Prov kind="declared" />}>
      <Empty icon="info">No power analysis was frozen with this study (created before v0.30). New studies preregister one automatically.</Empty>
    </Panel>);
  const d = p.design;
  const seedsOk = p.seed_floor_p < d.alpha;
  const maxM = Math.max(...p.alternatives.map((a) => a.mde_groups ?? 0), p.observed_gain ?? 0, 0.01);
  return (
    <Panel title="Could this study tell?" prov={<Prov kind="computed" source="preregistered with the plan" />}
      right={<Explain title="Power analysis" what={<>Before training, FORGE simulated thousands of replicate studies with this exact design ({d.groups} task groups × {d.paraphrases} wordings, {d.seeds} seed(s)) to find the smallest gain it would detect 80 % of the time.</>}
        read={<ul className="list-disc space-y-1 pl-4"><li><b>Detectable gain</b>: smaller real gains are often missed, so "no significant gain" is weak evidence of no effect.</li><li><b>Seed floor</b>: with S seeds the seed test can never go below 2/2^S; the review gate needs ≥ 6 seeds.</li><li>Assumptions come from a pilot study when one is given — the recommended path.</li></ul>}
        math={<p>Beta-binomial task groups; true gain varies by group (sd {p.assumptions.sd_group}) and seed (sd {p.assumptions.sd_seed}); t-test over groups, exact sign-flip over seeds; α = {d.alpha}.</p>} />}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--radius)] border border-line p-3"><div className="text-[11.5px] text-ink-3">detectable gain (80 % power)</div><div className="num font-mono text-[22px] text-ink">{p.mde_groups == null ? "> 60 pts" : `≥ ${pts(p.mde_groups)}`}</div><div className="text-[11px] text-ink-3">task-group test</div></div>
        <div className="rounded-[var(--radius)] border border-line p-3"><div className="text-[11.5px] text-ink-3">power at the preregistered minimum ({pts(p.min_gain)})</div><div className="num font-mono text-[22px] text-ink">{fmtPct(p.power_at_min_gain.power_groups)}</div><div className="text-[11px] text-ink-3">both tests: {fmtPct(p.power_at_min_gain.power_both)}</div></div>
        <div className="rounded-[var(--radius)] border border-line p-3"><div className="text-[11.5px] text-ink-3">seed-test floor</div><div className="num font-mono text-[22px] text-ink">p ≥ {p.seed_floor_p.toFixed(p.seed_floor_p < 0.01 ? 4 : 3)}</div><div className="text-[11px]">{seedsOk ? <span className="text-good-ink">can reach p &lt; {d.alpha}</span> : <span className="text-crit-ink">can never reach p &lt; {d.alpha}</span>}</div></div>
      </div>
      {p.reading && <p className="mt-3 text-[12.5px] text-ink-2"><b className="text-ink">Observed {pts(p.observed_gain)}.</b> {p.reading}</p>}
      {p.notes.map((n) => <div key={n} className="mt-2"><Notice tone="info">{n}</Notice></div>)}
      {prefs.mode !== "expert" ? <p className="mt-3 text-[12px] text-ink-3">Expert mode shows how more seeds or task groups would change this.</p> : <Figure title="Detectable gain by design" x="smallest gain detected 80 % of the time (task-group test) — shorter is more sensitive"
        caption={<>Assumptions: untrained rate {fmtPct(p.assumptions.base_rate)}, group spread {p.assumptions.sd_group}, seed spread {p.assumptions.sd_seed} — {p.assumptions.source}.</>}>
        <div className="space-y-1.5">{p.alternatives.map((a) => {
          const cur = a.seeds === d.seeds && a.groups === d.groups;
          return (
            <div key={`${a.seeds}-${a.groups}`} className="flex items-center gap-2 text-[11.5px]">
              <span className={cx("w-[150px] shrink-0 text-right", cur ? "font-semibold text-ink" : "text-ink-2")}>{a.seeds} seeds · {a.groups} groups{cur ? " (this)" : ""}</span>
              <span className="relative block h-3.5 flex-1 rounded-sm bg-surface-3" role="img" aria-label={`${a.seeds} seeds, ${a.groups} groups: detects ${pts(a.mde_groups)}${a.seed_test_possible ? "" : ", seed test cannot pass"}`}>
                <span className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${((a.mde_groups ?? maxM) / maxM) * 100}%`, background: cur ? "var(--s-tuned)" : "var(--seq-2)", opacity: 0.85 }} />
                {p.observed_gain != null && <span className="absolute -top-0.5 h-[18px] w-0.5 bg-ink" style={{ left: `${(Math.max(0, p.observed_gain) / maxM) * 100}%` }} title="observed gain" />}
              </span>
              <span className="num w-16 shrink-0 text-right font-mono text-ink">{pts(a.mde_groups)}</span>
              <span className="w-[68px] shrink-0">{a.seed_test_possible ? <Badge tone="good">seed test</Badge> : <Badge>no seed test</Badge>}</span>
            </div>); })}
          {p.observed_gain != null && <div className="pl-[158px] text-[10.5px] text-ink-3">black tick = observed gain</div>}
        </div>
      </Figure>}
    </Panel>
  );
}

const FSTATUS: Record<string, { tone: "good" | "warn" | "crit"; label: string }> = {
  no_material_drift: { tone: "good", label: "no material drift" }, lower: { tone: "good", label: "lower (easier)" }, inconclusive: { tone: "warn", label: "inconclusive" }, forgetting: { tone: "crit", label: "forgetting" } };

/** Forgetting: general-text perplexity before and after training. */
export function ForgettingPanel({ sid, arms, name }: { sid: string; arms: string[]; name: (a: string) => string }) {
  const r = useApi<ForgettingT>(`/api/studies/${sid}/forgetting`);
  const act = useAction();
  const [job, setJob] = useState<string | null>(null);
  const [file, setFile] = useState("");
  const f = r.data && r.data.computed !== false ? r.data : null;
  const span = f ? Math.min(1, Math.max(0.3, ...Object.values(f.arms).flatMap((a) => [Math.abs(a.pooled.ci[0]), Math.abs(a.pooled.ci[1]), ...Object.values(a.seeds).map((z) => Math.abs(z.change))]))) : 0.3;
  const x = (v: number) => 50 + (Math.max(-span, Math.min(span, v)) / span) * 50;
  return (
    <Panel title="What did it cost? Everyday language" prov={<Prov kind="measured" source={f ? f.source : "not run yet"} />}
      right={<Explain title="Forgetting check" what={<>Perplexity — how surprised the model is by ordinary English, exp(loss) per token — on general text unrelated to the tasks, before and after training.</>}
        read={<ul className="list-disc space-y-1 pl-4"><li>A rise means the student now predicts everyday text less well: it traded general language for the skill.</li><li><b>Forgetting</b> = the whole 95 % range above +{((f?.threshold ?? 0.05) * 100).toFixed(0)} %; <b>no material drift</b> = the whole range below it; <b>lower</b> = the whole range below −{((f?.threshold ?? 0.05) * 100).toFixed(0)} % (ordinary text became easier to predict).</li></ul>}
        math={<p>{f?.method ?? "perplexity = exp(mean token NLL); paired per passage; bootstrap over passages"}</p>} />}>
      {!f ? <p className="text-[12.5px] text-ink-2">Not run yet. Runs on the trained adapters (any time after Train), uses no task data, and takes a few minutes per seed on a GPU.</p> : (
        <Figure title="Change in general-text perplexity after training" x={`relative change (−${Math.round(span * 100)}% … +${Math.round(span * 100)}%) · lower perplexity is better`}
          caption={<>Untrained perplexity {f.base.perplexity.toFixed(2)} on {f.passages} passages ({f.base.tokens} tokens). Dots: each seed; bar: seeds pooled with 95 % range. Shaded: within ±{(f.threshold * 100).toFixed(0)} %.</>}>
          <div className="space-y-2.5">{arms.filter((a) => f.arms[a]).map((a) => { const v = f.arms[a]; const s = FSTATUS[v.status]; return (
            <div key={a} className="flex items-center gap-2 text-[11.5px]">
              <span className="w-[120px] shrink-0 text-right text-ink-2">{name(a)}</span>
              <span className="relative block h-5 flex-1 rounded bg-surface-2" role="img" aria-label={`${name(a)}: perplexity ${pct(v.pooled.change)}, 95% ${pct(v.pooled.ci[0])} to ${pct(v.pooled.ci[1])}, ${s.label}`}>
                <span className="absolute inset-y-0 bg-surface-3" style={{ left: `${x(-f.threshold)}%`, width: `${x(f.threshold) - x(-f.threshold)}%` }} />
                <span className="absolute inset-y-0 w-px bg-ink-3" style={{ left: "50%" }} />
                <span className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-ink-2" style={{ left: `${x(v.pooled.ci[0])}%`, width: `${Math.max(0.6, x(v.pooled.ci[1]) - x(v.pooled.ci[0]))}%` }} />
                {Object.entries(v.seeds).map(([sd, z]) => <span key={sd} title={`seed ${sd}: ${pct(z.change)}`} className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-surface" style={{ left: `${x(z.change)}%`, background: "var(--s-tuned)" }} />)}
              </span>
              <span className="num w-[64px] shrink-0 text-right font-mono text-ink">{pct(v.pooled.change)}</span>
              <span className="w-[120px] shrink-0"><Badge tone={s.tone}>{s.label}</Badge></span>
            </div>); })}
            <div className="flex justify-between pl-[128px] pr-[192px] font-mono text-[10px] text-ink-3"><span>−{Math.round(span * 100)}%</span><span>0</span><span>+{Math.round(span * 100)}%</span></div>
          </div>
        </Figure>)}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-[11.5px] text-ink-2">Your own general text (optional, a .txt on this machine; blank lines separate passages)
          <input className="rounded-[var(--radius)] border border-line bg-surface px-2 py-1.5 font-mono text-[12px] text-ink" value={file} placeholder="built-in passages" onChange={(e) => setFile(e.target.value)} /></label>
        <Button icon="play" busy={act.busy || !!job} onClick={() => void act.run(async () => { setJob((await api.post<Job>(`/api/studies/${sid}/forgetting`, { text_file: file.trim() || null })).id); })}>{f ? "Run again" : "Run the forgetting check"}</Button>
      </div>
      <ErrorLine error={act.error} />
      {job && <div className="mt-2"><JobLog key={job} jobId={job} height={140} onDone={() => { setJob(null); void r.reload(); }} /></div>}
      {f && <p className="mt-2 text-[11.5px] text-ink-3">{f.honesty}</p>}
    </Panel>
  );
}

/** Small table: training vs prompting, per split. */
export function PromptingTable({ rows }: { rows: { label: string; gain: number | null; ci: (number | null)[]; p: number | null }[] }) {
  return (
    <div className="overflow-x-auto" tabIndex={0} aria-label="Training versus prompting, scrollable"><table className="w-full min-w-[420px] text-[12px]">
      <thead><tr><th className={th}>comparison</th><th className={cx(th, "text-right")}>difference</th><th className={cx(th, "text-right")}>95 % range</th><th className={cx(th, "text-right")}>p (groups)</th></tr></thead>
      <tbody>{rows.map((r) => (
        <tr key={r.label} className={tr}><td className={td}>{r.label}</td><td className={cx(td, "num text-right font-mono")}>{r.gain == null ? "—" : `${r.gain >= 0 ? "+" : "−"}${Math.abs(r.gain * 100).toFixed(1)} pts`}</td>
          <td className={cx(td, "num text-right font-mono")}>{r.ci[0] == null ? "—" : `${(r.ci[0] * 100).toFixed(1)} … ${((r.ci[1] ?? 0) * 100).toFixed(1)}`}</td>
          <td className={cx(td, "num text-right font-mono")}>{r.p == null ? "—" : r.p < 0.001 ? "< 0.001" : r.p.toFixed(3)}</td></tr>))}</tbody></table></div>
  );
}
