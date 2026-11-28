import { takeHandoff } from "../lib/handoff";
import { Fragment, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Icon } from "../components/icons";
import { EmbeddingMap } from "../components/embmap";
import { JobLog } from "../components/live";
import { Badge, Button, Empty, ErrorLine, Field, Notice, PageHeader, Panel, Prov, Readout, Segmented, Status, Tabs, cx, inputCls, td, th, tr } from "../components/ui";
import { api, fmt, qs } from "../lib/api";
import { useAction, useApi } from "../lib/hooks";
import { useAssistantScope } from "../lib/assistant";
import { usePrefs } from "../lib/prefs";
import type { Job, Model, Readiness, StudyRow, StudySummary } from "../lib/types";

/* ------------------------------------------------------------------ types */
type StepStatus = "completed" | "running" | "failed" | "stale" | undefined;
interface PackShort { id: string; name: string; source_dir: string; created_at: string; steps: Record<string, StepStatus>; embedding: { model: string; dim: number } | null; summary: Record<string, Record<string, unknown> | undefined> }
interface PackFull extends PackShort {
  path: string; attestation: { no_sensitive_data: boolean; at: string }; chunking: { size: number; overlap: number };
  skipped: { path: string; reason: string }[]; counts: { documents: number; passages: number; questions: number; rejected: number };
  jobs: Job[]; steps: Record<string, StepStatus>; stepsDetail?: never; hashes?: Record<string, string | null>;
}
interface DocRow { doc_id: string; path: string; title: string; chars: number; kind: string; passages: number }
interface ChunkRow { chunk_id: string; doc_id: string; order: number; text: string }
interface Hit { chunk_id: string; doc_id: string; title: string; text: string; score: number; keyword_rank?: number; keyword_score?: number; vector_rank?: number; similarity?: number }
interface QRow { task_id: string; family: string; split: string; prompt: string; reference_answer: string; meta: { gold_chunk: string | null; doc_id: string; retrievable: boolean | null; unit: string }; gold_text: string | null }
interface Rejected { chunk_id: string; kind: string; candidate: Record<string, unknown> | null; reason: string }

const JOURNEY = [
  { key: "docs", title: "Add your documents", line: "Choose a folder. FORGE reads it and cuts it into passages." },
  { key: "search", title: "Make it searchable", line: "Build an index so the right passage can be found for any question." },
  { key: "questions", title: "Create practice questions", line: "The teacher writes questions with answers it can prove." },
  { key: "teach", title: "Teach the student", line: "Train a small model to search, answer, cite — or say not found." },
  { key: "results", title: "See what it learned", line: "Compare before and after on documents it never practised on." },
] as const;
type JKey = (typeof JOURNEY)[number]["key"];

/* ------------------------------------------------------------------ page */
export default function KnowledgeStudio() {
  const packs = useApi<PackShort[]>("/api/knowledge", 6000);
  const [pid, setPid] = useState<string | null>(() => takeHandoff("pack"));
  const [creating, setCreating] = useState(() => takeHandoff("new-pack") === "1");
  const list = packs.data ?? [];
  useEffect(() => { if (!pid && list.length) setPid(list[0].id); }, [list, pid]);
  const pack = useApi<PackFull>(pid ? `/api/knowledge/${pid}` : null, 3000);
  const studies = useApi<StudyRow[]>("/api/studies", 8000);
  const p = pack.data;
  useAssistantScope("pack", p?.id, p?.name);
  const done = (s: string) => p?.steps[s] === "completed";
  const packStudies = useMemo(() => (studies.data ?? []).filter((s) => p && s.knowledge_pack === p.id), [studies.data, p]);
  const reached: Record<JKey, boolean> = { docs: true, search: !!p && done("import"), questions: !!p && done("index"), teach: !!p && done("questions"), results: packStudies.length > 0 };
  const firstOpen = (JOURNEY.find((j) => !({ docs: done("import"), search: done("index"), questions: done("questions"), teach: packStudies.length > 0, results: false } as Record<JKey, boolean>)[j.key])?.key ?? "results") as JKey;
  const [step, setStep] = useState<JKey | null>(null);
  const cur: JKey = !p || creating ? "docs" : step && reached[step] ? step : firstOpen;
  const running = p?.jobs.find((j) => j.status === "running");

  return (
    <div className="space-y-4 fit:flex fit:h-full fit:min-h-0 fit:flex-col fit:gap-3 fit:space-y-0">
      <PageHeader kicker="Build" title="Knowledge Studio"
        subtitle="Teach a small local model to answer questions from your own documents — and to say “not found” when they don't contain the answer. Everything stays on this computer."
        right={<>
          {list.length > 0 && (
            <select className={cx(inputCls, "h-8 !w-auto max-w-[280px] font-sans")} value={creating ? "" : pid ?? ""} aria-label="Knowledge pack"
              onChange={(e) => { setCreating(false); setPid(e.target.value); setStep(null); }}>
              {creating && <option value="">(new pack)</option>}
              {list.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          )}
          <Button icon="plus" tone={list.length ? "default" : "primary"} onClick={() => { setCreating(true); setStep("docs"); }}>New knowledge pack</Button>
        </>} />
      <Journey cur={cur} reached={reached} done={{ docs: done("import"), search: done("index"), questions: done("questions"), teach: packStudies.length > 0, results: false }}
        onPick={(k) => { if (reached[k]) { setStep(k); setCreating(false); } }} />
      <ErrorLine error={packs.error ?? pack.error} />
      <div className="grid gap-4 fit:min-h-0 fit:flex-1 fit:grid-cols-[minmax(0,1fr)_380px] fit:gap-3 3xl:fit:grid-cols-[minmax(0,1fr)_440px]">
        <div className="scroll-thin min-w-0 space-y-4 fit:min-h-0 fit:space-y-3 fit:overflow-auto fit:pr-1">
          {running && <Panel title="Working…" eyebrow="live"><JobLog key={running.id} jobId={running.id} height={200} onDone={() => { void pack.reload(); }} /></Panel>}
          {(creating || !p) && cur === "docs" ? <CreatePack onCreated={(id) => { setCreating(false); setPid(id); setStep("docs"); void packs.reload(); }} /> : p && (
            <>
              {cur === "docs" && <StepDocs p={p} busy={!!running} onChange={pack.reload} />}
              {cur === "search" && <StepSearch p={p} busy={!!running} onChange={pack.reload} />}
              {cur === "questions" && <StepQuestions p={p} busy={!!running} onChange={pack.reload} />}
              {cur === "teach" && <StepTeach p={p} studies={packStudies} onCreated={() => { void studies.reload(); }} />}
              {cur === "results" && <StepResults studies={packStudies} />}
            </>
          )}
        </div>
        <Explainer step={cur} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ journey bar */
function Journey({ cur, reached, done, onPick }: { cur: JKey; reached: Record<JKey, boolean>; done: Record<JKey, boolean>; onPick: (k: JKey) => void }) {
  return (
    <ol className="grid gap-2 sm:grid-cols-5 fit:shrink-0" aria-label="Steps">
      {JOURNEY.map((j, i) => {
        const isCur = cur === j.key, ok = done[j.key], open = reached[j.key];
        return (
          <li key={j.key}>
            <button type="button" disabled={!open} onClick={() => onPick(j.key)} aria-current={isCur ? "step" : undefined}
              className={cx("reg flex h-full w-full items-start gap-3 rounded-[var(--radius)] border bg-surface p-3 text-left transition",
                isCur ? "border-accent ring-2 ring-accent-soft" : ok ? "border-[color:var(--good)]/40 hover:border-[color:var(--good)]/70" : open ? "border-line hover:border-accent-line" : "border-line opacity-55")}>
              <span className={cx("num flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-[12px]",
                ok ? "border-[color:var(--good)] bg-[color:var(--good)] text-white" : isCur ? "border-accent bg-accent text-accent-ink" : "border-line-strong text-ink-3")}>
                {ok ? <Icon name="check" size={14} /> : !open ? <Icon name="lock" size={12} /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className={cx("block text-[12.5px] font-semibold", isCur ? "text-ink" : "text-ink-2")}>{j.title}</span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-3">{j.line}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ explainer */
const EXPLAIN: Record<JKey, { title: string; body: ReactNode; terms: [string, string][] }> = {
  docs: {
    title: "Why cut documents into passages?",
    body: <>A small model can only read a page or two at a time, so FORGE splits each document into short <b>passages</b> (about a paragraph or three). When someone asks a question, the right passages are found and shown to the model. <b>The facts stay in your documents</b> — the model learns how to use them, not to memorise them, so you can update documents later without retraining.</>,
    terms: [["Passage", "A short piece of a document — what the model actually reads."], ["Local only", "Files are read on this computer. Nothing is uploaded."]],
  },
  search: {
    title: "Two ways to find the right passage",
    body: <><b>Keyword search</b> looks for the same words (“battery”, “warranty”). <b>Meaning search</b> uses an <b>embedding model</b> to turn text into numbers so that similar meanings land close together — “how long does it run” can find “lasts about nine hours”. FORGE combines both. Try the search box: this is exactly the tool the student will use.</>,
    terms: [["Embedding", "A list of numbers that represents what a passage means."], ["Index", "The prepared lookup that makes search instant."]],
  },
  questions: {
    title: "Why practice questions — and why some have no answer",
    body: <>The big <b>teacher</b> model reads one passage at a time and writes a question with the answer <b>copied word-for-word</b>, so FORGE can check it automatically. Some questions are deliberately <b>not answerable</b> from your documents: they teach the student to say <span className="font-mono">NOT_FOUND</span> instead of making things up. Questions are split <b>by document</b>, so the final test uses documents the student never practised on.</>,
    terms: [["Teacher", "The large model in LM Studio that demonstrates the task."], ["Held-out", "Kept aside so the final test is fair."]],
  },
  teach: {
    title: "What training actually changes",
    body: <>The teacher answers every practice question with the search tool; only its <b>verified</b> answers become lessons. The <b>student</b> (a small model) is then fine-tuned with LoRA — a small add-on to its weights — to <b>search, read, answer briefly, cite the passage, or say not found</b>. It learns the skill, not the facts.</>,
    terms: [["Student", "The small model you will run day to day."], ["LoRA", "A small trainable add-on; the original model is never modified."]],
  },
  results: {
    title: "How we know it worked",
    body: <>FORGE runs the <b>same questions</b> through the student before and after training, on documents it never trained on, and reports the improvement with a <b>confidence range</b>. The teacher's score shows the ceiling. Open any question to see the exact searches and answers side by side — that is where you learn what changed.</>,
    terms: [["Confidence range", "How much the result could move by chance."], ["Strict success", "Right answer, found the right passage, no mistakes."]],
  },
};

function Explainer({ step }: { step: JKey }) {
  const e = EXPLAIN[step];
  const stage = { docs: 1, search: 2, questions: 3, teach: 4, results: 5 }[step];
  const nodes = ["Documents", "Passages", "Search", "Student", "Cited answer"];
  const lit = { 1: [0, 1], 2: [1, 2], 3: [1, 2, 3], 4: [2, 3], 5: [3, 4] }[stage]!;
  return (
    <Panel fill title="What's happening" eyebrow={`step ${stage} of 5`} className="fit:min-h-0">
      <div className="space-y-4">
        <svg viewBox="0 0 340 66" className="w-full" role="img" aria-label="How a question is answered from your documents">
          {nodes.map((n, i) => {
            const x = 4 + i * 68, on = lit.includes(i);
            return (
              <g key={n}>
                {i > 0 && <line x1={x - 12} x2={x - 2} y1={28} y2={28} stroke={on && lit.includes(i - 1) ? "var(--accent)" : "var(--line-strong)"} strokeWidth={1.5} />}
                <rect x={x} y={12} width={58} height={32} rx={6} fill={on ? "var(--accent-soft)" : "var(--surface-2)"} stroke={on ? "var(--accent)" : "var(--line)"} />
                <text x={x + 29} y={32} textAnchor="middle" fontSize={8.5} fill={on ? "var(--ink)" : "var(--ink-3)"} fontFamily="Inter,system-ui,sans-serif">{n}</text>
              </g>
            );
          })}
          <text x={4} y={60} fontSize={8} fill="var(--ink-3)" fontFamily="Inter,system-ui,sans-serif">highlighted: what this step works on</text>
        </svg>
        <h3 className="text-[14px] font-semibold text-ink">{e.title}</h3>
        <p className="text-[13px] leading-relaxed text-ink-2 [&_b]:font-semibold [&_b]:text-ink">{e.body}</p>
        <dl className="space-y-2 border-t border-line pt-3">
          {e.terms.map(([k, v]) => <div key={k}><dt className="text-[12px] font-semibold text-ink">{k}</dt><dd className="text-[12px] text-ink-3">{v}</dd></div>)}
        </dl>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ step 1 */
function CreatePack({ onCreated }: { onCreated: (id: string) => void }) {
  const sample = useApi<{ available: boolean; path: string; files: string[]; description: string }>("/api/knowledge/sample");
  const [src, setSrc] = useState<"sample" | "folder">("sample");
  const [f, setF] = useState({ name: "", folder: "", ok: false });
  const act = useAction();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void act.run(async () => {
      const r = await api.post<{ id: string }>("/api/knowledge", { name: f.name || (src === "sample" ? "FORGE documentation" : "My documents"),
        folder: src === "folder" ? f.folder : null, use_sample: src === "sample", no_sensitive_data: f.ok });
      const id = r.id;
      await api.post(`/api/knowledge/${id}/steps/import`, {});
      onCreated(id);
    });
  };
  return (
    <Panel title="1 · Add your documents" eyebrow="new knowledge pack">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          {([["sample", "Try it with sample documents", sample.data?.available ? `FORGE's own guides (${sample.data.files.length} files) — public, nothing sensitive. Best for a first run.` : "Sample not available."],
             ["folder", "Use my own folder", "Text, Markdown, HTML or PDF files. Sub-folders are included; hidden folders are skipped."]] as const).map(([k, t, d]) => (
            <button key={k} type="button" onClick={() => setSrc(k)} aria-pressed={src === k}
              className={cx("rounded-[var(--radius)] border p-3 text-left transition", src === k ? "border-accent bg-accent-soft" : "border-line hover:border-accent-line")}>
              <div className="flex items-center gap-2 text-[13px] font-semibold text-ink"><span className={cx("h-3.5 w-3.5 rounded-full border-2", src === k ? "border-accent bg-accent" : "border-line-strong")} />{t}</div>
              <div className="mt-1 text-[12px] text-ink-3">{d}</div>
            </button>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Name this pack"><input className={inputCls} value={f.name} placeholder={src === "sample" ? "FORGE documentation" : "e.g. Product manuals"} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          {src === "folder" && <Field label="Folder on this computer" hint="Full path, e.g. C:\Users\you\Documents\manuals"><input className={inputCls} value={f.folder} onChange={(e) => setF({ ...f, folder: e.target.value })} /></Field>}
        </div>
        <label className={cx("flex items-start gap-3 rounded-[var(--radius)] border p-3", f.ok ? "border-[color:var(--good)]/40 bg-[color:var(--good)]/[0.04]" : "border-[color:var(--warn)]/60 bg-[color:var(--warn)]/[0.07]")}>
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--accent)]" checked={f.ok} onChange={(e) => setF({ ...f, ok: e.target.checked })} />
          <span className="text-[12.5px] leading-relaxed text-ink-2"><b className="text-ink">I confirm these documents contain no patient, personal, or confidential information.</b> FORGE keeps everything on this computer, but the teacher model will read every passage and its questions and answers are stored in plain text.</span>
        </label>
        <div className="flex items-center gap-3">
          <Button type="submit" tone="primary" icon="download" busy={act.busy} disabled={!f.ok || (src === "folder" && !f.folder)}>Create pack and read documents</Button>
          {!f.ok && <span className="text-[12px] text-ink-3">Tick the confirmation to continue.</span>}
        </div>
        <ErrorLine error={act.error} />
      </form>
    </Panel>
  );
}

function StepDocs({ p, busy, onChange }: { p: PackFull; busy: boolean; onChange: () => Promise<void> }) {
  const docs = useApi<DocRow[]>(p.steps.import === "completed" ? `/api/knowledge/${p.id}/docs` : null);
  const [doc, setDoc] = useState<string | null>(null);
  const passages = useApi<{ total: number; rows: ChunkRow[] }>(doc ? `/api/knowledge/${p.id}/chunks${qs({ doc_id: doc, limit: 50 })}` : null);
  const act = useAction();
  const s = p.summary.import as { documents: number; passages: number; skipped: number; characters: number } | undefined;
  return (
    <>
      <Panel title="1 · Your documents" eyebrow={p.name} prov={<Prov kind="measured" source="files on this computer" />}
        right={<Button size="sm" icon="refresh" disabled={busy} busy={act.busy} onClick={() => void act.run(async () => { await api.post(`/api/knowledge/${p.id}/steps/import`, {}); await onChange(); })}>Re-read folder</Button>}>
        <div className="space-y-3">
          <div className="break-all font-mono text-[11px] text-ink-3">{p.source_dir}</div>
          {p.steps.import !== "completed" ? <Empty icon="file">{p.steps.import === "failed" ? "Reading failed — see the log above." : "Reading documents…"}</Empty> : s && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Readout label="documents" value={s.documents} size="sm" /><Readout label="passages" value={s.passages} size="sm" sub="what the model reads" />
              <Readout label="characters" value={fmt.params(s.characters)} size="sm" /><Readout label="skipped files" value={s.skipped} size="sm" tone={s.skipped ? "muted" : "default"} />
            </div>
          )}
          {p.skipped.length > 0 && <details className="text-[12px] text-ink-3"><summary className="cursor-pointer">Why were {p.skipped.length} files skipped?</summary>
            <ul className="mt-1 space-y-0.5 font-mono text-[11px]">{p.skipped.slice(0, 50).map((x) => <li key={x.path}>{x.path} — {x.reason}</li>)}</ul></details>}
          <ErrorLine error={act.error} />
        </div>
      </Panel>
      {docs.data && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] fit:gap-3">
          <Panel flush title="Documents" right={<span className="text-[11.5px] text-ink-3">click one to see its passages</span>}>
            <div className="scroll-thin max-h-[420px] overflow-auto">
              <table className="w-full text-[12px]"><thead className="sticky top-0 bg-surface-2"><tr><th className={th}>Title</th><th className={th}>File</th><th className={cx(th, "text-right")}>Passages</th></tr></thead>
                <tbody>{docs.data.map((d) => (
                  <tr key={d.doc_id} onClick={() => setDoc(d.doc_id)} className={cx(tr, "cursor-pointer", doc === d.doc_id && "!bg-accent-soft")}>
                    <td className={cx(td, "font-medium text-ink")}>{d.title}</td><td className={cx(td, "font-mono text-[11px] text-ink-3")}>{d.path}</td>
                    <td className={cx(td, "num text-right font-mono")}>{d.passages}</td></tr>))}</tbody></table>
            </div>
          </Panel>
          <Panel title="Passages" eyebrow="exactly what the model will read">
            {!doc ? <Empty icon="file">Select a document on the left.</Empty> : (
              <ol className="scroll-thin max-h-[420px] space-y-2 overflow-auto pr-1">{passages.data?.rows.map((c) => (
                <li key={c.chunk_id} className="rounded-[var(--radius)] border border-line bg-surface-2 p-2.5">
                  <div className="mb-1 font-mono text-[10px] text-ink-3">{c.chunk_id} · {c.text.length} characters</div>
                  <div className="whitespace-pre-wrap text-[12px] leading-relaxed text-ink-2">{c.text}</div></li>))}</ol>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ step 2 */
function StepSearch({ p, busy, onChange }: { p: PackFull; busy: boolean; onChange: () => Promise<void> }) {
  const em = useApi<{ endpoint: string; models: { id: string; state?: string }[] }>("/api/knowledge/embedding-models");
  const [method, setMethod] = useState<"hybrid" | "keyword">("hybrid");
  const [model, setModel] = useState("");
  useEffect(() => { if (!model && em.data?.models.length) setModel(em.data.models[0].id); }, [em.data, model]);
  const act = useAction();
  const s = p.summary.index as { mode: string; model: string | null; dim: number | null; passages: number } | undefined;
  const noModels = em.data && em.data.models.length === 0;
  return (
    <>
      <Panel title="2 · Make it searchable" eyebrow={p.name} right={p.steps.index && <Status s={p.steps.index === "completed" ? "pass" : p.steps.index === "stale" ? "warn" : p.steps.index} label={p.steps.index} />}>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {([["hybrid", "Keywords + meaning (recommended)", "Uses an embedding model from LM Studio to also match by meaning."],
               ["keyword", "Keywords only", "No extra model needed. Finds passages that share words with the question."]] as const).map(([k, t, d]) => (
              <button key={k} type="button" onClick={() => setMethod(k)} aria-pressed={method === k}
                className={cx("rounded-[var(--radius)] border p-3 text-left transition", method === k ? "border-accent bg-accent-soft" : "border-line hover:border-accent-line")}>
                <div className="flex items-center gap-2 text-[13px] font-semibold text-ink"><span className={cx("h-3.5 w-3.5 rounded-full border-2", method === k ? "border-accent bg-accent" : "border-line-strong")} />{t}</div>
                <div className="mt-1 text-[12px] text-ink-3">{d}</div>
              </button>
            ))}
          </div>
          {method === "hybrid" && (noModels ? (
            <Notice tone="warn">No embedding model found in LM Studio. In LM Studio, download and load <span className="font-mono">nomic-embed-text-v1.5</span> (small, ~140 MB), then reload this page — or choose “Keywords only”.</Notice>
          ) : (
            <Field label="Embedding model (LM Studio)" hint="Small models; they can stay loaded next to training.">
              <select className={inputCls} value={model} onChange={(e) => setModel(e.target.value)}>{em.data?.models.map((m) => <option key={m.id} value={m.id}>{m.id}{m.state ? ` · ${m.state}` : ""}</option>)}</select>
            </Field>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <Button tone="primary" icon="search" busy={act.busy} disabled={busy || (method === "hybrid" && (!model || !!noModels))}
              onClick={() => void act.run(async () => { await api.post(`/api/knowledge/${p.id}/steps/index`, { embedding_model: method === "hybrid" ? model : null }); await onChange(); })}>
              {p.steps.index === "completed" ? "Rebuild index" : "Build the index"}</Button>
            {s && p.steps.index === "completed" && <span className="text-[12px] text-ink-2">Ready: {s.passages} passages · {s.mode === "hybrid" ? `keywords + meaning (${s.model}, ${s.dim} numbers per passage)` : "keywords only"}</span>}
          </div>
          <ErrorLine error={act.error} />
        </div>
      </Panel>
      {p.steps.index === "completed" && <Playground p={p} />}
      {p.steps.index === "completed" && p.embedding && <EmbeddingMap key={`${p.hashes?.vectors}${p.hashes?.questions}`} pid={p.id} />}
    </>
  );
}

function Playground({ p }: { p: PackFull }) {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"hybrid" | "keyword" | "vector">(p.embedding ? "hybrid" : "keyword");
  const [res, setRes] = useState<{ mode: string; results: Hit[] } | null>(null);
  const act = useAction();
  const go = (e: FormEvent) => { e.preventDefault(); void act.run(async () => setRes(await api.post(`/api/knowledge/${p.id}/search`, { query: q, k: 5, mode }))); };
  return (
    <Panel title="Try the search" eyebrow="the exact tool the student will use" prov={<Prov kind="computed" source="live" />}>
      <form onSubmit={go} className="flex flex-wrap gap-2">
        <input className={cx(inputCls, "min-w-[240px] flex-1 font-sans text-[13px]")} placeholder="Ask anything your documents might answer…" value={q} onChange={(e) => setQ(e.target.value)} />
        {p.embedding && <Segmented label="Search mode" value={mode} onChange={setMode} options={[{ value: "hybrid", label: "both" }, { value: "keyword", label: "keywords" }, { value: "vector", label: "meaning" }]} />}
        <Button type="submit" tone="primary" icon="search" disabled={!q.trim()} busy={act.busy}>Search</Button>
      </form>
      <div className="mt-3"><ErrorLine error={act.error} /></div>
      {res && (
        <ol className="mt-3 space-y-2">
          {res.results.length === 0 && <li className="text-[12.5px] text-ink-3">No passage shares any words with that question. With “keywords + meaning” the meaning search would still try.</li>}
          {res.results.map((h, i) => (
            <li key={h.chunk_id} className="rounded-[var(--radius)] border border-line p-3">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="num font-mono text-[11px] text-ink-3">#{i + 1}</span><span className="text-[12.5px] font-semibold text-ink">{h.title}</span>
                <span className="font-mono text-[10.5px] text-ink-3">{h.chunk_id}</span>
                {h.keyword_rank && <Badge title={`BM25 score ${h.keyword_score}`}>keywords #{h.keyword_rank}</Badge>}
                {h.vector_rank && <Badge tone="accent" title={`cosine similarity ${h.similarity}`}>meaning #{h.vector_rank}</Badge>}
              </div>
              <div className="line-clamp-4 whitespace-pre-wrap text-[12px] leading-relaxed text-ink-2">{h.text}</div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ step 3 */
function StepQuestions({ p, busy, onChange }: { p: PackFull; busy: boolean; onChange: () => Promise<void> }) {
  const models = useApi<{ models: Model[] }>("/api/models");
  const teachers = (models.data?.models ?? []).filter((m) => m.eligibility.teacher.verdict !== "fail" && m.status === "available");
  const [teacher, setTeacher] = useState("");
  useEffect(() => { if (!teacher && teachers.length) setTeacher((teachers.find((m) => m.roles.includes("teacher")) ?? teachers[0]).id); }, [teachers, teacher]);
  const [n, setN] = useState(60);
  const [neg, setNeg] = useState(0.25);
  const act = useAction();
  const qdata = useApi<{ questions: QRow[]; rejected: Rejected[] }>(p.steps.questions === "completed" ? `/api/knowledge/${p.id}/questions` : null);
  const s = p.summary.questions as { accepted: number; rejected: number; split_unit: string; splits: Record<string, number>; answerable: number; unanswerable: number; retrievable_rate: number } | undefined;
  return (
    <>
      <Panel title="3 · Create practice questions" eyebrow={p.name} right={p.steps.questions && <Status s={p.steps.questions === "completed" ? "pass" : p.steps.questions === "stale" ? "warn" : p.steps.questions} label={p.steps.questions} />}>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Teacher (writes the questions)" hint="Must be loaded in LM Studio for this step.">
              <select className={inputCls} value={teacher} onChange={(e) => setTeacher(e.target.value)}>{teachers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
            </Field>
            <Field label={`How many questions · ${n}`} hint="More questions = better lessons, longer to write (≈ 10 s each with a 27B teacher).">
              <input type="range" min={20} max={300} step={10} value={n} onChange={(e) => setN(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
            </Field>
            <Field label={`Questions with no answer · ${Math.round(neg * 100)}%`} hint="Teaches the student to say NOT_FOUND instead of guessing.">
              <input type="range" min={0} max={0.5} step={0.05} value={neg} onChange={(e) => setNeg(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button tone="primary" icon="flask" busy={act.busy} disabled={busy || !teacher}
              onClick={() => void act.run(async () => { await api.post(`/api/knowledge/${p.id}/steps/questions`, { teacher_id: teacher, n, unanswerable: neg }); await onChange(); })}>
              {p.steps.questions === "completed" ? "Write a new set" : "Write practice questions"}</Button>
            {!teachers.length && <span className="text-[12px] text-ink-3">No teacher available — assign one in the Model Observatory.</span>}
          </div>
          {s && p.steps.questions === "completed" && (
            <div className="grid grid-cols-2 gap-4 border-t border-line pt-3 sm:grid-cols-5">
              <Readout label="accepted" value={s.accepted} size="sm" sub={`${s.answerable} answerable · ${s.unanswerable} not`} />
              <Readout label="rejected" value={s.rejected} size="sm" sub="failed a check" />
              <Readout label="practice (train)" value={s.splits.train} size="sm" />
              <Readout label="check-ins (dev)" value={s.splits.dev} size="sm" />
              <Readout label="final test" value={s.splits.test} size="sm" sub={`held out by ${s.split_unit}`} />
            </div>
          )}
          {s && s.retrievable_rate < 0.7 && p.steps.questions === "completed" && <Notice tone="warn">Search found the source passage for only {fmt.pct(s.retrievable_rate, 0)} of answerable questions. Consider “keywords + meaning” search, or smaller passages — the student can only be as good as what search finds.</Notice>}
          <ErrorLine error={act.error} />
        </div>
      </Panel>
      {qdata.data && <QuestionTable data={qdata.data} />}
      {p.steps.questions === "completed" && p.embedding && <EmbeddingMap key={`${p.hashes?.vectors}${p.hashes?.questions}`} pid={p.id} />}
    </>
  );
}

function QuestionTable({ data }: { data: { questions: QRow[]; rejected: Rejected[] } }) {
  const [tab, setTab] = useState<"accepted" | "rejected">("accepted");
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Panel flush title="Questions" prov={<Prov kind="computed" source="teacher-written · verified" />}>
      <div className="px-[var(--pad)]"><Tabs value={tab} onChange={setTab} tabs={[{ value: "accepted", label: "Accepted", count: data.questions.length }, { value: "rejected", label: "Rejected (and why)", count: data.rejected.length }]} /></div>
      {tab === "accepted" ? (
        <div className="scroll-thin max-h-[460px] overflow-auto">
          <table className="w-full text-[12px]"><thead className="sticky top-0 bg-surface-2"><tr><th className={th}>Question</th><th className={th}>Answer</th><th className={th}>Kind</th><th className={th}>Used for</th></tr></thead>
            <tbody>{data.questions.map((q) => (
              <Fragment key={q.task_id}>
                <tr onClick={() => setOpen(open === q.task_id ? null : q.task_id)} className={cx(tr, "cursor-pointer", open === q.task_id && "!bg-accent-soft")}>
                  <td className={cx(td, "max-w-[420px] text-ink")}>{q.prompt}</td>
                  <td className={cx(td, "font-mono text-[11px] text-ink-2")}>{q.reference_answer}</td>
                  <td className={td}><Badge tone={q.family === "doc_unanswerable" ? "warn" : "default"}>{q.family === "doc_unanswerable" ? "no answer" : "answerable"}</Badge></td>
                  <td className={cx(td, "text-[11.5px] text-ink-3")}>{{ train: "practice", dev: "check-in", test: "final test" }[q.split] ?? q.split}</td>
                </tr>
                {open === q.task_id && (
                  <tr className="border-t border-line bg-surface-2"><td colSpan={4} className="px-[var(--pad)] py-2.5 text-[12px] text-ink-2">
                    {q.gold_text ? <><div className="micro mb-1 text-ink-3">source passage {q.meta.gold_chunk} · {q.meta.retrievable ? "search finds it ✓" : "search did not find it with the question as written"}</div>
                      <div className="whitespace-pre-wrap leading-relaxed">{highlight(q.gold_text, q.reference_answer)}</div></>
                      : "Written from a passage on this topic, then checked: the teacher confirmed the top search results do not contain an answer."}
                  </td></tr>
                )}
              </Fragment>
            ))}</tbody></table>
        </div>
      ) : (
        <div className="scroll-thin max-h-[460px] overflow-auto">
          <table className="w-full text-[12px]"><thead className="sticky top-0 bg-surface-2"><tr><th className={th}>Candidate</th><th className={th}>Why it was rejected</th></tr></thead>
            <tbody>{data.rejected.map((r, i) => (
              <tr key={i} className={tr}><td className={cx(td, "max-w-[460px] text-ink-2")}>{String(r.candidate?.question ?? "—")}{r.candidate?.answer ? <span className="ml-2 font-mono text-[11px] text-ink-3">→ {String(r.candidate.answer)}</span> : null}</td>
                <td className={cx(td, "text-crit-ink")}>{r.reason}</td></tr>))}</tbody></table>
        </div>
      )}
    </Panel>
  );
}

function highlight(text: string, ans: string): ReactNode {
  const i = text.toLowerCase().indexOf(ans.toLowerCase().replace(/[.\s]+$/, ""));
  if (i < 0) return text;
  const len = ans.replace(/[.\s]+$/, "").length;
  return <>{text.slice(0, i)}<mark className="rounded bg-accent-soft px-0.5 text-ink">{text.slice(i, i + len)}</mark>{text.slice(i + len)}</>;
}

/* ------------------------------------------------------------------ step 4 */
function StepTeach({ p, studies, onCreated }: { p: PackFull; studies: StudyRow[]; onCreated: () => void }) {
  const { set } = usePrefs();
  const models = useApi<{ models: Model[] }>("/api/models");
  const all = models.data?.models ?? [];
  const students = all.filter((m) => m.capabilities.lora?.status === "supported" && m.eligibility.student.verdict !== "fail" && m.status === "available");
  const teachers = all.filter((m) => m.eligibility.teacher.verdict !== "fail" && m.status === "available");
  const [student, setStudent] = useState("");
  const [teacher, setTeacher] = useState("");
  const [profile, setProfile] = useState<"smoke" | "pilot" | "research">("pilot");
  const [focus, setFocus] = useState<"both" | "doc_answerable" | "doc_unanswerable">("both");
  const rd = useApi<Readiness>("/api/system/readiness");
  const cudaOk = rd.data?.checks.find((c) => c.id === "cuda")?.status === "pass";
  const device: "cuda" | "cpu" = cudaOk || !rd.data?.cpu_wiring_mode ? "cuda" : "cpu";
  useEffect(() => {
    if (!student && students.length) setStudent((students.find((m) => m.roles.includes("student")) ?? students[0]).id);
    if (!teacher && teachers.length) setTeacher((teachers.find((m) => m.roles.includes("teacher")) ?? teachers[0]).id);
  }, [students, teachers, student, teacher]);
  const act = useAction();
  const create = () => void act.run(async () => {
    const s = await api.post<StudySummary>("/api/studies", { name: `${profile} · ${p.name}${focus === "both" ? "" : focus === "doc_answerable" ? " · answering" : " · not-found"}`, profile, teacher_id: teacher, student_id: student, knowledge_pack_id: p.id, arms: ["teacher_filtered"], device, focus_skills: focus === "both" ? null : [focus] });
    set("activeStudy", s.id);
    onCreated();
    window.location.hash = "/studio";
  });
  const PROF = { smoke: "Quick check that everything works (minutes). Not enough to prove anything.", pilot: "A real first attempt: 3 training runs. Good for seeing whether it helps.", research: "6 training runs — strong enough for the review gate. Takes longest." };
  return (
    <Panel title="4 · Teach the student" eyebrow={p.name}>
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Student (the small model to train)" hint="Needs local safetensors weights — download one from the Hub tab in the Model Observatory.">
            <select className={inputCls} value={student} onChange={(e) => setStudent(e.target.value)}>{students.map((m) => <option key={m.id} value={m.id}>{m.name} · {fmt.params(m.parameter_count)}</option>)}</select>
          </Field>
          <Field label="Teacher (demonstrates the answers)">
            <select className={inputCls} value={teacher} onChange={(e) => setTeacher(e.target.value)}>{teachers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
          </Field>
        </div>
        <Field label="How thorough?"><Segmented label="Profile" value={profile} onChange={setProfile} options={[{ value: "smoke", label: "quick check" }, { value: "pilot", label: "pilot" }, { value: "research", label: "research" }]} /></Field>
        <div className="text-[12.5px] text-ink-2">{PROF[profile]}</div>
        <Field label="What should it get better at?" hint={focus === "both" ? "Trains on both kinds of question." : "Trains only on this kind of question. Both kinds are still tested, so you see the gain here and any side effect on the other."}>
          <Segmented label="Focus" value={focus} onChange={setFocus} options={[{ value: "both", label: "both" }, { value: "doc_answerable", label: "answering from documents" }, { value: "doc_unanswerable", label: "saying “not found”" }]} />
        </Field>
        {rd.data && (device === "cpu"
          ? <Notice tone="warn">No CUDA GPU is available to FORGE, and CPU wiring mode is on: this study will train on the CPU. That only checks the plumbing — its results are not meaningful.</Notice>
          : !cudaOk && <Notice tone="warn">FORGE cannot see a CUDA GPU right now (see Overview → Readiness). You can create the study, but training will refuse to start until the GPU is available.</Notice>)}
        <ol className="space-y-1.5 rounded-[var(--radius)] border border-line bg-surface-2 p-3 text-[12.5px] text-ink-2">
          <li><b className="text-ink">1. Collect</b> — the teacher answers every question using search (teacher loaded in LM Studio).</li>
          <li><b className="text-ink">2. Build</b> — only its verified answers become lessons.</li>
          <li><b className="text-ink">3. Train</b> — <span className="text-warn-ink">unload the teacher first</span> (one GPU), then the student learns.</li>
          <li><b className="text-ink">4. Evaluate</b> — the student is tested before and after, on documents it never practised on.</li>
        </ol>
        <div className="flex flex-wrap items-center gap-3">
          <Button tone="primary" icon="play" busy={act.busy} disabled={!student || !teacher} onClick={create}>Create the study and open Experiment Studio</Button>
          {!students.length && <span className="text-[12px] text-ink-3">No trainable student yet.</span>}
        </div>
        {studies.length > 0 && <div className="text-[12px] text-ink-3">Already created for this pack: {studies.map((s) => s.name).join(", ")}.</div>}
        <ErrorLine error={act.error} />
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ step 5 */
function StepResults({ studies }: { studies: StudyRow[] }) {
  const { set } = usePrefs();
  const [sid, setSid] = useState(studies[0]?.id ?? null);
  const s = useApi<StudySummary>(sid ? `/api/studies/${sid}` : null, 10000);
  const rep = s.data?.reports.test ?? s.data?.reports.dev;
  const split = s.data?.reports.test ? "test" : "dev";
  const arm = s.data?.plan.arms[0];
  const c = rep && arm ? rep.splits[split]?.arms[arm] : undefined;
  const go = (page: string) => { if (sid) set("activeStudy", sid); window.location.hash = `/${page}`; };
  return (
    <Panel title="5 · See what it learned">
      {!studies.length ? <Empty>Create a study in step 4 first.</Empty> : (
        <div className="space-y-4">
          <select className={cx(inputCls, "!w-auto font-sans")} value={sid ?? ""} onChange={(e) => setSid(e.target.value)} aria-label="Study">{studies.map((x) => <option key={x.id} value={x.id}>{x.name} · next: {x.next_stage ?? "done"}</option>)}</select>
          {!c ? <Notice>No results yet. In Experiment Studio, run the stages through <b>Analyze · dev</b> (and after SEAL, the test stages). Next stage: <span className="font-mono">{s.data?.next_stage ?? "—"}</span>.</Notice> : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Readout label={`before training · ${split}`} value={fmt.pct(c.control_rate, 0)} sub="base student" />
              <Readout label="after training" value={fmt.pct(c.arm_rate, 0)} tone="accent" sub="tuned student" />
              <Readout label="improvement" value={fmt.pp(c.mean, 0)} sub={`could be ${fmt.pp(c.ci_low, 0)} … ${fmt.pp(c.ci_high, 0)}`} />
              <Readout label="teacher (ceiling)" value={fmt.pct(rep!.splits[split].teacher_rate, 0)} />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button icon="studio" onClick={() => go("studio")}>Run the next stage</Button>
            <Button icon="evaluation" onClick={() => go("evaluation")}>Full statistics</Button>
            <Button icon="trajectory" onClick={() => go("trajectories")}>Watch individual answers</Button>
            <Button icon="graph" onClick={() => go("knowledge")}>Knowledge graph</Button>
          </div>
          <button type="button" onClick={() => go("guide")} className="text-[12px] text-accent underline-offset-2 hover:underline">New to this? Read the Guide →</button>
        </div>
      )}
    </Panel>
  );
}
