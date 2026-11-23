import { useState } from "react";
import { StudySelect } from "../components/live";
import { Badge, Empty, ErrorLine, Field, Notice, PageHeader, Panel, Prov, Status, Tabs, cx, inputCls, td, th, tr } from "../components/ui";
import { Term } from "../lib/glossary";
import { useApi } from "../lib/hooks";
import { usePrefs } from "../lib/prefs";
import { useReviewer } from "../lib/reviewer";

const pct = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const ARM = (a: string) => (a === "base" ? "untrained" : a === "teacher" ? "teacher" : a === "merged" ? "merged export" : `trained · ${a}`);
type TabK = "card" | "failures" | "limits" | "skills" | "audit" | "reports";

export default function Governance() {
  const { prefs } = usePrefs();
  const sid = prefs.activeStudy;
  const [tab, setTab] = useState<TabK>("card");
  const [who, setWho] = useReviewer();
  return (
    <div className="space-y-4">
      <PageHeader kicker="Measure" title="Governance" right={<StudySelect />}
        subtitle={<>Everything a reviewer needs: what the model is, how it fails, whether it knows when it doesn't know, who did what, and reports for each audience. Derived from recorded results only. <Term k="human">People decide</Term>.</>} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64"><Field label="Your name (recorded with your actions)" hint="Stored in this browser; a label, not a login."><input className={inputCls} value={who} onChange={(e) => setWho(e.target.value)} placeholder="e.g. J. Rivera, Patient Access" /></Field></div>
      </div>
      {!sid ? <Panel title="No study selected"><Empty icon="evaluation">Choose a study in the top bar.</Empty></Panel> : (
        <>
          <Tabs value={tab} onChange={setTab} tabs={[{ value: "card", label: "Model card" }, { value: "failures", label: "How it fails" }, { value: "limits", label: "Knows its limits?" },
            { value: "skills", label: "Skill curves" }, { value: "audit", label: "Who did what" }, { value: "reports", label: "Reports" }]} />
          {tab === "card" && <Card sid={sid} />}
          {tab === "failures" && <Failures sid={sid} />}
          {tab === "limits" && <Limits sid={sid} />}
          {tab === "skills" && <Skills sid={sid} />}
          {tab === "audit" && <Audit sid={sid} />}
          {tab === "reports" && <Reports sid={sid} />}
        </>
      )}
    </div>
  );
}

interface CardT {
  forge_version: string; generated_at: string; study: { id: string; name: string; profile: string; sealed: boolean; plan_sha256: string | null };
  model: { student: string; base_hash: string | null; method: string; adapter_sha256: string | null; teacher: string; train: Record<string, unknown> };
  intended_use: { statement: string; agent: { name: string; template: string; role: string; skills: string[]; tools: string[]; boundary: boolean } | null };
  data: { tasks: number; splits: Record<string, number>; training_records: number | null; human_review: { approved: number; corrected: number; rejected: number; pending: number } | null };
  results: Record<string, { untrained: number | null; trained: number | null; teacher: number | null; gain: number | null; ci: [number | null, number | null]; gate: string | null; confirmatory: boolean; per_skill: Record<string, Record<string, number>> }>;
  limitations: string[]; never_claimed: string[]; approval: string;
}

function Card({ sid }: { sid: string }) {
  const c = useApi<CardT>(`/api/studies/${sid}/card`);
  const d = c.data;
  if (!d) return <ErrorLine error={c.error} />;
  const h = (v: string | null) => (v ? `${v.slice(0, 16)}…` : "—");
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] [&>*]:min-w-0">
      <Panel title={`Model card — ${d.study.name}`} eyebrow={`generated ${new Date(d.generated_at).toLocaleString()}`} prov={<Prov kind="computed" source="study files" />}
        right={<a className="text-[12px] text-accent underline" href={`/api/studies/${sid}/card.md`} download>Download .md</a>}>
        <div className="space-y-4 text-[12.5px]">
          <Notice tone="honesty"><b>Not an approval.</b> {d.approval}</Notice>
          <section><div className="micro mb-1 text-ink-3">Intended use</div><p className="text-ink">{d.intended_use.statement}</p>
            {d.intended_use.agent && <p className="mt-1 text-ink-2"><b className="text-ink">{d.intended_use.agent.name}</b> · skills: {d.intended_use.agent.skills.join(", ")} · boundary suite {d.intended_use.agent.boundary ? "on" : "off"}</p>}</section>
          <section><div className="micro mb-1 text-ink-3">Results (strict success)</div>
            {!Object.keys(d.results).length ? <p className="text-ink-3">No analysed results yet.</p> : (
              <div className="overflow-x-auto"><table className="w-full"><thead><tr>{["Split", "Untrained", "Trained", "Teacher", "Gain (95 % range)", "Gate"].map((x) => <th key={x} className={th}>{x}</th>)}</tr></thead>
                <tbody>{Object.entries(d.results).map(([sp, r]) => (
                  <tr key={sp} className={tr}><td className={td}>{sp === "test" ? "sealed final test" : "practice (dev)"}</td><td className={cx(td, "num font-mono")}>{pct(r.untrained)}</td><td className={cx(td, "num font-mono text-accent")}>{pct(r.trained)}</td>
                    <td className={cx(td, "num font-mono")}>{pct(r.teacher)}</td><td className={cx(td, "num font-mono")}>{r.gain == null ? "—" : `${(r.gain * 100).toFixed(1)} pts`} <span className="text-ink-3">({pct(r.ci[0])} – {pct(r.ci[1])})</span></td>
                    <td className={td}>{r.gate ? <Badge tone={r.gate === "pass" ? "good" : "warn"}>{r.gate === "pass" ? "candidate for human review" : r.gate}</Badge> : "—"}</td></tr>))}</tbody></table></div>)}</section>
          <section><div className="micro mb-1 text-ink-3">Limitations</div><ul className="list-disc space-y-0.5 pl-5 text-ink-2">{d.limitations.map((x) => <li key={x}>{x}</li>)}</ul></section>
          <section><div className="micro mb-1 text-ink-3">FORGE never claims</div><p className="text-ink-2">{d.never_claimed.join(" · ")}</p></section>
        </div>
      </Panel>
      <Panel title="Provenance">
        <dl className="space-y-1.5 font-mono text-[11.5px]">
          {([["student", d.model.student], ["base hash", h(d.model.base_hash)], ["method", d.model.method], ["adapter sha256", h(d.model.adapter_sha256)], ["teacher", d.model.teacher],
            ["plan sha256", h(d.study.plan_sha256)], ["tasks", `${d.data.tasks} (train ${d.data.splits.train} · dev ${d.data.splits.dev} · test ${d.data.splits.test})`], ["training records", d.data.training_records ?? "—"],
            ["human review", d.data.human_review ? `${d.data.human_review.approved} ✓ · ${d.data.human_review.corrected} corrected · ${d.data.human_review.rejected} ✕ · ${d.data.human_review.pending} pending` : "—"],
            ["sealed", d.study.sealed ? "yes" : "no"], ["FORGE", d.forge_version]] as [string, unknown][]).map(([k, v]) => (
            <div key={k} className="grid grid-cols-[120px_1fr] gap-2"><dt className="text-ink-3">{k}</dt><dd className="break-all text-ink">{String(v)}</dd></div>))}
        </dl>
      </Panel>
    </div>
  );
}

interface FRow { arm: string; split: string; seed: number; episodes: number; failed: number; types: Record<string, number>; examples: Record<string, { task_id: string; prompt: string; expected: string; answer: string }[]> }
function Failures({ sid }: { sid: string }) {
  const f = useApi<{ types: Record<string, { label: string; means: string }>; rows: FRow[]; changes: { split: string; fixed: Record<string, number>; new: Record<string, number> }[]; note: string }>(`/api/studies/${sid}/failures`);
  const [open, setOpen] = useState<string | null>(null);
  const d = f.data;
  if (!d) return <ErrorLine error={f.error} />;
  const types = Object.keys(d.types).filter((k) => d.rows.some((r) => r.types[k]));
  const max = Math.max(1, ...d.rows.flatMap((r) => Object.values(r.types)));
  return (
    <div className="space-y-4">
      <Panel flush title="Failure types by model" prov={<Prov kind="computed" source="episode scores" />}>
        {!d.rows.length ? <Empty icon="evaluation">No evaluation episodes yet.</Empty> : (
          <div className="overflow-x-auto"><table className="w-full text-[12.5px]">
            <thead><tr><th className={th}>Model</th><th className={th}>Split</th><th className={cx(th, "text-right")}>Failed</th>{types.map((t) => <th key={t} className={cx(th, "text-right")} title={d.types[t].means}>{d.types[t].label}</th>)}</tr></thead>
            <tbody>{d.rows.map((r) => (
              <tr key={`${r.arm}${r.split}${r.seed}`} className={tr}><td className={td}>{ARM(r.arm)}</td><td className={cx(td, "font-mono text-ink-3")}>{r.split}</td><td className={cx(td, "num text-right font-mono")}>{r.failed}/{r.episodes}</td>
                {types.map((t) => { const v = r.types[t] ?? 0; const k = `${r.arm}|${r.split}|${t}`; return (
                  <td key={t} className={td}><button type="button" disabled={!v} onClick={() => setOpen(open === k ? null : k)} className="num w-full rounded py-0.5 text-right font-mono disabled:text-ink-3"
                    style={{ background: v ? `color-mix(in oklab, var(--crit) ${Math.round((v / max) * 40)}%, transparent)` : undefined }}>{v || "·"}</button></td>); })}</tr>))}</tbody></table></div>)}
        {open && (() => { const [a, sp, t] = open.split("|"); const r = d.rows.find((x) => x.arm === a && x.split === sp); return (
          <div className="space-y-2 border-t border-line p-[var(--pad)] text-[12px]"><div className="text-ink"><b>{d.types[t].label}</b> — {d.types[t].means}</div>
            {(r?.examples[t] ?? []).map((x) => <div key={x.task_id} className="rounded border border-line p-2"><div className="text-ink-2">{x.prompt}</div><div className="mt-1 font-mono text-[11px]">expected <b>{x.expected}</b> · got <b className="text-crit-ink">{x.answer}</b></div></div>)}</div>); })()}
        <div className="p-[var(--pad)] text-[11.5px] text-ink-3">{d.note}</div>
      </Panel>
      {d.changes.map((c) => (
        <Panel key={c.split} title={`What training changed — ${c.split === "test" ? "sealed final test" : "practice (dev)"}`}>
          <div className="grid gap-4 md:grid-cols-2 text-[12.5px]">
            <div><div className="micro mb-1.5 text-good-ink">Fixed (untrained failed this way, trained succeeded)</div>{Object.entries(c.fixed).map(([k, v]) => <div key={k} className="flex justify-between"><span>{d.types[k]?.label ?? k}</span><span className="num font-mono">{v}</span></div>)}{!Object.keys(c.fixed).length && <span className="text-ink-3">none</span>}</div>
            <div><div className="micro mb-1.5 text-crit-ink">New failures (untrained succeeded, trained failed)</div>{Object.entries(c.new).map(([k, v]) => <div key={k} className="flex justify-between"><span>{d.types[k]?.label ?? k}</span><span className="num font-mono">{v}</span></div>)}{!Object.keys(c.new).length && <span className="text-ink-3">none</span>}</div>
          </div>
        </Panel>))}
    </div>
  );
}

interface CRow { arm: string; split: string; tasks: number; answered: number; abstained: number; accuracy_when_answering: number | null; confident_wrong_rate: number; abstain_when_right_to: number | null; abstain_wrongly: number; coverage: number }
function Limits({ sid }: { sid: string }) {
  const c = useApi<{ rows: CRow[]; note: string }>(`/api/studies/${sid}/calibration`);
  if (!c.data) return <ErrorLine error={c.error} />;
  return (
    <Panel flush title="Does it know when it doesn't know?" prov={<Prov kind="computed" source="recorded answers" />}>
      <div className="px-[var(--pad)] pt-3 text-[12.5px] text-ink-2">The safest agents answer when the data supports it and say <span className="font-mono">NOT_FOUND</span> / <span className="font-mono">HANDOFF</span> otherwise. The column to watch is <b className="text-crit-ink">confident wrong</b>.</div>
      {!c.data.rows.length ? <Empty icon="evaluation">No evaluation episodes yet.</Empty> : (
        <div className="overflow-x-auto"><table className="w-full text-[12.5px]"><thead><tr>{["Model", "Split", "Answered", "Accuracy when answering", "Confident wrong", "Abstained when right to", "Abstained wrongly"].map((x, i) => <th key={x} className={cx(th, i > 1 && "text-right")}>{x}</th>)}</tr></thead>
          <tbody>{c.data.rows.map((r) => (
            <tr key={`${r.arm}${r.split}`} className={tr}><td className={td}>{ARM(r.arm)}</td><td className={cx(td, "font-mono text-ink-3")}>{r.split}</td>
              <td className={cx(td, "num text-right font-mono")}>{pct(r.coverage)}</td><td className={cx(td, "num text-right font-mono")}>{pct(r.accuracy_when_answering)}</td>
              <td className={cx(td, "num text-right font-mono", r.confident_wrong_rate > 0.2 && "text-crit-ink")}>{pct(r.confident_wrong_rate)}</td>
              <td className={cx(td, "num text-right font-mono")}>{pct(r.abstain_when_right_to)}</td><td className={cx(td, "num text-right font-mono")}>{pct(r.abstain_wrongly)}</td></tr>))}</tbody></table></div>)}
      <div className="p-[var(--pad)] text-[11.5px] text-ink-3">{c.data.note}</div>
    </Panel>
  );
}

interface SkillsT { lens: { arm: string; seed: number; points: { label: string; step: number | null; families: Record<string, number> }[] }[]; datacurve: { share: number; per_skill: Record<string, number> }[] | null;
  families: Record<string, Record<string, Record<string, { rate: number; n: number; ci: [number, number] } | unknown>> | null> }
function Mini({ title, xs, series, fmt, lowerBetter = false }: { title: string; xs: string[]; series: Record<string, (number | null)[]>; fmt: (v: number) => string; lowerBetter?: boolean }) {
  const all = Object.values(series).flat().filter((v): v is number => v != null);
  if (!all.length) return null;
  const lo = Math.min(...all), hi = Math.max(...all) || 1, W = 280, H = 120, P = 22;
  const x = (i: number) => P + (i / Math.max(1, xs.length - 1)) * (W - 2 * P), y = (v: number) => H - P - ((v - lo) / (hi - lo || 1)) * (H - 2 * P);
  return (
    <div className="rounded-[var(--radius)] border border-line p-2.5">
      <div className="mb-1 text-[12px] text-ink">{title} <span className="text-ink-3">{lowerBetter ? "(lower = closer to teacher)" : ""}</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title}>
        {xs.map((l, i) => <text key={l + i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--ink-3)">{l}</text>)}
        {Object.entries(series).map(([k, v], si) => (
          <g key={k}><polyline fill="none" stroke={`var(--cat-${(si % 8) + 1})`} strokeWidth="1.8" points={v.map((p, i) => (p == null ? "" : `${x(i)},${y(p)}`)).filter(Boolean).join(" ")} />
            {v.map((p, i) => p != null && <circle key={i} cx={x(i)} cy={y(p)} r="2.5" fill={`var(--cat-${(si % 8) + 1})`}><title>{`${k} · ${xs[i]}: ${fmt(p)}`}</title></circle>)}</g>))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-3 text-[11px]">{Object.keys(series).map((k, si) => <span key={k} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: `var(--cat-${(si % 8) + 1})` }} />{k}</span>)}</div>
    </div>
  );
}
function Skills({ sid }: { sid: string }) {
  const s = useApi<SkillsT>(`/api/studies/${sid}/skills`);
  const d = s.data;
  if (!d) return <ErrorLine error={s.error} />;
  const lens = d.lens[0];
  const fams = lens ? Object.keys(lens.points[0]?.families ?? {}) : [];
  const dcf = d.datacurve ? [...new Set(d.datacurve.flatMap((p) => Object.keys(p.per_skill)))] : [];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 [&>*]:min-w-0">
        <Panel title="During training — distance to the teacher per skill" prov={<Prov kind="measured" source="distillation lens" />}>
          {lens ? <Mini title={`${lens.arm} · seed ${lens.seed}`} xs={lens.points.map((p) => p.label)} lowerBetter fmt={(v) => `${v.toFixed(3)} nats`}
            series={Object.fromEntries(fams.map((f) => [f, lens.points.map((p) => p.families[f] ?? null)]))} /> : <Empty icon="lens">Run the Distillation Lens to see per-skill curves over training snapshots.</Empty>}
        </Panel>
        <Panel title="With more data — success per skill" prov={<Prov kind="measured" source="data-size curve" />}>
          {d.datacurve ? <Mini title="dev success" xs={d.datacurve.map((p) => `${Math.round(p.share * 100)}%`)} fmt={pct}
            series={Object.fromEntries(dcf.map((f) => [f, d.datacurve!.map((p) => p.per_skill[f] ?? null)]))} /> : <Empty icon="training">Run Robustness → How much data? to see this.</Empty>}
        </Panel>
      </div>
      <Panel flush title="Per skill: untrained vs trained (with 95 % ranges)" prov={<Prov kind="measured" source="analysis" />}>
        {!Object.keys(d.families).length ? <Empty icon="evaluation">Run the dev analysis first.</Empty> : Object.entries(d.families).map(([sp, fam]) => fam && (
          <div key={sp} className="overflow-x-auto"><div className="micro px-[var(--pad)] pt-3 text-ink-3">{sp === "test" ? "sealed final test" : "practice (dev)"}</div>
            <table className="w-full text-[12.5px]"><tbody>{Object.entries(fam).map(([f, arms]) => (
              <tr key={f} className={tr}><td className={td}>{f}</td>{Object.entries(arms as Record<string, { rate: number; n: number; ci: [number, number] }>).filter(([, v]) => v && typeof v === "object" && "rate" in v).map(([a, v]) => (
                <td key={a} className={cx(td, "num font-mono")}><span className="text-ink-3">{ARM(a)}</span> {pct(v.rate)} <span className="text-[10.5px] text-ink-3">({pct(v.ci?.[0])}–{pct(v.ci?.[1])}, n={v.n})</span></td>))}</tr>))}</tbody></table></div>))}
      </Panel>
    </div>
  );
}

interface TL { events: { at: string; actor: string | null; what: string; kind: string; status?: number }[]; chain: { ok: boolean; records: number; broken_at: number | null }; note: string }
function Audit({ sid }: { sid: string }) {
  const t = useApi<TL>(`/api/studies/${sid}/timeline`, 8000);
  const [kind, setKind] = useState("");
  const d = t.data;
  if (!d) return <ErrorLine error={t.error} />;
  const ev = d.events.filter((e) => !kind || e.kind === kind);
  return (
    <Panel flush title="Who did what" prov={<Prov kind="measured" source="audit log · study history · reviews · decisions" />}
      right={<span className="flex items-center gap-2"><Status s={d.chain.ok ? "pass" : "fail"} label={d.chain.ok ? `audit chain intact · ${d.chain.records} records` : `audit chain broken at line ${d.chain.broken_at}`} />
        <select className={cx(inputCls, "h-7 !w-auto font-sans")} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Filter"><option value="">everything</option><option value="audit">actions</option><option value="stage">stages</option><option value="job">jobs</option><option value="review">reviews</option><option value="decision">decisions</option></select></span>}>
      <ol className="scroll-thin max-h-[560px] overflow-auto">{ev.map((e, i) => (
        <li key={i} className="grid grid-cols-[150px_140px_1fr] gap-3 border-t border-line px-[var(--pad)] py-1.5 text-[12px] max-md:grid-cols-1 max-md:gap-0">
          <span className="font-mono text-[11px] text-ink-3">{e.at ? new Date(e.at).toLocaleString() : "—"}</span>
          <span className={e.actor ? "text-ink" : "text-ink-3"}>{e.actor ?? (e.kind === "stage" || e.kind === "job" ? "FORGE" : "—")}</span>
          <span className="text-ink-2"><Badge>{e.kind}</Badge> {e.what}{e.status && e.status >= 400 ? <span className="ml-1 text-crit-ink">(refused {e.status})</span> : null}</span></li>))}
        {!ev.length && <li className="p-[var(--pad)] text-ink-3">Nothing recorded yet.</li>}</ol>
      <div className="p-[var(--pad)] text-[11.5px] text-ink-3">{d.note} Each action line is hash-chained to the previous one; editing or deleting a line breaks the chain.</div>
    </Panel>
  );
}

function Reports({ sid }: { sid: string }) {
  const R: [string, string, string][] = [["executive", "Executive summary", "One page: headline result with its range, what the agent does, limits, and what is not claimed."],
    ["operations", "Operations & clinical review", "Per-skill results, knowing its limits, how it fails, human review and who did what."],
    ["technical", "Technical report", "Everything above plus hashes, training settings, data and cost."]];
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {R.map(([k, t, d]) => (
        <Panel key={k} title={t}>
          <p className="mb-3 text-[12.5px] text-ink-2">{d}</p>
          <a href={`/api/studies/${sid}/report?audience=${k}`} download className="inline-flex h-8 items-center rounded-[calc(var(--radius)-1px)] bg-accent px-3 text-[12.5px] font-medium text-white hover:opacity-90">Download HTML report</a>
          <p className="mt-2 text-[11px] text-ink-3">Self-contained file; open in any browser and print to PDF. Generated from the study's recorded results at the moment you click.</p>
        </Panel>))}
    </div>
  );
}
