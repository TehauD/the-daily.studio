import { useMemo, useState, type FormEvent } from "react";
import { Icon } from "../components/icons";
import { JobLog } from "../components/live";
import { Badge, Button, CapCell, Checklist, Empty, ErrorLine, KV, Notice, PageHeader, Panel, Prov, Readout, Segmented, Status, Tabs, Toggle, cx, inputCls, td, th, tr } from "../components/ui";
import { api, fmt, qs } from "../lib/api";
import { useAction, useApi } from "../lib/hooks";
import { usePrefs } from "../lib/prefs";
import type { DiscoveryRun, Estimate, HubInspect, HubResult, Job, Model, Outbound, PairCheck } from "../lib/types";

interface ModelsResponse { capabilities: string[]; models: Model[] }
interface FitResponse { available: boolean; reason?: string; free_vram_mb: number | null; seq_len: number; estimates: Record<string, Estimate> }
const KIND_TONE: Record<string, "default" | "warn"> = { generative: "default" };

export default function Observatory() {
  const [tab, setTab] = useState<"local" | "hub" | "pair">("local");
  const models = useApi<ModelsResponse>("/api/models");
  const n = models.data?.models.length;
  return (
    <div className="space-y-4 fit:flex fit:h-full fit:min-h-0 fit:flex-col fit:gap-3 fit:space-y-0">
      <PageHeader kicker="Operate" title="Model Observatory" subtitle="Every model on this machine, measured from file headers — never by loading weights. Loading is not trainability: only complete local safetensors with a known causal-LM architecture can be students." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "local", label: "Local inventory", count: n }, { value: "hub", label: "Hugging Face Hub" }, { value: "pair", label: "Pair builder" }]} />
      {tab === "local" && <Local models={models} />}
      {tab === "hub" && <Hub />}
      {tab === "pair" && <PairBuilder models={models.data?.models ?? []} />}
    </div>
  );
}

function Local({ models }: { models: ReturnType<typeof useApi<ModelsResponse>> }) {
  const { prefs, set } = usePrefs();
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [run, setRun] = useState<DiscoveryRun | null>(null);
  const act = useAction();
  const all = models.data?.models ?? [];
  const list = useMemo(() => all.filter((m) => (prefs.showIneligible || ["generative", "unknown"].includes(m.eligibility.kind))
    && `${m.name} ${m.provider} ${m.architecture ?? ""} ${m.quantization ?? ""}`.toLowerCase().includes(filter.toLowerCase())), [all, filter, prefs.showIneligible]);
  const hidden = all.length - all.filter((m) => ["generative", "unknown"].includes(m.eligibility.kind)).length;
  const missing = all.filter((m) => m.status === "missing").length;
  const caps = models.data?.capabilities ?? [];
  const sel = all.find((m) => m.id === selected) ?? null;
  return (
    <div className="space-y-3 fit:flex fit:min-h-0 fit:flex-1 fit:flex-col fit:gap-3 fit:space-y-0">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Icon name="search" size={14} className="absolute left-2.5 top-2 text-ink-3" />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter name, arch, quant…" className={cx(inputCls, "pl-8")} aria-label="Filter models" />
        </div>
        <Toggle checked={prefs.showIneligible} onChange={(v) => set("showIneligible", v)} label={`Show non-generative (${hidden})`} />
        <div className="ml-auto flex gap-2">
          {missing > 0 && <Button tone="danger" icon="x" busy={act.busy} onClick={() => void act.run(async () => { await api.post("/api/models/purge-missing"); await models.reload(); })}>Purge {missing} missing</Button>}
          <Button tone="primary" icon="refresh" busy={act.busy} onClick={() => void act.run(async () => { setRun(await api.post<DiscoveryRun>("/api/models/discover")); await models.reload(); })}>Run discovery</Button>
        </div>
      </div>
      <ErrorLine error={act.error ?? models.error} />
      {run?.providers && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(run.providers).map(([p, r]) => (
            <span key={p} title={r.detail ?? ""}><Badge tone={r.status === "ok" ? "good" : r.status === "error" ? "crit" : "default"}>{p} · {r.status} · {r.models}{r.marked_missing ? ` · ${r.marked_missing} missing` : ""} · {r.duration_ms}ms</Badge></span>
          ))}
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_440px] fit:min-h-0 fit:flex-1 fit:gap-3 3xl:fit:grid-cols-[minmax(0,1fr)_520px]">
        <Panel fill flush title={`${list.length} models`} prov={<Prov kind="measured" source="file headers / provider APIs" />}
          right={<span className="hidden font-mono text-[10px] text-ink-3 md:inline">● supported ◐ conditional ○ unsupported ? unknown · T/S = teacher/student eligibility</span>}>
          {list.length === 0 ? <Empty icon="observatory">No models. Run discovery, or add a model directory in System Settings.</Empty> : (
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead><tr className="bg-surface-2"><th className={th}>Model</th><th className={th}>Provider</th><th className={cx(th, "text-right")}>Params</th><th className={th}>Quant</th><th className={cx(th, "text-right")}>Ctx</th><th className={th}>T / S</th>
                  {caps.map((c) => <th key={c} className={cx(th, "text-center")} title={c}>{c.replace("_", " ").replace("ollama deploy", "ollama").replace("tool calling", "tools").replace("gguf export", "gguf")}</th>)}</tr></thead>
                <tbody>
                  {list.map((m) => (
                    <tr key={m.id} onClick={() => setSelected(m.id)} className={cx(tr, "cursor-pointer", selected === m.id && "!bg-accent-soft")}>
                      <td className={cx(td, "max-w-[280px]")}>
                        <div className="truncate font-medium text-ink" title={m.name}>{m.name}</div>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {m.status !== "available" && <Badge tone={m.status === "missing" ? "crit" : "warn"}>{m.status.replace("_", " ")}</Badge>}
                          {m.eligibility.kind !== "generative" && <Badge tone={KIND_TONE[m.eligibility.kind] ?? "warn"}>{m.eligibility.kind}</Badge>}
                          {m.roles.map((r) => <Badge key={r} tone={r === "teacher" ? "teacher" : "tuned"}>{r}</Badge>)}
                          {m.metadata.lmstudio_state === "loaded" && <Badge tone="accent">loaded</Badge>}
                        </div>
                      </td>
                      <td className={cx(td, "font-mono text-[11px] text-ink-2")}>{m.provider}</td>
                      <td className={cx(td, "num text-right font-mono text-[11.5px]")} title={m.parameter_count_source}>{fmt.params(m.parameter_count)}{m.parameter_count_source === "config_estimate" && <span className="text-warn-ink">~</span>}</td>
                      <td className={cx(td, "font-mono text-[11px] text-ink-2")}>{m.quantization ?? "—"}</td>
                      <td className={cx(td, "num text-right font-mono text-[11px] text-ink-2")}>{fmt.ctx(m.context_length)}</td>
                      <td className={td}><span className="inline-flex gap-1.5"><Status s={m.eligibility.teacher.verdict} compact /><Status s={m.eligibility.student.verdict} compact /></span></td>
                      {caps.map((c) => <td key={c} className={cx(td, "text-center")}>{m.capabilities[c] && <CapCell {...m.capabilities[c]} />}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <div className="min-w-0 xl:sticky xl:top-16 xl:self-start fit:static fit:flex fit:min-h-0 fit:flex-col">
          {sel ? <ModelDetail key={sel.id} m={sel} onChange={models.reload} /> : <Panel fill title="Model detail"><Empty icon="observatory">Select a model to see its parameter reconciliation, eligibility, capability reasons, and VRAM fit.</Empty></Panel>}
        </div>
      </div>
    </div>
  );
}

function ParamBars({ m }: { m: Model }) {
  const r = m.metadata.parameter_report;
  if (!r || !r.stored_total) return <div className="text-[11.5px] text-ink-3">No header-level breakdown available for this format.</div>;
  const rows = [
    { k: "stored in files", v: r.stored_total, note: "sum of tensor shapes in headers" },
    ...(r.unique_total != null ? [{ k: "unique", v: r.unique_total, note: r.lm_head_is_duplicate_of_tied_embedding ? "tied lm_head counted once" : "" }] : []),
    { k: "embedding", v: r.embedding ?? 0, note: "" },
    ...(r.lm_head_stored ? [{ k: "lm_head stored", v: r.lm_head_stored, note: r.tie_word_embeddings ? "duplicate of tied embedding" : "untied" }] : []),
    { k: "non-embedding", v: r.non_embedding ?? 0, note: "model-card convention" },
  ];
  const max = r.stored_total;
  return (
    <div className="space-y-1.5">
      {rows.map((x) => (
        <div key={x.k} className="grid grid-cols-[110px_1fr_auto] items-center gap-2">
          <span className="font-mono text-[10.5px] text-ink-3">{x.k}</span>
          <span className="h-[6px] rounded-full bg-surface-3"><span className="block h-full rounded-full bg-[color:var(--seq-2)]" style={{ width: `${(x.v / max) * 100}%` }} /></span>
          <span className="num font-mono text-[11px] text-ink" title={x.note}>{fmt.exact(x.v)}</span>
        </div>
      ))}
      {r.note && <div className="pt-1 text-[11px] leading-snug text-ink-3">{r.note}</div>}
    </div>
  );
}

function ModelDetail({ m, onChange }: { m: Model; onChange: () => Promise<void> }) {
  const { set } = usePrefs();
  const trainable = m.capabilities.lora?.status === "supported";
  const fit = useApi<FitResponse>(trainable ? `/api/models/${m.id}/fit` : null);
  const act = useAction();
  const [view, setView] = useState<"student" | "teacher">(trainable ? "student" : "teacher");
  const toggle = (role: "teacher" | "student") => act.run(async () => {
    if (m.roles.includes(role)) await api.del(`/api/models/${m.id}/roles/${role}`);
    else await api.put(`/api/models/${m.id}/roles`, { role });
    await onChange();
  });
  return (
    <Panel fill title="Model detail" prov={<Prov kind="measured" source={m.parameter_count_source} />}>
      <div className="space-y-4">
        <div>
          <div className="break-all text-[14px] font-semibold text-ink">{m.name}</div>
          <button type="button" className="mt-0.5 text-[11.5px] text-accent underline-offset-2 hover:underline" onClick={() => { set("activeModel", m.id); window.location.hash = "/model"; }}>Open in Model Hub →</button>
          <div className="mt-0.5 break-all font-mono text-[10.5px] text-ink-3">{m.locator}</div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Readout label="params" value={fmt.params(m.parameter_count)} size="sm" />
          <Readout label="context" value={fmt.ctx(m.context_length)} size="sm" />
          <Readout label="on disk" value={fmt.bytes(m.size_bytes)} size="sm" />
        </div>
        <div>
          <div className="micro mb-2 text-ink-3">Parameter reconciliation</div>
          <ParamBars m={m} />
        </div>
        <KV rows={[["arch", m.architecture ?? "—"], ["kind", `${m.eligibility.kind}`], ["format", m.format], ["quant", m.quantization ?? "—"],
          ["license", m.license ?? <span className="text-warn-ink">not declared — verify before fine-tuning</span>], ["path", m.storage_path ?? "—"]]} />
        <div>
          <div className="mb-2 flex items-center justify-between"><span className="micro text-ink-3">Role eligibility</span>
            <Segmented label="Role" value={view} onChange={setView} options={[{ value: "teacher", label: "Teacher" }, { value: "student", label: "Student" }]} /></div>
          <Checklist items={m.eligibility[view].checks} />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button icon={m.roles.includes("teacher") ? "x" : "plus"} disabled={m.eligibility.teacher.verdict === "fail" && !m.roles.includes("teacher")} onClick={() => void toggle("teacher")}>{m.roles.includes("teacher") ? "Unset teacher" : "Set as teacher"}</Button>
            <Button icon={m.roles.includes("student") ? "x" : "plus"} disabled={m.eligibility.student.verdict === "fail" && !m.roles.includes("student")} onClick={() => void toggle("student")}>{m.roles.includes("student") ? "Unset student" : "Set as student"}</Button>
          </div>
          <div className="mt-2"><ErrorLine error={act.error} /></div>
        </div>
        <div>
          <div className="micro mb-2 text-ink-3">Capabilities</div>
          <ul className="space-y-1">
            {Object.entries(m.capabilities).map(([k, c]) => (
              <li key={k} className="grid grid-cols-[16px_92px_1fr] gap-2 text-[11.5px]"><CapCell {...c} /><span className="font-mono text-ink">{k}</span><span className="text-ink-3">{c.reason}</span></li>
            ))}
          </ul>
        </div>
        {trainable && (
          <div>
            <div className="mb-2 flex items-center gap-2"><span className="micro text-ink-3">VRAM fit · seq {fit.data?.seq_len ?? 2048}</span><Prov kind="estimate" source="analytic ±25%" /></div>
            {fit.data?.available === false && <div className="text-[11.5px] text-ink-3">{fit.data.reason}</div>}
            {fit.data?.available && Object.entries(fit.data.estimates).map(([method, e]) => (
              <div key={method} className="flex items-center justify-between border-t border-line py-1.5 text-[12px]">
                <span className="font-mono uppercase text-ink-2">{method}{method === "qlora" && <span className="ml-1 normal-case text-ink-3">(post-MVP)</span>}</span>
                <span className="flex items-center gap-3"><span className="num font-mono text-ink">{e.total_mb ? fmt.mb(e.total_mb) : ""}</span>
                  <Status s={{ safe: "pass", tight: "warn", unsafe: "fail" }[e.verdict as string] ?? "unknown"} label={e.verdict.replace("_", " ")} /></span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------- Hub */
function OutboundNote({ o }: { o: Outbound | null }) {
  return (
    <Notice icon="external" tone="warn">
      <b className="font-medium text-ink">Outbound network call.</b> The Hub is FORGE's only deliberate network path.
      {o ? <> Last call: <span className="font-mono">{o.host} · {o.endpoint}</span>.</> : " Your search text is sent to huggingface.co."} Studies themselves run offline (HF_HUB_OFFLINE=1).
    </Notice>
  );
}

function Hub() {
  const [q, setQ] = useState("Qwen3");
  const [results, setResults] = useState<HubResult[] | null>(null);
  const [outbound, setOutbound] = useState<Outbound | null>(null);
  const [insp, setInsp] = useState<HubInspect | null>(null);
  const [job, setJob] = useState<string | null>(null);
  const search = useAction(), inspect = useAction(), dl = useAction();
  const submit = (e: FormEvent) => { e.preventDefault(); void search.run(async () => { const r = await api.get<{ results: HubResult[]; outbound: Outbound }>(`/api/hub/search${qs({ q })}`); setResults(r.results); setOutbound(r.outbound); }); };
  return (
    <div className="space-y-3 fit:flex fit:min-h-0 fit:flex-1 fit:flex-col fit:gap-3 fit:space-y-0">
      <OutboundNote o={outbound} />
      <form onSubmit={submit} className="flex flex-wrap gap-2">
        <input className={cx(inputCls, "max-w-md")} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search text-generation models (safetensors)…" aria-label="Hub search" />
        <Button type="submit" tone="primary" icon="search" busy={search.busy}>Search Hub</Button>
      </form>
      <ErrorLine error={search.error} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_460px] fit:min-h-0 fit:flex-1 fit:gap-3 3xl:fit:grid-cols-[minmax(0,1fr)_560px]">
        <Panel fill flush title={results ? `${results.length} results` : "Results"} prov={<Prov kind="declared" source="Hub API" />}>
          {!results ? <Empty icon="search">Search the Hub. Results show the Hub-reported safetensors parameter total; inspect a repo for exact headers and eligibility.</Empty> : (
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead><tr className="bg-surface-2"><th className={th}>Repository</th><th className={cx(th, "text-right")}>Params</th><th className={cx(th, "text-right")}>Downloads</th><th className={th}>License</th><th className={th}></th></tr></thead>
                <tbody>{results.map((r) => (
                  <tr key={r.id} className={cx(tr, insp?.repo_id === r.id && "!bg-accent-soft")}>
                    <td className={cx(td, "font-medium text-ink")}>{r.id}{r.gated ? <Badge tone="warn">gated</Badge> : null}</td>
                    <td className={cx(td, "num text-right font-mono text-[11.5px]")}>{fmt.params(r.parameters)}</td>
                    <td className={cx(td, "num text-right font-mono text-[11.5px] text-ink-2")}>{fmt.exact(r.downloads)}</td>
                    <td className={cx(td, "font-mono text-[11px] text-ink-2")}>{r.tags.find((t) => t.startsWith("license:"))?.slice(8) ?? "—"}</td>
                    <td className={cx(td, "text-right")}><Button size="sm" busy={inspect.busy && insp?.repo_id !== r.id} onClick={() => void inspect.run(async () => { setInsp(null); setInsp(await api.get<HubInspect>(`/api/hub/inspect${qs({ repo: r.id })}`)); })}>Inspect</Button></td>
                  </tr>))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <div className="scroll-thin space-y-3 fit:min-h-0 fit:overflow-auto fit:pr-1">
          <ErrorLine error={inspect.error ?? dl.error} />
          {insp ? (
            <Panel title={insp.repo_id} prov={<Prov kind="measured" source="remote safetensors headers" />} right={<Status s={insp.verdict} label={insp.verdict === "pass" ? "eligible" : "not eligible"} />}>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <Readout label="exact params" value={fmt.params(insp.parameters.total)} size="sm" sub={insp.parameters.total ? fmt.exact(insp.parameters.total) : insp.parameters.error} />
                  <Readout label="download" value={fmt.bytes(insp.download_bytes)} size="sm" sub={`${insp.weight_files.length} shard(s)`} />
                  <Readout label="context" value={fmt.ctx(insp.context_length)} size="sm" />
                </div>
                <KV rows={[["arch", insp.architecture ?? "—"], ["layers × hidden", `${insp.num_hidden_layers ?? "—"} × ${insp.hidden_size ?? "—"}`],
                  ["heads / kv / dim", `${insp.num_attention_heads ?? "—"} / ${insp.num_key_value_heads ?? "—"} / ${insp.head_dim ?? "—"}`],
                  ["vocab", fmt.exact(insp.vocab_size)], ["tied embeddings", String(insp.tie_word_embeddings ?? "—")], ["revision", insp.revision?.slice(0, 12) ?? "—"]]} />
                <Checklist items={insp.checks} />
                <Button tone="primary" icon="download" disabled={insp.verdict === "fail"} busy={dl.busy}
                  onClick={() => void dl.run(async () => setJob((await api.post<Job>("/api/hub/download", { repo: insp.repo_id, revision: insp.revision })).id))}>
                  Download & verify shards
                </Button>
                <div className="text-[11px] text-ink-3">Uses snapshot_download with allow-patterns (safetensors, configs, tokenizer) and then checks every shard in the index. Pickle weights are never fetched.</div>
              </div>
            </Panel>
          ) : <Panel title="Pre-download inspection"><Empty icon="file">Inspection reads config.json, tokenizer_config.json, README.md, the safetensors index, and remote headers — never weights.</Empty></Panel>}
          {job && <Panel title="Download" eyebrow="job"><JobLog jobId={job} height={160} /><div className="mt-2 text-[11.5px] text-ink-3">When it completes, run discovery on the Local tab; the snapshot appears under huggingface_cache.</div></Panel>}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Pair builder */
function PairBuilder({ models }: { models: Model[] }) {
  const teachers = models.filter((m) => m.eligibility.teacher.verdict !== "fail" && m.status === "available");
  const students = models.filter((m) => m.eligibility.student.verdict !== "fail" && m.status === "available");
  const [t, setT] = useState(models.find((m) => m.roles.includes("teacher"))?.id ?? "");
  const [s, setS] = useState(models.find((m) => m.roles.includes("student"))?.id ?? "");
  const [pc, setPc] = useState<PairCheck | null>(null);
  const act = useAction();
  return (
    <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)] fit:min-h-0 fit:flex-1 fit:gap-3">
      <Panel fill title="Select pair">
        <div className="space-y-3">
          <label className="block"><span className="micro mb-1 block text-ink-3">Teacher</span>
            <select className={inputCls} value={t} onChange={(e) => setT(e.target.value)}><option value="">—</option>{teachers.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.provider}</option>)}</select></label>
          <label className="block"><span className="micro mb-1 block text-ink-3">Student</span>
            <select className={inputCls} value={s} onChange={(e) => setS(e.target.value)}><option value="">—</option>{students.map((m) => <option key={m.id} value={m.id}>{m.name} · {fmt.params(m.parameter_count)}</option>)}</select></label>
          <Button tone="primary" icon="link" disabled={!t || !s} busy={act.busy} onClick={() => void act.run(async () => setPc(await api.get<PairCheck>(`/api/models/pair-check${qs({ teacher: t, student: s })}`)))}>Run pair-check</Button>
          <ErrorLine error={act.error} />
          {students.length === 0 && <Notice tone="warn">No eligible student. Download one from the Hub tab (e.g. a ≤ 3B instruct model in safetensors), then run discovery.</Notice>}
        </div>
      </Panel>
      {pc ? (
        <Panel fill title={`${pc.teacher}  →  ${pc.student}`} prov={<Prov kind="computed" />} right={<Status s={pc.verdict} />}>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <Checklist items={pc.checks} />
            <div className="space-y-4">
              <Readout label="capacity ratio" value={pc.capacity_ratio ? pc.capacity_ratio.toFixed(1) : "—"} unit="×" sub="teacher ÷ student unique params" />
              <div><div className="micro mb-1 text-ink-3">Distillation modes</div><div className="flex gap-1.5">{pc.distillation_modes.map((x) => <Badge key={x} tone="accent">{x}</Badge>)}</div></div>
              {pc.vram_estimate && <Readout label="student LoRA peak (bf16, 2048)" value={fmt.mb(pc.vram_estimate.total_mb)} sub={<Prov kind="estimate" source="analytic ±25%" />} size="sm" />}
              <Button tone="primary" icon="flask" disabled={pc.verdict === "fail"} onClick={() => { sessionStorage.setItem("forge.pair", JSON.stringify({ teacher: pc.teacher_id, student: pc.student_id })); window.location.hash = "/studio"; }}>Create study with this pair</Button>
            </div>
          </div>
        </Panel>
      ) : <Panel fill title="Pair-check"><Empty icon="link">Pick a teacher and a student. The check covers generativity, trainability, capacity, tool templates, VRAM, logit-KD eligibility, and the one-GPU constraint.</Empty></Panel>}
    </div>
  );
}
