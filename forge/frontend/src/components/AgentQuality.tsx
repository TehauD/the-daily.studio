import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Term } from "../lib/glossary";
import { useAction, useApi } from "../lib/hooks";
import { Badge, Button, ErrorLine, Field, Notice, Panel, Toggle, cx, inputCls } from "./ui";

export interface BoundaryCfg { enabled: boolean; n: number; categories: string[]; custom: string[] }
interface Cats { categories: Record<string, { label: string; why: string; example: string }>; instruction: string }

/** Agent Studio → Practice tasks: the agent's boundary suite (requests it should hand back to a person). */
export function BoundaryPanel({ aid, value, onSaved }: { aid: string; value?: BoundaryCfg; onSaved: () => Promise<void> }) {
  const cats = useApi<Cats>("/api/agents/boundary/categories");
  const all = Object.keys(cats.data?.categories ?? {});
  const [f, setF] = useState<BoundaryCfg>(value ?? { enabled: false, n: 24, categories: [], custom: [] });
  const [text, setText] = useState((value?.custom ?? []).join("\n"));
  useEffect(() => { if (value) { setF(value); setText(value.custom.join("\n")); } }, [value]);
  const act = useAction();
  const chosen = f.categories.length ? f.categories : all;
  const save = (next: BoundaryCfg) => void act.run(async () => {
    await api.put(`/api/agents/${aid}`, { boundary: { ...next, custom: text.split("\n").map((x) => x.trim()).filter(Boolean) } }); await onSaved(); });
  return (
    <Panel title="Boundaries — when to hand back" eyebrow="optional · recommended" right={f.enabled ? <Badge tone="good">on</Badge> : <Badge>off</Badge>}>
      <div className="space-y-3 text-[12.5px] text-ink-2">
        <p>A routine-work agent must know its limits. With boundaries on, the agent is told to answer <b className="font-mono text-ink">HANDOFF</b> when a request
          asks it to change something, needs clinical / legal / financial judgment, asks for passwords or personal data, tries to override its rules, or is outside its job —
          and practice tasks include such cases, so you can see whether training makes it <i>better or worse</i> at handing back. <Term k="human">People decide</Term> what happens next.</p>
        <Toggle checked={f.enabled} onChange={(v) => setF({ ...f, enabled: v })} label="Include boundary cases" />
        {f.enabled && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {all.map((k) => {
                const on = chosen.includes(k);
                return <button key={k} type="button" aria-pressed={on} title={`${cats.data?.categories[k].why} e.g. “${cats.data?.categories[k].example}”`}
                  onClick={() => { const next = on ? chosen.filter((x) => x !== k) : [...chosen, k]; if (next.length) setF({ ...f, categories: next }); }}
                  className={cx("rounded-full border px-2.5 py-1 text-[11.5px]", on ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-3")}>{cats.data?.categories[k].label}</button>;
              })}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={`Generated cases · ${f.n}`} hint="Filled with real identifiers from your tables, split train / dev / test like any skill.">
                <input type="range" min={6} max={120} step={6} value={f.n} onChange={(e) => setF({ ...f, n: Number(e.target.value) })} className="w-full accent-[var(--accent)]" aria-label="Number of boundary cases" /></Field>
              <Field label="Your own cases (one per line)" hint="Requests your team sees that the agent must not handle. Synthetic text only.">
                <textarea className={cx(inputCls, "h-20 py-1.5 font-sans")} value={text} onChange={(e) => setText(e.target.value)} placeholder="Can you waive the copay for this member?" /></Field>
            </div>
          </>
        )}
        <div className="flex items-center gap-2"><Button size="sm" tone="primary" busy={act.busy} onClick={() => save(f)}>Save boundaries</Button>
          <span className="text-[11.5px] text-ink-3">Saving marks existing tasks stale — write them again to include the cases.</span></div>
        <ErrorLine error={act.error} />
      </div>
    </Panel>
  );
}

interface Coverage {
  tasks: number; skills: string[]; grid: Record<string, Record<string, number>>;
  tables: { table: string; rows: number; touched: number; share: number | null; by_split: Record<string, number> }[];
  tools: Record<string, number>; answers: Record<string, { distinct: number; top: { answer: string; n: number }[]; top_share: number | null; not_found: number; n: number }>;
  variety: Record<string, { n: number; mean_nearest: number; max_nearest: number }>; boundary: Record<string, number>; warnings: string[]; note: string;
}

/** What the practice tasks actually exercise: skills × splits, table rows touched, answer balance, wording variety. */
export function CoverageMap({ aid, name }: { aid: string; name: (id: string) => string }) {
  const c = useApi<Coverage>(`/api/agents/${aid}/coverage`);
  const d = c.data;
  if (!d) return <div className="p-[var(--pad)]"><ErrorLine error={c.error} /></div>;
  const max = Math.max(1, ...Object.values(d.grid).flatMap((r) => Object.values(r)));
  return (
    <div className="space-y-5 p-[var(--pad)] text-[12px]">
      {d.warnings.length > 0 && <Notice tone="warn"><ul className="list-disc space-y-0.5 pl-4">{d.warnings.map((w) => <li key={w}>{w}</li>)}</ul></Notice>}
      <div className="grid gap-5 xl:grid-cols-2">
        <div>
          <div className="micro mb-2 text-ink-3">Tasks per skill and split</div>
          <table className="w-full"><thead><tr className="text-ink-3"><th className="py-1 text-left font-normal">skill</th>{["train", "dev", "test"].map((s) => <th key={s} className="w-20 font-normal">{s}</th>)}<th className="w-24 text-right font-normal" title="Mean ROUGE-L to the most similar task of the same skill: lower = more varied wording">wording similarity</th></tr></thead>
            <tbody>{Object.entries(d.grid).map(([s, row]) => (
              <tr key={s} className="border-t border-line">
                <td className="py-1.5 pr-2 text-ink">{s === "boundary" ? "Boundaries (HANDOFF)" : name(s)}</td>
                {["train", "dev", "test"].map((sp) => {
                  const v = row[sp] ?? 0;
                  return <td key={sp} className="px-1"><div className={cx("num rounded py-1 text-center font-mono", v < 3 && sp !== "train" ? "text-crit-ink" : "text-ink")}
                    style={{ background: `color-mix(in oklab, var(--accent) ${Math.round((v / max) * 55)}%, transparent)` }}>{v}</div></td>;
                })}
                <td className="text-right font-mono text-ink-2">{d.variety[s] ? d.variety[s].mean_nearest.toFixed(2) : "—"}</td>
              </tr>))}</tbody></table>
        </div>
        <div>
          <div className="micro mb-2 text-ink-3">Table rows the tasks look up</div>
          <div className="space-y-2">{d.tables.map((t) => (
            <div key={t.table}>
              <div className="flex justify-between"><span className="font-mono text-ink">{t.table}</span><span className="num font-mono text-ink-2">{t.touched} / {t.rows} rows{t.share != null ? ` · ${Math.round(t.share * 100)}%` : ""}</span></div>
              <div className="mt-1 h-1.5 rounded-full bg-surface-3"><div className="h-1.5 rounded-full bg-accent" style={{ width: `${(t.share ?? 0) * 100}%` }} /></div>
            </div>))}
            {!d.tables.length && <div className="text-ink-3">No tables.</div>}
          </div>
          <div className="micro mb-1.5 mt-4 text-ink-3">Tool use in reference answers</div>
          <div className="flex flex-wrap gap-1.5">{Object.entries(d.tools).map(([k, v]) => <span key={k} className="rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-ink-2">{k} <b className="text-ink">{v}</b></span>)}</div>
        </div>
      </div>
      <div>
        <div className="micro mb-2 text-ink-3">Answer balance per skill <span className="normal-case tracking-normal">(if one answer dominates, always giving it scores well)</span></div>
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{Object.entries(d.answers).filter(([s]) => s !== "boundary").map(([s, a]) => (
          <div key={s} className="rounded-[var(--radius)] border border-line p-2.5">
            <div className="flex justify-between"><span className="text-ink">{name(s)}</span><span className="text-ink-3">{a.distinct} distinct · {a.not_found} not-found</span></div>
            <div className="mt-1.5 space-y-1">{a.top.map((t) => (
              <div key={t.answer} className="flex items-center gap-2"><span className="w-28 truncate font-mono text-[11px] text-ink-2" title={t.answer}>{t.answer}</span>
                <div className="h-1.5 flex-1 rounded-full bg-surface-3"><div className={cx("h-1.5 rounded-full", (a.top_share ?? 0) >= 0.5 && t === a.top[0] ? "bg-warn" : "bg-accent")} style={{ width: `${(t.n / a.n) * 100}%` }} /></div>
                <span className="num w-6 text-right font-mono text-[11px] text-ink-3">{t.n}</span></div>))}</div>
          </div>))}</div>
      </div>
      {Object.keys(d.boundary).length > 0 && <div className="text-ink-2"><span className="micro mr-2 text-ink-3">Boundary cases</span>{Object.entries(d.boundary).map(([k, v]) => <span key={k} className="mr-3 font-mono">{k.replace(/_/g, " ")} <b className="text-ink">{v}</b></span>)}</div>}
      <div className="text-[11px] text-ink-3">{d.note}</div>
    </div>
  );
}
