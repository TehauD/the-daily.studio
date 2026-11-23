import { takeHandoff } from "../lib/handoff";
import { BoundaryPanel, CoverageMap, type BoundaryCfg } from "../components/AgentQuality";
import { Fragment, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Explainer, Journey, type GuideStep } from "../components/guided";
import { JobLog } from "../components/live";
import { Badge, Button, Empty, ErrorLine, Field, Notice, PageHeader, Panel, Readout, Segmented, Status, Tabs, Toggle, cx, inputCls, td, th, tr } from "../components/ui";
import { api, fmt, qs } from "../lib/api";
import { useAction, useApi } from "../lib/hooks";
import { AskAI, useAssistantScope } from "../lib/assistant";
import { usePrefs } from "../lib/prefs";
import { useReviewer } from "../lib/reviewer";
import type { Job, Model, Readiness, StudyRow, StudySummary } from "../lib/types";

/* ------------------------------------------------------------------ types */
interface Call { tool: string; arguments: Record<string, unknown> }
interface Example { prompt: string; answer: string; calls?: Call[] }
interface Skill { id: string; name: string; description: string; tools: string[]; not_found: number; examples: Example[]; generator?: boolean }
interface TemplateInfo { id: string; title: string; domain: string; description: string; skills: string[]; tables: string[] }
interface Rule { name: string; description: string; inputs: { name: string; type: "number" | "text" }[]; match: "all" | "any"; conditions: { input: string; op: string; value: string | number }[]; true_text: string; false_text: string }
interface TableMeta { name: string; description: string; key: string; columns: string[]; rows: number; source: string }
interface ToolInfo { name: string; description: string; parameters: { properties: Record<string, { type: string; enum?: string[] }>; required: string[] } }
interface AgentShort { id: string; name: string; template: string; created_at: string; skills: { id: string; name: string }[]; tables: string[]; tasks: string | null }
interface AgentFull {
  id: string; name: string; template: string; role: string; created_at: string;
  tools: { calculator: boolean; units: boolean; dates: boolean; rules: Rule[]; knowledge_pack: string | null; tables: TableMeta[] };
  skills: Skill[]; steps: { tasks: { status: string | null; summary?: TaskSummary; error?: string } }; tool_names: ToolInfo[];
  counts: { tasks: number; rejected: number }; jobs: Job[]; review?: ReviewStats; boundary?: BoundaryCfg;
}
interface TaskSummary { accepted: number; rejected: number; by_skill: Record<string, number>; from_you: number; not_found: number; splits: Record<string, number> }
interface Review { status: "approved" | "corrected" | "rejected"; reviewer: string; at: string; note: string; question?: string; answer?: string }
interface TaskRow { task_id: string; family: string; split: string; prompt: string; reference_calls: Call[]; reference_answer: string; meta: { source: string; not_found: boolean }; review?: Review | null }
interface ReviewStats { approved: number; corrected: number; rejected: number; pending: number; total: number }
interface Rejected { skill: string; source: string; candidate: { question?: string; prompt?: string; answer?: string } | null; reason: string }

const STEPS = [
  { key: "define", title: "Define the agent", line: "Its job, in plain words. Start from a template or blank." },
  { key: "tools", title: "Give it tools", line: "Your tables, calculators, rules, documents — read-only." },
  { key: "skills", title: "Describe skills", line: "What it should get good at, with a few examples." },
  { key: "tasks", title: "Practice tasks", line: "The teacher writes many more; FORGE checks every one." },
  { key: "teach", title: "Teach & measure", line: "Train the student and see what improved." },
] as const satisfies readonly GuideStep<string>[];
type SKey = (typeof STEPS)[number]["key"];

/* ------------------------------------------------------------------ page */
export default function AgentStudio() {
  const list = useApi<AgentShort[]>("/api/agents", 6000);
  const [aid, setAid] = useState<string | null>(() => takeHandoff("agent"));
  const [creating, setCreating] = useState(() => takeHandoff("new-agent") === "1");
  const agents = list.data ?? [];
  useEffect(() => { if (!aid && agents.length) setAid(agents[0].id); }, [agents, aid]);
  const ag = useApi<AgentFull>(aid ? `/api/agents/${aid}` : null, 3000);
  const studies = useApi<StudyRow[]>("/api/studies", 8000);
  const a = ag.data;
  useAssistantScope("agent", a?.id, a?.name);
  const mine = useMemo(() => (studies.data ?? []).filter((s) => a && (s as StudyRow & { agent?: string }).agent === a.id), [studies.data, a]);
  const hasTools = !!a && a.tool_names.length > 0, hasSkills = !!a && a.skills.length > 0, tasksOk = a?.steps.tasks.status === "completed";
  const reached: Record<SKey, boolean> = { define: true, tools: !!a, skills: hasTools, tasks: hasSkills, teach: tasksOk || mine.length > 0 };
  const done: Record<SKey, boolean> = { define: !!a && !!a.role.trim(), tools: hasTools, skills: hasSkills, tasks: tasksOk, teach: mine.length > 0 };
  const firstOpen = (STEPS.find((s) => !done[s.key])?.key ?? "teach") as SKey;
  const [step, setStep] = useState<SKey | null>(null);
  const cur: SKey = !a || creating ? "define" : step && reached[step] ? step : firstOpen;
  const running = a?.jobs.find((j) => j.status === "running");
  const reload = async () => { await ag.reload(); await list.reload(); };
  return (
    <div className="space-y-4 fit:flex fit:h-full fit:min-h-0 fit:flex-col fit:gap-3 fit:space-y-0">
      <PageHeader kicker="Your agents" title="Agent Studio"
        subtitle="Build a purpose-built agent: its job, read-only tools over your own data, and the skills it should get good at — then train a small local model to do it, and measure the result."
        right={<>
          {agents.length > 0 && (
            <select className={cx(inputCls, "h-8 !w-auto max-w-[280px] font-sans")} value={creating ? "" : aid ?? ""} aria-label="Agent"
              onChange={(e) => { setCreating(false); setAid(e.target.value); setStep(null); }}>
              {creating && <option value="">(new agent)</option>}
              {agents.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          )}
          <Button icon="plus" tone={agents.length ? "default" : "primary"} onClick={() => { setCreating(true); setStep("define"); }}>New agent</Button>
        </>} />
      <Journey steps={STEPS} cur={cur} reached={reached} done={done} onPick={(k) => { if (reached[k]) { setStep(k); setCreating(false); } }} />
      <ErrorLine error={list.error ?? ag.error} />
      <div className="grid gap-4 fit:min-h-0 fit:flex-1 fit:grid-cols-[minmax(0,1fr)_380px] fit:gap-3 3xl:fit:grid-cols-[minmax(0,1fr)_440px]">
        <div className="scroll-thin min-w-0 space-y-4 fit:min-h-0 fit:space-y-3 fit:overflow-auto fit:pr-1">
          {running && <Panel title="Working…" eyebrow="live"><JobLog key={running.id} jobId={running.id} height={200} onDone={() => { void reload(); }} /></Panel>}
          {(creating || !a) && cur === "define" ? <CreateAgent onCreated={(id) => { setCreating(false); setAid(id); setStep("define"); void list.reload(); }} /> : a && (
            <>
              {cur === "define" && <StepDefine a={a} onSaved={reload} />}
              {cur === "tools" && <StepTools a={a} onSaved={reload} />}
              {cur === "skills" && <StepSkills a={a} onSaved={reload} />}
              {cur === "tasks" && <StepTasks a={a} busy={!!running} onStarted={reload} />}
              {cur === "teach" && <StepTeach a={a} studies={mine} onCreated={() => { void studies.reload(); }} />}
            </>
          )}
        </div>
        <AgentExplainer step={cur} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ explainer */
const EXPLAIN: Record<SKey, { title: string; body: ReactNode; terms: [string, string][]; lit: number[] }> = {
  define: { lit: [0], title: "A specialist, not a generalist",
    body: <>A purpose-built agent does <b>one job well</b>: answer formulary questions, check billing codes, work out dates. The <b>role</b> is the first thing it reads every time — say what it does, for whom, and what it must never do (e.g. “never give medical advice”).</>,
    terms: [["Agent", "A model that can call tools, read the results, and answer."], ["Role", "Standing instructions the agent always follows."]] },
  tools: { lit: [0, 1], title: "Tools keep the facts outside the model",
    body: <>The agent never answers from memory: it <b>looks things up</b> in your tables, <b>calculates exactly</b>, converts units, does date arithmetic, applies <b>your rules</b>, or searches your documents. Tools are <b>read-only</b> and run inside FORGE — no internet, no code. Update a table and the agent uses the new values without retraining. Try any tool in the console.</>,
    terms: [["Lookup", "Find one row by its key, e.g. a drug or a code."], ["Rule", "A yes/no check you define, e.g. “tier ≥ 4 or quantity > 90”."]] },
  skills: { lit: [1, 2], title: "Skills are what it gets better at",
    body: <>A skill is a <b>kind of task</b> plus the tools it needs: “look up a copay”, “work out a refill date”. Give <b>two or three examples</b> each — the teacher writes many more in the same style. If the agent should sometimes say <span className="font-mono">NOT_FOUND</span>, turn on not-found cases: that teaches it not to invent answers.</>,
    terms: [["Example", "A question, the tool calls that answer it, and the answer."], ["Not found", "Questions about things that are not in your data."]] },
  tasks: { lit: [2, 3], title: "Only provable tasks become lessons",
    body: <>For every task the teacher writes, FORGE <b>runs the tool calls itself</b> and keeps the task only if: every value passed to a tool comes from the question or an earlier result, the answer is <b>exactly what a tool returned</b>, and it doesn't give the answer away. Tasks about the same item stay in the same split, so the final test uses items the student <b>never practised on</b>.</>,
    terms: [["Verified", "FORGE re-ran the tools and got the same answer."], ["Split", "Practice (train), check-ins (dev), final test."]] },
  teach: { lit: [3, 4], title: "Train, then measure — skill by skill",
    body: <>The teacher solves every task with your tools; only <b>fully correct</b> solutions become lessons for the small <b>student</b> model. Pick <b>focus skills</b> to train only those — every skill is still tested, so you see the gain and any side effects. The Distillation Lens shows which skills moved toward the teacher.</>,
    terms: [["Student", "The small local model you will run day to day."], ["Strict success", "Right answer, backed by a tool result, right tools, no errors."]] },
};

function AgentExplainer({ step }: { step: SKey }) {
  const e = EXPLAIN[step];
  const stage = STEPS.findIndex((s) => s.key === step) + 1;
  return <Explainer stage={stage} total={5} nodes={["Role", "Tools", "Skills", "Lessons", "Student"]} lit={e.lit} title={e.title} body={e.body} terms={e.terms} label="How a purpose-built agent is made" />;
}

/* ------------------------------------------------------------------ step 1 */
function CreateAgent({ onCreated }: { onCreated: (id: string) => void }) {
  const tpl = useApi<{ templates: TemplateInfo[] }>("/api/agents/templates");
  const [t, setT] = useState("itsm_servicenow");
  const groups = useMemo(() => {
    const g = new Map<string, TemplateInfo[]>();
    (tpl.data?.templates ?? []).forEach((x) => g.set(x.domain, [...(g.get(x.domain) ?? []), x]));
    return [...g].sort((a, b) => (a[0] === "Any" ? 1 : b[0] === "Any" ? -1 : a[0].localeCompare(b[0])));
  }, [tpl.data]);
  const cur = tpl.data?.templates.find((x) => x.id === t);
  const [f, setF] = useState({ name: "", ok: false });
  const act = useAction();
  const submit = (e: FormEvent) => { e.preventDefault(); void act.run(async () => onCreated((await api.post<{ id: string }>("/api/agents", { name: f.name, template: t, no_sensitive_data: f.ok })).id)); };
  return (
    <Panel title="1 · Define the agent" eyebrow="new agent">
      <form onSubmit={submit} className="space-y-4">
        {groups.map(([domain, list]) => (
          <div key={domain}>
            <div className="micro mb-1.5 text-ink-3">{domain === "Any" ? "start from scratch" : domain}</div>
            <div className="grid gap-2.5 md:grid-cols-2 2xl:grid-cols-3">
              {list.map((x) => (
                <button key={x.id} type="button" onClick={() => setT(x.id)} aria-pressed={t === x.id}
                  className={cx("rounded-[var(--radius)] border p-3 text-left transition", t === x.id ? "border-accent bg-accent-soft" : "border-line hover:border-accent-line")}>
                  <div className="flex items-start gap-2 text-[13px] font-semibold text-ink"><span className={cx("mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-2", t === x.id ? "border-accent bg-accent" : "border-line-strong")} />{x.title}</div>
                  <div className="mt-1 text-[12px] leading-snug text-ink-3">{x.description}</div>
                  {x.skills.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{x.skills.map((k) => <Badge key={k}>{k}</Badge>)}</div>}
                </button>
              ))}
            </div>
          </div>
        ))}
        {t !== "blank" && <Notice tone="info">Everything in this template is <b>invented</b> — organisations, records, codes and rules{t === "security_triage" ? " (ATT&CK technique IDs are public MITRE references)" : ""}. It shows a domain agent end to end; it is not real operational, clinical, or security data, and FORGE makes no claim of fitness for real use.{cur?.tables.length ? ` Tables: ${cur.tables.join(", ")}.` : ""}</Notice>}
        <Field label="Name this agent"><input className={inputCls} value={f.name} placeholder={cur?.title.replace(/\s*\(synthetic.*\)$/, "") ?? "e.g. Billing-code helper"} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <label className={cx("flex items-start gap-3 rounded-[var(--radius)] border p-3", f.ok ? "border-[color:var(--good)]/40 bg-[color:var(--good)]/[0.04]" : "border-[color:var(--warn)]/60 bg-[color:var(--warn)]/[0.07]")}>
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--accent)]" checked={f.ok} onChange={(e) => setF({ ...f, ok: e.target.checked })} />
          <span className="text-[12.5px] leading-relaxed text-ink-2"><b className="text-ink">I will only give this agent synthetic or non-sensitive data — no patient, personal, or confidential information.</b> FORGE also scans every table you add and refuses ones that look like personal data, but it cannot catch everything.</span>
        </label>
        <div className="flex items-center gap-3">
          <Button type="submit" tone="primary" icon="plus" busy={act.busy} disabled={!f.ok}>Create agent</Button>
          {!f.ok && <span className="text-[12px] text-ink-3">Tick the confirmation to continue.</span>}
        </div>
        <ErrorLine error={act.error} />
      </form>
    </Panel>
  );
}

function StepDefine({ a, onSaved }: { a: AgentFull; onSaved: () => Promise<void> }) {
  const [f, setF] = useState({ name: a.name, role: a.role });
  useEffect(() => setF({ name: a.name, role: a.role }), [a.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = useAction();
  const dirty = f.name !== a.name || f.role !== a.role;
  return (
    <Panel title="1 · Define the agent" eyebrow={a.name} right={a.role.trim() ? <Status s="pass" label="defined" /> : undefined}>
      <div className="space-y-4">
        <Field label="Name"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Role — its standing instructions" hint="Who it serves, what it does, what it must never do. The tool list and answer format are added automatically.">
          <textarea className={cx(inputCls, "h-32 py-2 font-sans text-[13px] leading-relaxed")} value={f.role} placeholder="You are a billing-code assistant for … You answer … You never …" onChange={(e) => setF({ ...f, role: e.target.value })} />
        </Field>
        <div className="flex items-center gap-3">
          <Button tone="primary" icon="check" busy={act.busy} disabled={!dirty || !f.role.trim()} onClick={() => void act.run(async () => { await api.put(`/api/agents/${a.id}`, f); await onSaved(); })}>Save</Button>
          {dirty && <span className="text-[12px] text-warn-ink">Unsaved changes</span>}
          {a.steps.tasks.status === "completed" && <span className="text-[12px] text-ink-3">Saving changes marks the practice tasks stale.</span>}
        </div>
        <ErrorLine error={act.error} />
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ step 2 */
function StepTools({ a, onSaved }: { a: AgentFull; onSaved: () => Promise<void> }) {
  const packs = useApi<{ id: string; name: string; steps: Record<string, string> }[]>("/api/knowledge");
  const meta = useApi<{ operators: string[]; units: string[] }>("/api/agents/templates");
  const act = useAction();
  const save = (tools: Partial<AgentFull["tools"]>) => void act.run(async () => { await api.put(`/api/agents/${a.id}`, { tools }); await onSaved(); });
  return (
    <>
      <Panel title="2 · Give it tools" eyebrow={a.name} right={<Badge tone={a.tool_names.length ? "good" : "default"}>{a.tool_names.length} tools</Badge>}>
        <div className="space-y-4">
          <div>
            <div className="micro mb-2 text-ink-3">Your data</div>
            <Tables a={a} onSaved={onSaved} />
          </div>
          <div className="grid gap-3 border-t border-line pt-3 md:grid-cols-3">
            {([["calculator", "Exact calculator", "+ − × ÷, rounding, min / max. No guessing at arithmetic."],
               ["units", "Unit conversion", "mg ↔ g ↔ mcg, mL ↔ L, lb ↔ kg, °F ↔ °C, hours ↔ days."],
               ["dates", "Date arithmetic", "Add days to a date; days between two dates."]] as const).map(([k, t, d]) => (
              <div key={k} className="rounded-[var(--radius)] border border-line p-3">
                <Toggle checked={a.tools[k]} onChange={(v) => save({ [k]: v })} label={t} />
                <div className="mt-1.5 text-[11.5px] text-ink-3">{d}</div>
              </div>
            ))}
          </div>
          <Field label="Documents (optional)" hint="Link a Knowledge Studio pack: the agent gets a search_documents tool over it.">
            <select className={inputCls} value={a.tools.knowledge_pack ?? ""} onChange={(e) => save({ knowledge_pack: e.target.value || null })}>
              <option value="">— none —</option>
              {(packs.data ?? []).filter((p) => p.steps.index === "completed").map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <ErrorLine error={act.error} />
        </div>
      </Panel>
      <Rules a={a} ops={meta.data?.operators ?? []} onSaved={onSaved} />
      <Console a={a} />
    </>
  );
}

function sniffColumns(text: string, name: string): string[] {
  try {
    if (name.toLowerCase().endsWith(".json") || text.trimStart().startsWith("[")) { const j = JSON.parse(text); return Array.isArray(j) && j[0] ? Object.keys(j[0]) : []; }
  } catch { return []; }
  const line = text.replace(/^﻿/, "").split(/\r?\n/)[0] ?? "";
  const sep = [",", ";", "\t"].sort((x, y) => line.split(y).length - line.split(x).length)[0];
  return line.split(sep).map((s) => s.trim().replace(/^"|"$/g, "")).filter(Boolean);
}

function Tables({ a, onSaved }: { a: AgentFull; onSaved: () => Promise<void> }) {
  const [file, setFile] = useState<{ name: string; text: string; cols: string[] } | null>(null);
  const [f, setF] = useState({ name: "", key: "", description: "" });
  const [view, setView] = useState<string | null>(null);
  const [res, setRes] = useState<{ rows: number; duplicate_keys: number; warnings: string[] } | null>(null);
  const act = useAction();
  const rows = useApi<{ total: number; rows: Record<string, unknown>[] }>(view ? `/api/agents/${a.id}/tables/${view}${qs({ limit: 12 })}` : null);
  const pick = (fl: File | undefined) => {
    if (!fl) return;
    if (fl.size > 5_000_000) { act.setError("Tables must be ≤ 5 MB"); return; }
    void fl.text().then((text) => { const cols = sniffColumns(text, fl.name); setFile({ name: fl.name, text, cols }); setF({ name: fl.name.replace(/\.[^.]+$/, ""), key: cols[0] ?? "", description: "" }); setRes(null); });
  };
  const upload = () => void act.run(async () => {
    const r = await api.post<{ rows: number; duplicate_keys: number; warnings: string[] }>(`/api/agents/${a.id}/tables`, { ...f, filename: file!.name, content: file!.text });
    setRes(r); setFile(null); await onSaved();
  });
  return (
    <div className="space-y-3">
      {a.tools.tables.length === 0 ? <div className="text-[12.5px] text-ink-3">No tables yet. Add a spreadsheet saved as CSV (or a JSON list) — a price list, code set, formulary, schedule…</div> : (
        <table className="w-full text-[12px]">
          <thead><tr><th className={th}>Table</th><th className={th}>Key</th><th className={th}>Columns</th><th className={cx(th, "text-right")}>Rows</th><th className={th} /></tr></thead>
          <tbody>{a.tools.tables.map((t) => (
            <tr key={t.name} className={tr}>
              <td className={td}><div className="font-mono text-ink">{t.name}</div><div className="text-[10.5px] text-ink-3">{t.source}</div></td>
              <td className={cx(td, "font-mono")}>{t.key}</td>
              <td className={cx(td, "max-w-[340px] truncate font-mono text-[11px] text-ink-3")}>{t.columns.join(", ")}</td>
              <td className={cx(td, "num text-right font-mono")}>{fmt.exact(t.rows)}</td>
              <td className={cx(td, "whitespace-nowrap text-right")}>
                <button type="button" className="micro text-accent" onClick={() => setView(view === t.name ? null : t.name)}>{view === t.name ? "hide" : "view"}</button>{" · "}
                <button type="button" className="micro text-crit-ink" onClick={() => void act.run(async () => { await api.del(`/api/agents/${a.id}/tables/${t.name}`); await onSaved(); })}>remove</button>
              </td>
            </tr>))}
          </tbody>
        </table>
      )}
      {view && rows.data && (
        <div className="scroll-thin max-h-64 overflow-auto rounded-[var(--radius)] border border-line">
          <table className="w-full font-mono text-[11px]"><thead className="sticky top-0 bg-surface-2"><tr>{Object.keys(rows.data.rows[0] ?? {}).map((k) => <th key={k} className={th}>{k}</th>)}</tr></thead>
            <tbody>{rows.data.rows.map((r, i) => <tr key={i} className={tr}>{Object.values(r).map((v, j) => <td key={j} className={td}>{String(v)}</td>)}</tr>)}</tbody></table>
          <div className="px-3 py-1.5 text-[11px] text-ink-3">showing {rows.data.rows.length} of {fmt.exact(rows.data.total)}</div>
        </div>
      )}
      <div className="rounded-[var(--radius)] border border-dashed border-line-strong p-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-[calc(var(--radius)-1px)] border border-line-strong px-3 text-[12px] font-medium text-ink hover:bg-accent-soft">
            <input type="file" accept=".csv,.tsv,.txt,.json" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />Choose a CSV or JSON file…
          </label>
          <span className="text-[11.5px] text-ink-3">Read in your browser and sent only to FORGE on this computer. Scanned for personal identifiers.</span>
        </div>
        {file && (
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <Field label="Table name"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Key column" hint="What the agent looks rows up by.">
              <select className={inputCls} value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })}>{file.cols.map((c) => <option key={c}>{c}</option>)}</select>
            </Field>
            <Field label="What is this table? (optional)"><input className={cx(inputCls, "font-sans")} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="e.g. 2025 fee schedule" /></Field>
            <div className="md:col-span-3"><Button tone="primary" icon="download" busy={act.busy} disabled={!f.name} onClick={upload}>Add table ({file.cols.length} columns)</Button></div>
          </div>
        )}
        {res && <div className="mt-2 space-y-1 text-[12px] text-good-ink">Added {fmt.exact(res.rows)} rows.{res.duplicate_keys > 0 && <span className="text-warn-ink"> {res.duplicate_keys} duplicate keys — lookups return the first.</span>}
          {res.warnings.map((w) => <div key={w} className="text-warn-ink">⚠ {w}</div>)}</div>}
        <div className="mt-2"><ErrorLine error={act.error} /></div>
      </div>
    </div>
  );
}

const blankRule = (): Rule => ({ name: "", description: "", inputs: [{ name: "", type: "number" }], match: "all", conditions: [{ input: "", op: ">=", value: "" }], true_text: "yes", false_text: "no" });

function Rules({ a, ops, onSaved }: { a: AgentFull; ops: string[]; onSaved: () => Promise<void> }) {
  const [rules, setRules] = useState<Rule[]>(a.tools.rules);
  useEffect(() => setRules(a.tools.rules), [a.id, a.tools.rules]);
  const act = useAction();
  const dirty = JSON.stringify(rules) !== JSON.stringify(a.tools.rules);
  const upd = (i: number, r: Partial<Rule>) => setRules(rules.map((x, j) => (j === i ? { ...x, ...r } : x)));
  const clean = (r: Rule): Rule => ({ ...r, conditions: r.conditions.map((c) => ({ ...c, value: c.value !== "" && !Number.isNaN(Number(c.value)) && r.inputs.find((i) => i.name === c.input)?.type === "number" ? Number(c.value) : c.value })) });
  return (
    <Panel title="Rules" eyebrow="yes / no checks you define" right={<Button size="sm" icon="plus" onClick={() => setRules([...rules, blankRule()])}>Add rule</Button>}>
      <div className="space-y-3">
        {rules.length === 0 && <div className="text-[12.5px] text-ink-3">A rule turns your policy into a tool, e.g. “needs review if tier ≥ 4 or quantity &gt; 90”. The agent calls it and gets yes/no plus the reason.</div>}
        {rules.map((r, i) => (
          <div key={i} className="space-y-2 rounded-[var(--radius)] border border-line p-3">
            <div className="grid gap-2 md:grid-cols-[200px_1fr_auto]">
              <input className={inputCls} placeholder="rule_name" value={r.name} onChange={(e) => upd(i, { name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} aria-label="Rule name" />
              <input className={cx(inputCls, "font-sans")} placeholder="What it checks (shown to the agent)" value={r.description} onChange={(e) => upd(i, { description: e.target.value })} aria-label="Rule description" />
              <button type="button" className="micro px-2 text-crit-ink" onClick={() => setRules(rules.filter((_, j) => j !== i))}>remove</button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-2">
              <span className="micro text-ink-3">inputs</span>
              {r.inputs.map((inp, k) => (
                <span key={k} className="inline-flex items-center gap-1">
                  <input className={cx(inputCls, "!w-28")} value={inp.name} placeholder="input" aria-label="Input name" onChange={(e) => upd(i, { inputs: r.inputs.map((x, j) => (j === k ? { ...x, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") } : x)) })} />
                  <select className={cx(inputCls, "!w-24")} value={inp.type} aria-label="Input type" onChange={(e) => upd(i, { inputs: r.inputs.map((x, j) => (j === k ? { ...x, type: e.target.value as "number" } : x)) })}><option value="number">number</option><option value="text">text</option></select>
                </span>
              ))}
              <button type="button" className="micro text-accent" onClick={() => upd(i, { inputs: [...r.inputs, { name: "", type: "number" }] })}>+ input</button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-2">
              <span className="micro text-ink-3">result is yes when</span>
              <Segmented label="Match" value={r.match} onChange={(v) => upd(i, { match: v })} options={[{ value: "all", label: "all" }, { value: "any", label: "any" }]} />
              <span className="text-ink-3">of:</span>
            </div>
            {r.conditions.map((c, k) => (
              <div key={k} className="flex flex-wrap items-center gap-2">
                <select className={cx(inputCls, "!w-36")} value={c.input} aria-label="Condition input" onChange={(e) => upd(i, { conditions: r.conditions.map((x, j) => (j === k ? { ...x, input: e.target.value } : x)) })}>
                  <option value="">input…</option>{r.inputs.filter((x) => x.name).map((x) => <option key={x.name}>{x.name}</option>)}</select>
                <select className={cx(inputCls, "!w-20")} value={c.op} aria-label="Operator" onChange={(e) => upd(i, { conditions: r.conditions.map((x, j) => (j === k ? { ...x, op: e.target.value } : x)) })}>{ops.map((o) => <option key={o}>{o}</option>)}</select>
                <input className={cx(inputCls, "!w-32")} value={String(c.value)} placeholder="value" aria-label="Value" onChange={(e) => upd(i, { conditions: r.conditions.map((x, j) => (j === k ? { ...x, value: e.target.value } : x)) })} />
                {r.conditions.length > 1 && <button type="button" className="micro text-ink-3" onClick={() => upd(i, { conditions: r.conditions.filter((_, j) => j !== k) })}>×</button>}
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="micro text-accent" onClick={() => upd(i, { conditions: [...r.conditions, { input: "", op: ">=", value: "" }] })}>+ condition</button>
              <input className={cx(inputCls, "!w-56 font-sans")} value={r.true_text} placeholder="text when yes" aria-label="Text when yes" onChange={(e) => upd(i, { true_text: e.target.value })} />
              <input className={cx(inputCls, "!w-56 font-sans")} value={r.false_text} placeholder="text when no" aria-label="Text when no" onChange={(e) => upd(i, { false_text: e.target.value })} />
            </div>
          </div>
        ))}
        {(dirty || act.error) && (
          <div className="flex items-center gap-3">
            <Button tone="primary" icon="check" busy={act.busy} disabled={!dirty} onClick={() => void act.run(async () => { await api.put(`/api/agents/${a.id}`, { tools: { rules: rules.map(clean) } }); await onSaved(); })}>Save rules</Button>
            {dirty && <span className="text-[12px] text-warn-ink">Unsaved changes</span>}
          </div>
        )}
        <ErrorLine error={act.error} />
      </div>
    </Panel>
  );
}

function argTemplate(t?: ToolInfo): string {
  if (!t) return "{}";
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(t.parameters.properties)) o[k] = v.enum ? v.enum[0] : v.type === "number" || v.type === "integer" ? 0 : "";
  return JSON.stringify(o);
}

function Console({ a }: { a: AgentFull }) {
  const [tool, setTool] = useState(a.tool_names[0]?.name ?? "");
  const info = a.tool_names.find((t) => t.name === tool);
  const [args, setArgs] = useState(argTemplate(info));
  useEffect(() => { if (!a.tool_names.some((t) => t.name === tool) && a.tool_names.length) setTool(a.tool_names[0].name); }, [a.tool_names, tool]);
  useEffect(() => setArgs(argTemplate(info)), [tool]); // eslint-disable-line react-hooks/exhaustive-deps
  const [out, setOut] = useState<{ result: unknown; error: string | null } | null>(null);
  const act = useAction();
  const run = () => void act.run(async () => { let parsed: unknown; try { parsed = JSON.parse(args); } catch { throw new Error("Arguments must be valid JSON"); } setOut(await api.post(`/api/agents/${a.id}/try`, { tool, arguments: parsed })); });
  if (!a.tool_names.length) return null;
  return (
    <Panel title="Try a tool" eyebrow="exactly what the agent will see">
      <div className="space-y-3">
        <div className="grid gap-2 md:grid-cols-[260px_1fr_auto]">
          <select className={inputCls} value={tool} onChange={(e) => setTool(e.target.value)} aria-label="Tool">{a.tool_names.map((t) => <option key={t.name}>{t.name}</option>)}</select>
          <input className={inputCls} value={args} onChange={(e) => setArgs(e.target.value)} aria-label="Arguments (JSON)" />
          <Button tone="primary" icon="play" busy={act.busy} onClick={run}>Run</Button>
        </div>
        {info && <div className="text-[11.5px] text-ink-3">{info.description}</div>}
        <ErrorLine error={act.error} />
        {out && <pre className={cx("scroll-thin max-h-60 overflow-auto rounded-[var(--radius)] border p-2.5 font-mono text-[11.5px]", out.error ? "border-crit/40 text-crit-ink" : "border-line bg-surface-2 text-ink-2")}>{JSON.stringify(out.result, null, 2)}</pre>}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ step 3 */
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "s_$1").slice(0, 40) || "skill";

function StepSkills({ a, onSaved }: { a: AgentFull; onSaved: () => Promise<void> }) {
  const [skills, setSkills] = useState<Skill[]>(a.skills);
  useEffect(() => setSkills(a.skills), [a.id, a.skills]);
  const [open, setOpen] = useState<number | null>(a.skills.length ? 0 : null);
  const act = useAction();
  const dirty = JSON.stringify(skills) !== JSON.stringify(a.skills);
  const upd = (i: number, s: Partial<Skill>) => setSkills(skills.map((x, j) => (j === i ? { ...x, ...s } : x)));
  const add = () => { setSkills([...skills, { id: "", name: "", description: "", tools: [], not_found: 0, examples: [{ prompt: "", answer: "", calls: [] }] }]); setOpen(skills.length); };
  const save = () => void act.run(async () => {
    const out = skills.map((s) => ({ ...s, id: s.id || slug(s.name), examples: s.examples.filter((e) => e.prompt.trim() && e.answer.trim()) }));
    await api.put(`/api/agents/${a.id}`, { skills: out }); await onSaved();
  });
  return (
    <Panel title="3 · Describe skills" eyebrow={a.name} right={<><AskAI q="Review my skill examples and sample tasks. Suggest better examples (with tool calls) and point out tasks that are too easy, ambiguous, or repetitive." content label="Improve examples" /><Button size="sm" icon="plus" onClick={add}>Add skill</Button></>}>
      <div className="space-y-3">
        {skills.length === 0 && <Empty>Add a skill — a kind of task this agent should get good at.</Empty>}
        {skills.map((s, i) => (
          <div key={i} className={cx("rounded-[var(--radius)] border", open === i ? "border-accent-line" : "border-line")}>
            <button type="button" className="flex w-full items-center gap-3 px-3 py-2.5 text-left" onClick={() => setOpen(open === i ? null : i)}>
              <span className="text-[13px] font-semibold text-ink">{s.name || "New skill"}</span>
              <span className="truncate text-[12px] text-ink-3">{s.description}</span>
              <span className="ml-auto flex shrink-0 gap-1.5">{s.tools.map((t) => <Badge key={t}>{t}</Badge>)}<Badge tone="accent">{s.examples.length} ex.</Badge></span>
            </button>
            {open === i && (
              <div className="space-y-3 border-t border-line p-3">
                <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
                  <Field label="Skill name"><input className={cx(inputCls, "font-sans")} value={s.name} onChange={(e) => upd(i, { name: e.target.value, id: a.skills[i]?.id || slug(e.target.value) })} placeholder="e.g. Copay lookup" /></Field>
                  <Field label="What it means" hint="One sentence the teacher reads before writing tasks."><input className={cx(inputCls, "font-sans")} value={s.description} onChange={(e) => upd(i, { description: e.target.value })} placeholder="Answer the 30-day copay for a drug from the formulary." /></Field>
                </div>
                <Field label="Tools this skill may use">
                  <div className="flex flex-wrap gap-1.5">{a.tool_names.map((t) => {
                    const on = s.tools.includes(t.name);
                    return <button key={t.name} type="button" aria-pressed={on} title={t.description} onClick={() => upd(i, { tools: on ? s.tools.filter((x) => x !== t.name) : [...s.tools, t.name] })}
                      className={cx("rounded-[3px] border px-2 py-1 font-mono text-[11px] transition", on ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-3 hover:text-ink")}>{t.name}</button>;
                  })}</div>
                </Field>
                <Field label={`Not-found cases · ${Math.round(s.not_found * 100)}%`} hint="Questions about things not in your data, so the agent learns to say NOT_FOUND instead of guessing. Needs a lookup tool.">
                  <input type="range" min={0} max={0.5} step={0.05} value={s.not_found} onChange={(e) => upd(i, { not_found: Number(e.target.value) })} className="w-full max-w-sm accent-[var(--accent)]" />
                </Field>
                <div>
                  <div className="micro mb-1.5 text-ink-3">Examples — a question, the answer, and (recommended) the tool calls that prove it</div>
                  <div className="space-y-2">
                    {s.examples.map((ex, k) => (
                      <div key={k} className="grid gap-2 rounded-[var(--radius)] bg-surface-2 p-2 md:grid-cols-[2fr_1fr_2fr_auto]">
                        <input className={cx(inputCls, "font-sans")} value={ex.prompt} placeholder="Question" aria-label="Example question" onChange={(e) => upd(i, { examples: s.examples.map((x, j) => (j === k ? { ...x, prompt: e.target.value } : x)) })} />
                        <input className={inputCls} value={ex.answer} placeholder="Answer" aria-label="Example answer" onChange={(e) => upd(i, { examples: s.examples.map((x, j) => (j === k ? { ...x, answer: e.target.value } : x)) })} />
                        <CallsInput value={ex.calls ?? []} onChange={(calls) => upd(i, { examples: s.examples.map((x, j) => (j === k ? { ...x, calls } : x)) })} />
                        <button type="button" className="micro px-1 text-ink-3" onClick={() => upd(i, { examples: s.examples.filter((_, j) => j !== k) })} aria-label="Remove example">×</button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-3">
                    <button type="button" className="micro text-accent" onClick={() => upd(i, { examples: [...s.examples, { prompt: "", answer: "", calls: [] }] })}>+ example</button>
                    <button type="button" className="micro text-crit-ink" onClick={() => { setSkills(skills.filter((_, j) => j !== i)); setOpen(null); }}>remove skill</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {(dirty || act.error) && (
          <div className="flex items-center gap-3">
            <Button tone="primary" icon="check" busy={act.busy} disabled={!dirty || skills.some((s) => !s.name.trim() || !s.tools.length)} onClick={save}>Save skills</Button>
            {dirty && <span className="text-[12px] text-warn-ink">Unsaved changes{skills.some((s) => !s.name.trim() || !s.tools.length) ? " · every skill needs a name and at least one tool" : ""}</span>}
          </div>
        )}
        <ErrorLine error={act.error} />
      </div>
    </Panel>
  );
}

function CallsInput({ value, onChange }: { value: Call[]; onChange: (c: Call[]) => void }) {
  const [text, setText] = useState(value.length ? JSON.stringify(value) : "");
  const [bad, setBad] = useState(false);
  return (
    <input className={cx(inputCls, "text-[11px]", bad && "!border-crit")} value={text} placeholder='[{"tool":"lookup_…","arguments":{"key":"…"}}]' aria-label="Example tool calls (JSON)"
      onChange={(e) => { setText(e.target.value); try { const v = e.target.value.trim() ? JSON.parse(e.target.value) : []; if (!Array.isArray(v)) throw new Error(); setBad(false); onChange(v); } catch { setBad(true); } }} />
  );
}

/* ------------------------------------------------------------------ step 4 */
function StepTasks({ a, busy, onStarted }: { a: AgentFull; busy: boolean; onStarted: () => Promise<void> }) {
  const models = useApi<{ models: Model[] }>("/api/models");
  const teachers = (models.data?.models ?? []).filter((m) => m.eligibility.teacher.verdict !== "fail" && m.status === "available");
  const [teacher, setTeacher] = useState("");
  useEffect(() => { if (!teacher && teachers.length) setTeacher((teachers.find((m) => m.roles.includes("teacher")) ?? teachers[0]).id); }, [teachers, teacher]);
  const [n, setN] = useState(40);
  const canGenerate = a.skills.some((k) => k.generator);
  const [src, setSrc] = useState<"teacher" | "template">(canGenerate ? "template" : "teacher");
  const act = useAction();
  const status = a.steps.tasks.status;
  const data = useApi<{ tasks: TaskRow[]; rejected: Rejected[] }>(status === "completed" || status === "stale" ? `/api/agents/${a.id}/tasks` : null);
  const s = a.steps.tasks.summary;
  return (
    <>
      <Panel title="4 · Practice tasks" eyebrow={a.name} right={status && <Status s={status === "completed" ? "pass" : status === "stale" ? "warn" : status} label={status} />}>
        <div className="space-y-4">
          {status === "stale" && <Notice tone="warn">The agent's tools or skills changed since these tasks were written. Write them again before teaching.</Notice>}
          {canGenerate && (
            <Field label="Who writes the tasks?" hint={src === "template" ? "The template's built-in generator writes tasks from your tables — no teacher needed, fully reproducible. Every task still passes verification." : "The teacher writes varied, natural tasks in the style of your examples."}>
              <Segmented label="Task source" value={src} onChange={setSrc} options={[{ value: "template", label: "template generator" }, { value: "teacher", label: "teacher model" }]} />
            </Field>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {src === "teacher" ? (
              <Field label="Teacher (writes the tasks)" hint="Must be loaded in LM Studio for this step.">
                <select className={inputCls} value={teacher} onChange={(e) => setTeacher(e.target.value)}>{teachers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
              </Field>
            ) : <div className="text-[12px] leading-relaxed text-ink-3">Skills without a generator (ones you added yourself) are skipped — write those with the teacher.</div>}
            <Field label={`Tasks per skill · ${n}`} hint={`${a.skills.length} skills → up to ${a.skills.length * n} tasks, plus your examples. ${src === "teacher" ? "≈ 10 s each with a 27B teacher." : "Seconds in total; no GPU needed."}`}>
              <input type="range" min={10} max={300} step={10} value={n} onChange={(e) => setN(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button tone="primary" icon="flask" busy={act.busy} disabled={busy || (src === "teacher" && !teacher)}
              onClick={() => void act.run(async () => { await api.post(`/api/agents/${a.id}/steps/tasks`, { source: src, teacher_id: src === "teacher" ? teacher : null, per_skill: n }); await onStarted(); })}>
              {status === "completed" ? "Write a new set" : "Write practice tasks"}</Button>
            {!teachers.length && <span className="text-[12px] text-ink-3">No teacher available — assign one in the Model Observatory.</span>}
          </div>
          {s && (
            <div className="grid grid-cols-2 gap-4 border-t border-line pt-3 sm:grid-cols-5">
              <Readout size="sm" label="accepted" value={s.accepted} sub={`${s.from_you} yours · ${s.not_found} not-found`} />
              <Readout size="sm" label="rejected" value={s.rejected} sub="failed a check" />
              <Readout size="sm" label="practice (train)" value={s.splits.train} />
              <Readout size="sm" label="check-ins (dev)" value={s.splits.dev} />
              <Readout size="sm" label="final test" value={s.splits.test} sub="items never practised" />
            </div>
          )}
          {s && Object.entries(s.by_skill).some(([, v]) => v < 10) && <Notice tone="warn">Some skills have fewer than 10 verified tasks ({Object.entries(s.by_skill).filter(([, v]) => v < 10).map(([k, v]) => `${a.skills.find((x) => x.id === k)?.name ?? k}: ${v}`).join(", ")}). Check the rejected reasons, improve the examples, or ask for more.</Notice>}
          <ErrorLine error={act.error ?? a.steps.tasks.error} />
        </div>
      </Panel>
      <BoundaryPanel aid={a.id} value={a.boundary} onSaved={onStarted} />
      {data.data && <TaskTable a={a} data={data.data} onChange={() => void data.reload()} />}
    </>
  );
}

function TaskTable({ a, data, onChange }: { a: AgentFull; data: { tasks: TaskRow[]; rejected: Rejected[]; review?: ReviewStats }; onChange: () => void }) {
  const [tab, setTab] = useState<"ok" | "no" | "review" | "coverage">("ok");
  const [skill, setSkill] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const name = (id: string) => a.skills.find((s) => s.id === id)?.name ?? id;
  const ok = data.tasks.filter((t) => !skill || t.family === skill);
  const no = data.rejected.filter((r) => !skill || r.skill === skill);
  const reasons = useMemo(() => { const m = new Map<string, number>(); no.forEach((r) => { const k = r.reason.replace(/'[^']*'/g, "…").replace(/\d+(\.\d+)?/g, "#"); m.set(k, (m.get(k) ?? 0) + 1); }); return [...m].sort((x, y) => y[1] - x[1]).slice(0, 5); }, [no]);
  return (
    <Panel flush title="Tasks" right={<><AskAI q="Explain the rejection reasons and how to change the skills, examples or tools so more tasks pass verification." label="Why rejected?" /><select className={cx(inputCls, "h-7 !w-auto font-sans")} value={skill} onChange={(e) => setSkill(e.target.value)} aria-label="Skill filter"><option value="">all skills</option>{a.skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></>}>
      <div className="px-[var(--pad)] pt-2"><Tabs value={tab} onChange={setTab} tabs={[{ value: "ok", label: "Accepted", count: ok.length }, { value: "no", label: "Rejected", count: no.length },
        { value: "review", label: "Human review", count: data.review?.pending }, { value: "coverage", label: "Coverage map" }]} /></div>
      {tab === "coverage" ? <CoverageMap aid={a.id} name={name} /> : tab === "review" ? <ReviewQueue a={a} tasks={ok} stats={data.review} onChange={onChange} /> : tab === "ok" ? (
        <div className="scroll-thin max-h-[460px] overflow-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-surface-2"><tr><th className={th}>Question</th><th className={th}>Answer</th><th className={th}>Skill</th><th className={th}>Split</th><th className={th}>From</th><th className={th}>Review</th></tr></thead>
            <tbody>{ok.map((t) => (
              <Fragment key={t.task_id}>
                <tr className={cx(tr, "cursor-pointer")} onClick={() => setSel(sel === t.task_id ? null : t.task_id)}>
                  <td className={cx(td, "max-w-[420px]")}><div className="line-clamp-2 text-ink">{t.prompt}</div></td>
                  <td className={cx(td, "font-mono")}>{t.meta.not_found ? <Badge>NOT_FOUND</Badge> : t.reference_answer}</td>
                  <td className={cx(td, "text-ink-3")}>{name(t.family)}</td>
                  <td className={td}><Badge tone={t.split === "test" ? "accent" : "default"}>{t.split}</Badge></td>
                  <td className={cx(td, "text-ink-3")}>{t.meta.source === "template" ? "generator" : t.meta.source}</td>
                  <td className={td}>{t.review ? <Badge tone={t.review.status === "rejected" ? "crit" : t.review.status === "corrected" ? "warn" : "good"} title={`${t.review.reviewer} · ${t.review.note}`}>{t.review.status}</Badge> : <span className="text-[11px] text-ink-3">pending</span>}</td>
                </tr>
                {sel === t.task_id && <tr><td colSpan={6} className="bg-surface-2 px-[var(--pad)] py-2"><div className="micro mb-1 text-ink-3">verified tool calls</div>
                  {t.reference_calls.length ? t.reference_calls.map((c, i) => <div key={i} className="font-mono text-[11px] text-ink-2">{i + 1}. {c.tool}({JSON.stringify(c.arguments)})</div>) : <div className="text-[11.5px] text-ink-3">Your example without tool calls — the teacher's solution will be checked against your answer.</div>}</td></tr>}
              </Fragment>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-2 p-[var(--pad)]">
          {reasons.length > 0 && <div className="flex flex-wrap gap-1.5">{reasons.map(([r, n]) => <Badge key={r} tone="warn">{n} × {r}</Badge>)}</div>}
          <div className="scroll-thin max-h-[420px] overflow-auto">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-surface-2"><tr><th className={th}>Candidate</th><th className={th}>Why it was rejected</th><th className={th}>From</th></tr></thead>
              <tbody>{no.map((r, i) => (
                <tr key={i} className={tr}>
                  <td className={cx(td, "max-w-[380px]")}><div className="line-clamp-2 text-ink-2">{r.candidate?.question ?? r.candidate?.prompt ?? "—"}</div>{r.candidate?.answer != null && <div className="font-mono text-[10.5px] text-ink-3">→ {String(r.candidate.answer)}</div>}</td>
                  <td className={cx(td, "text-crit-ink")}>{r.reason}</td>
                  <td className={cx(td, "text-ink-3")}>{r.source}</td>
                </tr>))}</tbody>
            </table>
          </div>
        </div>
      )}
    </Panel>
  );
}

function ReviewQueue({ a, tasks, stats, onChange }: { a: AgentFull; tasks: TaskRow[]; stats?: ReviewStats; onChange: () => void }) {
  const [reviewer, setReviewer] = useReviewer();
  const [showAll, setShowAll] = useState(false);
  const queue = tasks.filter((t) => showAll || !t.review);
  const [i, setI] = useState(0);
  const t = queue[Math.min(i, Math.max(0, queue.length - 1))];
  const [edit, setEdit] = useState<{ q: string; a: string } | null>(null);
  const [note, setNote] = useState("");
  const act = useAction();
  const name = (id: string) => a.skills.find((s) => s.id === id)?.name ?? id;
  const send = (decision: "approve" | "reject" | "correct" | "reset") => void act.run(async () => {
    await api.post(`/api/agents/${a.id}/review`, { task_id: t.task_id, decision, reviewer, note,
      ...(decision === "correct" && edit ? { question: edit.q, answer: edit.a } : {}) });
    setEdit(null); setNote(""); onChange();
    if (showAll) setI(i + 1);
  });
  const done = stats ? stats.total - stats.pending : 0;
  return (
    <div className="space-y-3 p-[var(--pad)]">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[200px] flex-1">
          <div className="flex justify-between text-[11.5px] text-ink-3"><span>{done} of {stats?.total ?? 0} reviewed</span>
            <span>{stats?.approved ?? 0} approved · {stats?.corrected ?? 0} corrected · {stats?.rejected ?? 0} rejected</span></div>
          <div className="mt-1 h-[6px] overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-[color:var(--good)]" style={{ width: `${stats?.total ? (done / stats.total) * 100 : 0}%` }} /></div>
        </div>
        <input className={cx(inputCls, "!w-36 font-sans")} placeholder="your name / initials" value={reviewer} onChange={(e) => setReviewer(e.target.value)} aria-label="Reviewer" />
        <label className="flex items-center gap-1.5 text-[11.5px] text-ink-3"><input type="checkbox" checked={showAll} onChange={(e) => { setShowAll(e.target.checked); setI(0); }} />show reviewed too</label>
      </div>
      <p className="text-[12px] leading-relaxed text-ink-2">People stay in charge of what the agent learns. Approve tasks that are right and realistic, correct the wording or the answer (FORGE re-checks a correction against the tools), or reject anything you would not want taught. Studies can be told to use <b className="text-ink">only reviewed tasks</b>.</p>
      {!t ? <Empty>Nothing left to review{showAll ? "" : " — tick “show reviewed too” to revisit decisions"}.</Empty> : (
        <div className="space-y-3 rounded-[var(--radius)] border border-line p-3">
          <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-ink-3"><Badge>{name(t.family)}</Badge><Badge>{t.split}</Badge><span>from {t.meta.source === "template" ? "generator" : t.meta.source}</span>
            {t.review && <Badge tone={t.review.status === "rejected" ? "crit" : "good"}>{t.review.status} by {t.review.reviewer}</Badge>}
            <span className="ml-auto font-mono">{Math.min(i, queue.length - 1) + 1} / {queue.length}</span></div>
          {edit ? (
            <div className="space-y-2">
              <Field label="Question"><textarea className={cx(inputCls, "h-16 py-1.5 font-sans text-[13px]")} value={edit.q} onChange={(e) => setEdit({ ...edit, q: e.target.value })} /></Field>
              <Field label="Answer"><input className={inputCls} value={edit.a} onChange={(e) => setEdit({ ...edit, a: e.target.value })} /></Field>
            </div>
          ) : (
            <>
              <div className="text-[13.5px] text-ink">{t.review?.question ?? t.prompt}</div>
              <div className="font-mono text-[12px] text-ink-2">{t.reference_calls.map((c, k) => <div key={k}>{k + 1}. {c.tool}({JSON.stringify(c.arguments)})</div>)}</div>
              <div className="text-[12.5px]">Answer: <span className="font-mono font-semibold text-ink">{t.review?.answer ?? t.reference_answer}</span></div>
            </>
          )}
          <input className={cx(inputCls, "font-sans")} placeholder="note (optional): why?" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Review note" />
          <div className="flex flex-wrap gap-2">
            {edit ? (<>
              <Button tone="primary" icon="check" busy={act.busy} disabled={!reviewer.trim()} onClick={() => send("correct")}>Save correction</Button>
              <Button tone="ghost" onClick={() => setEdit(null)}>Cancel</Button></>) : (<>
              <Button tone="primary" icon="check" busy={act.busy} disabled={!reviewer.trim()} onClick={() => send("approve")}>Approve</Button>
              <Button busy={act.busy} disabled={!reviewer.trim()} onClick={() => setEdit({ q: t.review?.question ?? t.prompt, a: t.review?.answer ?? t.reference_answer })}>Correct…</Button>
              <Button tone="danger" busy={act.busy} disabled={!reviewer.trim()} onClick={() => send("reject")}>Reject</Button>
              {t.review && <Button tone="ghost" busy={act.busy} disabled={!reviewer.trim()} onClick={() => send("reset")}>Undo review</Button>}
              <Button tone="ghost" onClick={() => setI(i + 1)} disabled={i >= queue.length - 1}>Skip</Button></>)}
          </div>
          {!reviewer.trim() && <div className="text-[11.5px] text-warn-ink">Enter your name or initials — every review is recorded with who made it.</div>}
          <ErrorLine error={act.error} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ step 5 */
function StepTeach({ a, studies, onCreated }: { a: AgentFull; studies: StudyRow[]; onCreated: () => void }) {
  const { set } = usePrefs();
  const models = useApi<{ models: Model[] }>("/api/models");
  const all = models.data?.models ?? [];
  const students = all.filter((m) => m.capabilities.lora?.status === "supported" && m.eligibility.student.verdict !== "fail" && m.status === "available");
  const teachers = all.filter((m) => m.eligibility.teacher.verdict !== "fail" && m.status === "available");
  const [student, setStudent] = useState("");
  const [teacher, setTeacher] = useState("");
  const [profile, setProfile] = useState<"smoke" | "pilot" | "research">("pilot");
  const [focus, setFocus] = useState<string[]>([]);
  const [reviewedOnly, setReviewedOnly] = useState(false);
  const rv = a.review;
  const rd = useApi<Readiness>("/api/system/readiness");
  const cudaOk = rd.data?.checks.find((c) => c.id === "cuda")?.status === "pass";
  const device: "cuda" | "cpu" = cudaOk || !rd.data?.cpu_wiring_mode ? "cuda" : "cpu";
  useEffect(() => {
    if (!student && students.length) setStudent((students.find((m) => m.roles.includes("student")) ?? students[0]).id);
    if (!teacher && teachers.length) setTeacher((teachers.find((m) => m.roles.includes("teacher")) ?? teachers[0]).id);
  }, [students, teachers, student, teacher]);
  const act = useAction();
  const s = a.steps.tasks.summary;
  const trainable = a.skills.filter((k) => (s?.by_skill[k.id] ?? 0) > 0);
  const create = (go: "studio" | "lens") => void act.run(async () => {
    const st = await api.post<StudySummary>("/api/studies", { name: `${profile} · ${a.name}${focus.length ? ` · ${focus.map((f) => a.skills.find((k) => k.id === f)?.name ?? f).join(", ")}` : ""}`,
      profile, teacher_id: teacher, student_id: student, agent_id: a.id, arms: ["teacher_filtered"], device, focus_skills: focus.length && focus.length < trainable.length ? focus : null, require_review: reviewedOnly });
    set("activeStudy", st.id); onCreated(); window.location.hash = go === "studio" ? "/studio" : "/lens";
  });
  return (
    <Panel title="5 · Teach & measure" eyebrow={a.name}>
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Student (the small model to train)" hint="Local safetensors weights — get one from the Hub tab in the Model Observatory.">
            <select className={inputCls} value={student} onChange={(e) => setStudent(e.target.value)}>{students.map((m) => <option key={m.id} value={m.id}>{m.name} · {fmt.params(m.parameter_count)}</option>)}</select>
          </Field>
          <Field label="Teacher (demonstrates the tasks)"><select className={inputCls} value={teacher} onChange={(e) => setTeacher(e.target.value)}>{teachers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
        </div>
        <Field label="How thorough?"><Segmented label="Profile" value={profile} onChange={setProfile} options={[{ value: "smoke", label: "quick check" }, { value: "pilot", label: "pilot" }, { value: "research", label: "research" }]} /></Field>
        <Field label="Focus skills (optional)" hint={focus.length ? "Training uses only these skills; every skill is still tested, so you see the gain here and any side effect elsewhere." : "None selected: train on every skill."}>
          <div className="flex flex-wrap gap-1.5">{trainable.map((k) => {
            const on = focus.includes(k.id);
            return <button key={k.id} type="button" aria-pressed={on} onClick={() => setFocus(on ? focus.filter((x) => x !== k.id) : [...focus, k.id])}
              className={cx("rounded-[3px] border px-2 py-1 text-[11.5px] transition", on ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-3 hover:text-ink")}>{k.name} <span className="font-mono text-[10px] text-ink-3">{s?.by_skill[k.id]}</span></button>;
          })}</div>
        </Field>
        {rv && (
          <label className="flex items-start gap-2.5 rounded-[var(--radius)] border border-line p-3 text-[12.5px] text-ink-2">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--accent)]" checked={reviewedOnly} onChange={(e) => setReviewedOnly(e.target.checked)} disabled={rv.approved + rv.corrected === 0} />
            <span><b className="text-ink">Teach only tasks a person reviewed</b> ({rv.approved + rv.corrected} of {rv.total} approved or corrected). Rejected tasks are always left out ({rv.rejected}).</span>
          </label>
        )}
        {rd.data && (device === "cpu"
          ? <Notice tone="warn">No CUDA GPU is available to FORGE and CPU wiring mode is on: this study will train on the CPU. That only checks the plumbing — its results are not meaningful.</Notice>
          : !cudaOk && <Notice tone="warn">FORGE cannot see a CUDA GPU right now. You can create the study, but training will refuse to start until the GPU is available.</Notice>)}
        {a.steps.tasks.status !== "completed" && <Notice tone="warn">The practice tasks are {a.steps.tasks.status ?? "missing"} — the agent changed since they were written. Write them again (step 4) before creating a new study. Existing studies below keep their frozen copy.</Notice>}
        {s && s.splits.test < 10 && <Notice tone="warn">Only {s.splits.test} final-test tasks — results will be very uncertain. Write more practice tasks first.</Notice>}
        <ol className="space-y-1.5 rounded-[var(--radius)] border border-line bg-surface-2 p-3 text-[12.5px] text-ink-2">
          <li><b className="text-ink">1. Collect</b> — the teacher solves every task with the agent's tools (teacher loaded in LM Studio).</li>
          <li><b className="text-ink">2. Build</b> — only its fully correct, tool-backed solutions become lessons.</li>
          <li><b className="text-ink">3. Train</b> — <span className="text-warn-ink">unload the teacher first</span> (one GPU), then the student learns.</li>
          <li><b className="text-ink">4. Evaluate</b> — before vs after, on items the student never practised; then open the Distillation Lens.</li>
        </ol>
        <div className="flex flex-wrap items-center gap-3">
          <Button tone="primary" icon="play" busy={act.busy} disabled={!student || !teacher || a.steps.tasks.status !== "completed"} onClick={() => create("studio")}>Create the study and open Experiment Studio</Button>
          {!students.length && <span className="text-[12px] text-ink-3">No trainable student yet.</span>}
        </div>
        {studies.length > 0 && (
          <div className="space-y-1.5 border-t border-line pt-3">
            <div className="micro text-ink-3">studies for this agent</div>
            {studies.map((x) => (
              <div key={x.id} className="flex flex-wrap items-center gap-2 text-[12.5px]">
                <span className="font-medium text-ink">{x.name}</span><Badge>{x.profile}</Badge><span className="text-ink-3">next: {x.next_stage ?? "done"}</span>
                <span className="ml-auto flex gap-3">
                  {(["studio", "evaluation", "lens", "trajectories"] as const).map((pg) => <button key={pg} type="button" className="micro text-accent" onClick={() => { set("activeStudy", x.id); window.location.hash = `/${pg}`; }}>{pg}</button>)}
                </span>
              </div>
            ))}
          </div>
        )}
        <ErrorLine error={act.error} />
      </div>
    </Panel>
  );
}
