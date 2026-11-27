import { TurboPicker, type TurboT } from "../components/Turbo";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Icon } from "../components/icons";
import { JobLog, useStudies } from "../components/live";
import { Badge, Button, Empty, ErrorLine, Field, Hash, KV, Notice, PageHeader, Panel, Prov, Segmented, Status, cx, inputCls, td, th, tr } from "../components/ui";
import { api, fmt } from "../lib/api";
import { useAction, useApi } from "../lib/hooks";
import { usePrefs } from "../lib/prefs";
import type { Job, Model, Readiness, StudySummary } from "../lib/types";

interface Catalog { profiles: Record<string, { seeds: number[]; purpose: string; train: Record<string, unknown>; taskset: Record<string, unknown> }>; arms: Record<string, { data: string; train: Record<string, unknown> }>; stages: string[]; gpu_stages: string[]; mvp_arms: string[]; skills: Record<string, { id: string; label: string }[]> }

const STAGE_LABEL: Record<string, string> = { init: "Init", collect: "Collect", build: "Build", train: "Train", evaluate_dev: "Eval · dev", analyze_dev: "Analyze · dev",
  seal: "Seal", evaluate_test: "Eval · test", analyze_test: "Analyze · test", export: "Export" };
const STAGE_HINT: Record<string, string> = {
  collect: "Teacher runs every task (all splits) through the JSON tool protocol. Oracle trajectories are generated for eligibility.",
  build: "Strict teacher successes on train become per-turn prompt/completion records. Arms share eligible task ids.",
  train: "LoRA per arm × seed. Pre-flight gates; the teacher must be unloaded from the GPU first.",
  evaluate_dev: "Base and tuned students on identical dev tasks, greedy decoding.",
  analyze_dev: "Paired dev statistics for decisions before sealing.",
  seal: "Freezes adapters by sha256. After this, no further training is permitted.",
  evaluate_test: "Base and tuned on test, OOD wording, and regression split.",
  analyze_test: "Confirmatory statistics and the review gate.",
  export: "Merged bf16 copy (new directory) with mandatory post-merge re-evaluation.",
};

export default function Studio() {
  const { prefs, set } = usePrefs();
  const studies = useStudies();
  const [creating, setCreating] = useState(false);
  useEffect(() => { if (sessionStorage.getItem("forge.pair")) setCreating(true); }, []);
  const sid = prefs.activeStudy;
  return (
    <div className={creating ? "space-y-4" : "space-y-4 fit:flex fit:h-full fit:min-h-0 fit:flex-col fit:gap-3 fit:space-y-0"}>
      <PageHeader kicker="Build" title="Experiment Studio" subtitle="A study freezes the pair, profile, seeds, arms, task set, hyperparameters, base-model hash, and engine source hash at creation. Stages run as separate processes, one GPU job at a time."
        right={<Button tone="primary" icon="plus" onClick={() => setCreating((c) => !c)}>{creating ? "Close wizard" : "New study"}</Button>} />
      {creating && <Wizard onCreated={(id) => { set("activeStudy", id); setCreating(false); void studies.reload(); }} />}
      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)] fit:min-h-0 fit:flex-1 fit:gap-3">
        <Panel fill flush title="Studies" right={<span className="num font-mono text-[10.5px] text-ink-3">{studies.data?.length ?? 0}</span>}>
          {!studies.data?.length ? <Empty icon="flask">No studies yet. Create one to start the MVP loop.</Empty> : (
            <ul className="divide-y divide-line">
              {studies.data.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => set("activeStudy", s.id)} className={cx("w-full px-[var(--pad)] py-2.5 text-left transition hover:bg-surface-2", sid === s.id && "bg-accent-soft")}>
                    <div className="flex items-center justify-between gap-2"><span className="truncate text-[12.5px] font-medium text-ink">{s.name}</span><Badge>{s.profile}</Badge></div>
                    <div className="mt-0.5 truncate font-mono text-[10.5px] text-ink-3">{s.teacher} → {s.student}</div>
                    <div className="mt-1 flex items-center gap-2 font-mono text-[10.5px] text-ink-3">{s.sealed && <span className="text-accent">● sealed</span>}<span>next: {s.next_stage ?? "done"}</span></div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        {sid ? <StudyView key={sid} sid={sid} /> : <Panel><Empty icon="studio">Select or create a study.</Empty></Panel>}
      </div>
    </div>
  );
}

function Wizard({ onCreated }: { onCreated: (id: string) => void }) {
  const models = useApi<{ models: Model[] }>("/api/models");
  const cat = useApi<Catalog>("/api/studies/catalog");
  const rd = useApi<Readiness>("/api/system/readiness");
  const pre = (() => { try { return JSON.parse(sessionStorage.getItem("forge.pair") || "null") as { teacher: string; student: string } | null; } catch { return null; } })();
  const ms = models.data?.models ?? [];
  const [f, setF] = useState({ name: "", profile: "smoke", teacher_id: pre?.teacher ?? "", student_id: pre?.student ?? "", arms: ["teacher_filtered"], min_gain: 0.05, max_steps: "", epochs: "", max_seq_len: "", device: "cuda", focus_skills: [] as string[] });
  const [turbo, setTurbo] = useState<TurboT | null>(null);
  useEffect(() => {
    if (!f.teacher_id && ms.length) setF((x) => ({ ...x, teacher_id: ms.find((m) => m.roles.includes("teacher"))?.id ?? "", student_id: x.student_id || (ms.find((m) => m.roles.includes("student"))?.id ?? "") }));
  }, [ms, f.teacher_id]);
  const act = useAction();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void act.run(async () => {
      const body = { ...f, max_steps: f.max_steps ? Number(f.max_steps) : null, epochs: f.epochs ? Number(f.epochs) : null, max_seq_len: f.max_seq_len ? Number(f.max_seq_len) : null, focus_skills: f.focus_skills.length ? f.focus_skills : null, turbo: turbo ?? undefined, name: f.name || `${f.profile}-${new Date().toISOString().slice(5, 16).replace("T", "-")}` };
      const s = await api.post<StudySummary>("/api/studies", body);
      sessionStorage.removeItem("forge.pair");
      onCreated(s.id);
    });
  };
  const prof = cat.data?.profiles[f.profile];
  const teachers = ms.filter((m) => m.eligibility.teacher.verdict !== "fail" && m.status === "available");
  const students = ms.filter((m) => m.capabilities.lora?.status === "supported" && m.eligibility.student.verdict !== "fail" && m.status === "available");
  return (
    <Panel title="New study" eyebrow="wizard" prov={<Prov kind="declared" source="frozen on create" />}>
      <form onSubmit={submit} className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-3">
          <Field label="Name"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. qwen3-1.7b · catalog tools" /></Field>
          <Field label="Teacher"><select className={inputCls} value={f.teacher_id} onChange={(e) => setF({ ...f, teacher_id: e.target.value })}><option value="">—</option>{teachers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
          <Field label="Student" hint="Local safetensors with supported LoRA only."><select className={inputCls} value={f.student_id} onChange={(e) => setF({ ...f, student_id: e.target.value })}><option value="">—</option>{students.map((m) => <option key={m.id} value={m.id}>{m.name} · {fmt.params(m.parameter_count)}</option>)}</select></Field>
          {(() => { const st = students.find((m) => m.id === f.student_id); const big = (st?.parameter_count ?? 0) > 4e9;
            return big && f.device === "cuda" && !turbo?.quant_4bit ? (
              <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-[color:var(--warn)]/50 bg-[color:var(--warn)]/[0.07] px-2.5 py-2 text-[12px] text-ink-2">
                <span>{st?.name} has {fmt.params(st?.parameter_count)} parameters: training it in bf16 needs more than a 16 GB GPU has (about 21 GB for a 7B model). Use the <b>4-bit base (QLoRA)</b> — evaluation and the Playground then load it in 4-bit too.</span>
                <Button size="sm" onClick={() => setTurbo({ attention: "sdpa", packing: false, liger: false, optim_8bit: false, checkpointing: "on", compile: false, ...(turbo ?? {}), quant_4bit: true })}>Use 4-bit base</Button>
              </div>) : null; })()}
        </div>
        <div className="space-y-3">
          <Field label="Profile">
            <Segmented label="Profile" value={f.profile} onChange={(v) => setF({ ...f, profile: v })} options={["smoke", "pilot", "research"].map((p) => ({ value: p, label: p }))} />
          </Field>
          {prof && <div className="rounded-[var(--radius)] border border-line bg-surface-2 p-2.5 text-[11.5px] leading-relaxed text-ink-2"><b className="font-medium text-ink">{prof.seeds.length} seed{prof.seeds.length > 1 ? "s" : ""}</b> · {prof.purpose}<div className="mt-1 font-mono text-[10.5px] text-ink-3">train {JSON.stringify(prof.train)} · tasks {JSON.stringify(prof.taskset)}</div></div>}
          <Field label="Arms" hint="First arm is the preregistered primary contrast vs base. Additional arms are ablations (one factor each).">
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(cat.data?.arms ?? {}).map((a) => {
                const on = f.arms.includes(a);
                return <button key={a} type="button" onClick={() => setF({ ...f, arms: on ? f.arms.filter((x) => x !== a) : [...f.arms, a] })} aria-pressed={on}
                  className={cx("rounded-[3px] border px-2 py-1 font-mono text-[11px] transition", on ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-3 hover:text-ink")}>{a}{cat.data?.mvp_arms.includes(a) ? "" : " ·ablation"}</button>;
              })}
            </div>
          </Field>
          <Field label="Focus skills (optional)" hint={f.focus_skills.length ? "Training uses only these skills. Every skill is still evaluated, so you see the gain on the focus and any spill-over or regression elsewhere. The focus-skill gain becomes the preregistered primary result." : "None selected: train on every skill."}>
            <div className="flex flex-wrap gap-1.5">
              {(cat.data?.skills?.catalog ?? []).map((k) => {
                const on = f.focus_skills.includes(k.id);
                return <button key={k.id} type="button" aria-pressed={on} onClick={() => setF({ ...f, focus_skills: on ? f.focus_skills.filter((x) => x !== k.id) : [...f.focus_skills, k.id] })}
                  className={cx("rounded-[3px] border px-2 py-1 text-[11.5px] transition", on ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-3 hover:text-ink")}>{k.label}</button>;
              })}
            </div>
          </Field>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Min gain (prereg.)"><input className={inputCls} type="number" step="0.01" min="0" max="1" value={f.min_gain} onChange={(e) => setF({ ...f, min_gain: Number(e.target.value) })} /></Field>
            <Field label="Max steps"><input className={inputCls} type="number" min="1" placeholder="profile" value={f.max_steps} onChange={(e) => setF({ ...f, max_steps: e.target.value })} /></Field>
            <Field label="Epochs"><input className={inputCls} type="number" step="0.5" placeholder="profile" value={f.epochs} onChange={(e) => setF({ ...f, epochs: e.target.value })} /></Field>
            <Field label="Max seq len"><input className={inputCls} type="number" step="256" placeholder="2048" value={f.max_seq_len} onChange={(e) => setF({ ...f, max_seq_len: e.target.value })} /></Field>
          </div>
          {rd.data?.cpu_wiring_mode && <Field label="Device"><Segmented label="Device" value={f.device} onChange={(v) => setF({ ...f, device: v })} options={[{ value: "cuda", label: "cuda" }, { value: "cpu", label: "cpu (wiring only)" }]} /></Field>}
          <details className="rounded-[var(--radius)] border border-line p-2.5"><summary className="cursor-pointer text-[12px] text-ink">Training engine — FORGE Turbo {turbo ? "(custom)" : "(standard)"}</summary>
            <div className="mt-2"><TurboPicker value={turbo ?? { attention: "sdpa", packing: false, liger: false, quant_4bit: false, optim_8bit: false, checkpointing: "on", compile: false }} onChange={setTurbo} device={f.device} /></div></details>
          <div className="text-[11.5px] leading-relaxed text-ink-3">LoRA r=16, α=32, all linear, LR 2e-4 cosine, 3% warmup, micro-batch 1 × accum 8, bf16, gradient checkpointing, thinking disabled.</div>
          <Button type="submit" tone="primary" icon="seal" busy={act.busy} disabled={!f.teacher_id || !f.student_id || !f.arms.length}>Freeze plan & create</Button>
          <ErrorLine error={act.error} />
        </div>
      </form>
    </Panel>
  );
}

function StageStepper({ s, onRun, blocked, busyStage }: { s: StudySummary; onRun: (stage: string) => void; blocked: Record<string, string[]>; busyStage: string | null }) {
  const stages = Object.keys(STAGE_LABEL);
  const st = s.state.stages;
  return (
    <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-5 2xl:grid-cols-10">
      {stages.map((k, i) => {
        const status: string = st[k]?.status ?? (k === s.next_stage ? "ready" : "pending");
        const isNext = k === s.next_stage;
        const gpu = s.gpu_stages.includes(k) || k === "collect";
        const blk = blocked[k];
        return (
          <li key={k} className={cx("relative flex flex-col rounded-[var(--radius)] border p-2 transition",
            status === "completed" ? "border-[color:var(--good)]/35 bg-[color:var(--good)]/[0.04]" : status === "failed" ? "border-[color:var(--crit)]/40" :
            status === "running" ? "border-accent bg-accent-soft" : isNext ? "border-accent-line" : "border-line bg-surface-2/60")}>
            <div className="flex items-center justify-between"><span className="num font-mono text-[10px] text-ink-3">{String(i).padStart(2, "0")}</span>{gpu && <Icon name="gpu" size={12} className="text-ink-3" title="GPU-exclusive" />}</div>
            <div className="mt-1 text-[12px] font-medium text-ink">{STAGE_LABEL[k]}</div>
            <div className="mt-1"><Status s={status === "ready" ? "pending" : status} label={status === "ready" ? "ready" : undefined} /></div>
            {isNext && k !== "seal" && status !== "running" && (
              <div className="mt-2"><Button size="sm" tone="primary" icon="play" busy={busyStage === k} disabled={!!blk?.length} title={blk?.length ? `Blocked by: ${blk.join(", ")}` : STAGE_HINT[k]} onClick={() => onRun(k)}>Run</Button></div>
            )}
            {st[k]?.status === "failed" && <div className="mt-1 line-clamp-3 font-mono text-[9.5px] text-crit-ink" title={st[k].error}>{st[k].error}</div>}
          </li>
        );
      })}
    </ol>
  );
}

function StudyView({ sid }: { sid: string }) {
  const s = useApi<StudySummary>(`/api/studies/${sid}`, 4000);
  const rd = useApi<Readiness>("/api/system/readiness", 20000);
  const act = useAction();
  const [jobId, setJobId] = useState<string | null>(null);
  const [seal, setSeal] = useState("");
  const [busyStage, setBusyStage] = useState<string | null>(null);
  const running = s.data?.jobs?.find((j) => j.status === "running");
  // Follow a running job; otherwise show the study's most recent job so the panel is never blank.
  const latest = s.data?.jobs?.[0];
  useEffect(() => { if (!jobId && (running ?? latest)) setJobId((running ?? latest)!.id); }, [running, latest, jobId]);
  const reloadStudy = s.reload;
  const onDone = useCallback(() => { void reloadStudy(); }, [reloadStudy]);
  if (!s.data) return <Panel><ErrorLine error={s.error} />{!s.error && <div className="h-40" />}</Panel>;
  const d = s.data, p = d.plan;
  const run = (stage: string, confirm?: string) => void act.run(async () => {
    setBusyStage(stage);
    try { const j = await api.post<Job>(`/api/studies/${sid}/stages/${stage}`, { confirm }); setJobId(j.id); await s.reload(); }
    finally { setBusyStage(null); }
  });
  return (
    <div className="min-w-0 space-y-4 fit:flex fit:min-h-0 fit:flex-col fit:gap-3 fit:space-y-0">
      <Panel className="fit:shrink-0" title={p.name} eyebrow={p.profile} prov={<Prov kind="declared" source="frozen plan" />}
        right={<>{d.state.sealed && <Badge tone="accent"><Icon name="lock" size={11} />sealed</Badge>}<Hash value={p.study_id} n={18} label="study id" /></>}>
        <StageStepper s={d} onRun={(k) => run(k)} blocked={rd.data?.blocked_stages ?? {}} busyStage={busyStage} />
        {d.next_stage && STAGE_HINT[d.next_stage] && <div className="mt-3 flex items-start gap-2 text-[12px] text-ink-2"><Icon name="info" size={14} className="mt-0.5 text-ink-3" /><span><b className="font-medium text-ink">Next — {STAGE_LABEL[d.next_stage]}.</b> {STAGE_HINT[d.next_stage]}</span></div>}
        {d.next_stage && ["train", "evaluate_dev", "evaluate_test", "export"].includes(d.next_stage) && <div className="mt-3"><TeacherGpu onFreed={() => { void rd.reload(); }} /></div>}
        {d.next_stage === "seal" && (
          <div className="mt-3 flex flex-wrap items-end gap-2 rounded-[var(--radius)] border border-accent-line bg-accent-soft p-3">
            <div className="min-w-[260px] flex-1 text-[12px] text-ink-2"><b className="text-ink">Seal the study.</b> Adapters are frozen by sha256; build, train, and dev evaluation become impossible. Type <span className="font-mono text-ink">SEAL</span> to confirm.</div>
            <input className={cx(inputCls, "w-28")} value={seal} onChange={(e) => setSeal(e.target.value)} aria-label="Type SEAL" placeholder="SEAL" />
            <Button tone="primary" icon="seal" disabled={seal !== "SEAL"} busy={busyStage === "seal"} onClick={() => run("seal", "SEAL")}>Seal</Button>
          </div>
        )}
        <div className="mt-3"><ErrorLine error={act.error} /></div>
      </Panel>

      <div className="space-y-4 fit:grid fit:min-h-0 fit:flex-1 fit:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] fit:gap-3 fit:space-y-0">
      {jobId ? <Panel fill title="Live job" eyebrow="stdout · json events"><JobLog fill key={jobId} jobId={jobId} onDone={onDone} /></Panel>
        : <Panel fill title="Live job" eyebrow="stdout · json events"><Empty icon="play">Run a stage — its JSON event stream appears here.</Empty></Panel>}

      <div className="grid gap-4 2xl:grid-cols-2 fit:flex fit:min-h-0 fit:flex-col fit:gap-3">
        <Panel fill title="Frozen configuration" prov={<Prov kind="declared" />}>
          <KV rows={[
            ["teacher", `${p.teacher.model} · ${p.teacher.provider}`], ["endpoint", p.teacher.endpoint], ["student", p.student.name], ["student path", p.student.path],
            ["base sha256", <Hash key="b" value={p.base_hash} n={20} />], ["engine sha256", <Hash key="e" value={p.engine_source_sha256} n={20} />],
            ["taskset", <span key="t">{p.taskset.version} · <Hash value={p.taskset.sha256} n={12} /></span>],
            ["tasks", Object.entries(p.taskset.counts).map(([k, v]) => `${k} ${v}`).join(" · ")],
            ["seeds", p.seeds.join(", ")], ["arms", p.arms.join(", ")], ["primary", p.primary_contrast], ["min gain", fmt.pp(p.min_gain, 0)],
            ["device", p.device], ["train", Object.entries(p.train).map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`).join("  ")],
            ["environment", Object.entries(p.environment).map(([k, v]) => `${k}=${v}`).join("  ")],
          ]} />
        </Panel>
        <Panel fill flush title="Job history" right={<span className="num font-mono text-[10.5px] text-ink-3">{d.jobs?.length ?? 0}</span>}>
          {!d.jobs?.length ? <Empty>No jobs yet.</Empty> : (
            <table className="w-full text-[12px]">
              <thead><tr className="bg-surface-2"><th className={th}>Stage</th><th className={th}>Status</th><th className={th}>Started</th><th className={th}>Exit</th></tr></thead>
              <tbody>{d.jobs.map((j) => (
                <tr key={j.id} className={cx(tr, "cursor-pointer", jobId === j.id && "!bg-accent-soft")} onClick={() => setJobId(j.id)}>
                  <td className={cx(td, "font-mono text-[11px]")}>{j.kind.replace("stage:", "")}</td><td className={td}><Status s={j.status} /></td>
                  <td className={cx(td, "font-mono text-[11px] text-ink-3")}>{fmt.ago(j.started_at)}</td><td className={cx(td, "num font-mono text-[11px]")}>{j.exit_code ?? "—"}</td>
                </tr>))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
      </div>
    </div>
  );
}

interface LmsStatus { server_reachable: boolean; url: string; loaded: string[] | null; cli_path: string | null; cli_found: boolean; unload_command: string }

/** Student stages need the GPU the teacher occupies. Show LM Studio's live state and offer `lms unload --all`. */
function TeacherGpu({ onFreed }: { onFreed: () => void }) {
  const st = useApi<LmsStatus>("/api/lmstudio/status", 5000);
  const act = useAction();
  const [done, setDone] = useState<{ duration_ms: number } | null>(null);
  const loaded = st.data?.loaded ?? [];
  if (!st.data) return null;
  if (!st.data.server_reachable || st.data.loaded === null) {
    return <Notice tone="info">LM Studio's server is not reachable at {st.data.url}, so nothing is loaded through it. If LM Studio is open with a model loaded in its chat window, eject it there before training.</Notice>;
  }
  if (loaded.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-[color:var(--good)]/35 bg-[color:var(--good)]/[0.05] px-3 py-2.5 text-[12.5px] text-ink-2">
        <Status s="pass" label="GPU free" /><span>LM Studio reports no model loaded. Training and student evaluation can use the full GPU.</span>
        {done && <span className="font-mono text-[11px] text-ink-3">unloaded in {(done.duration_ms / 1000).toFixed(1)} s</span>}
      </div>
    );
  }
  return (
    <div className="rounded-[var(--radius)] border border-[color:var(--warn)]/50 bg-[color:var(--warn)]/[0.07] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-[260px] flex-1 text-[12.5px] leading-relaxed text-ink-2">
          <div className="flex items-center gap-2"><Status s="warn" label="teacher loaded" /><span className="font-mono text-[11.5px] text-ink">{loaded.join(", ")}</span></div>
          <div className="mt-1">Teacher and student share one 16 GB GPU, so training refuses to start while this is loaded. Unloading only frees VRAM; nothing is deleted. Before a future Collect, load the teacher again in LM Studio (or let its just-in-time loading do it, if enabled).</div>
        </div>
        {st.data.cli_found ? (
          <Button tone="primary" icon="stop" busy={act.busy}
            onClick={() => void act.run(async () => { setDone(await api.post<{ duration_ms: number }>("/api/lmstudio/unload")); await st.reload(); onFreed(); })}>
            Unload teacher
          </Button>
        ) : <span className="max-w-xs text-[11.5px] text-ink-3">The <span className="font-mono">lms</span> CLI was not found. Eject the model in LM Studio, or set <span className="font-mono">FORGE_LMS_PATH</span>.</span>}
      </div>
      {st.data.cli_found && <div className="mt-2 font-mono text-[10.5px] text-ink-3">runs: {st.data.unload_command} · {st.data.cli_path}</div>}
      <div className="mt-2"><ErrorLine error={act.error} /></div>
    </div>
  );
}
