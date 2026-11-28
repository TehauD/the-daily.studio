import { useState } from "react";
import { Badge, Button, Empty, ErrorLine, Field, Notice, Panel, Prov, cx, inputCls } from "./ui";
import { api } from "../lib/api";
import { useAction, useApi } from "../lib/hooks";

interface PackInfo { file: string; path: string; bytes?: number; error?: string; pack?: { id: string; name: string; version: string; domain: string; author: string; licence: string; tasks: number; made_with: string; intended_use: string }; skills?: { id: string; name: string }[]; tables?: string[] }
interface InstallRes { agent_id: string; tasks_included: number; tasks_verified: number; dropped_total: number; tasks_dropped: { task_id: string; reason: string }[] }

/** Share an agent as a task pack: data only (spec, synthetic tables, verified tasks). */
export function PackShare({ aid, name }: { aid: string; name: string }) {
  const [f, setF] = useState({ id: "", version: "1.0.0", description: "", author: "", licence: "", include_tasks: true });
  const [out, setOut] = useState<{ path: string; bytes: number; pack: { id: string; tasks: number } } | null>(null);
  const act = useAction();
  return (
    <Panel title="Share as a task pack" prov={<Prov kind="declared" source="data only — no code" />}>
      <p className="mb-2 text-[12.5px] text-ink-2">A task pack is this agent's role, tools, skills, synthetic tables and verified practice tasks in one hashed file. It carries no code, so a colleague's FORGE runs it with its own tool engine — and re-verifies every task on install.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="Pack id"><input className={inputCls} value={f.id} placeholder={name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40)} onChange={(e) => setF({ ...f, id: e.target.value })} /></Field>
        <Field label="Version"><input className={inputCls} value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} /></Field>
        <Field label="Licence"><input className={inputCls} value={f.licence} placeholder="e.g. CC-BY-4.0" onChange={(e) => setF({ ...f, licence: e.target.value })} /></Field>
        <Field label="Author"><input className={inputCls} value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} /></Field>
        <div className="sm:col-span-2"><Field label="Description"><input className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field></div>
      </div>
      <label className="mt-2 flex items-center gap-2 text-[12px] text-ink-2"><input type="checkbox" checked={f.include_tasks} onChange={(e) => setF({ ...f, include_tasks: e.target.checked })} /> include the verified practice tasks (with their splits)</label>
      <div className="mt-2"><Button icon="download" busy={act.busy} onClick={() => void act.run(async () => setOut(await api.post(`/api/agents/${aid}/pack`, { ...f, id: f.id || null })))}>Make task pack</Button></div>
      <ErrorLine error={act.error} />
      {out && <div className="mt-2 text-[12px] text-ink-2">Saved <span className="font-mono">{out.pack.id}</span> ({out.pack.tasks} tasks, {(out.bytes / 1024).toFixed(0)} KB) — <a className="text-accent underline" href={`/api/packs/${out.path.split(/[\\/]/).pop()}`} download>download</a><br /><span className="break-all font-mono text-[11px] text-ink-3">{out.path}</span></div>}
    </Panel>
  );
}

/** Install a task pack received from someone else. */
export function PackInstall({ onInstalled }: { onInstalled: (id: string) => void }) {
  const lst = useApi<{ packs: PackInfo[]; folder: string }>("/api/packs");
  const [path, setPath] = useState("");
  const [ok, setOk] = useState(false);
  const [res, setRes] = useState<InstallRes | null>(null);
  const act = useAction();
  const install = (p: string) => void act.run(async () => { const r = await api.post<InstallRes>("/api/packs/install", { path: p, no_sensitive_data: ok }); setRes(r); onInstalled(r.agent_id); });
  return (
    <Panel title="…or install a task pack" prov={<Prov kind="declared" source="checked and re-verified on install" />}>
      <p className="mb-2 text-[12.5px] text-ink-2">Packs in <span className="break-all font-mono text-[11.5px]">{lst.data?.folder ?? "FORGE_HOME/packs"}</span>, or any path on this machine. FORGE checks every file hash, refuses code and personal identifiers, and re-runs every task's tool calls — tasks whose answers don't follow from the tools are dropped.</p>
      {(lst.data?.packs ?? []).length ? (
        <ul className="mb-2 space-y-1.5">{lst.data!.packs.map((p) => (
          <li key={p.file} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border border-line p-2 text-[12px]">
            {p.error ? <span className="text-crit-ink">{p.file}: {p.error}</span> : <>
              <span><b className="text-ink">{p.pack!.name}</b> <span className="font-mono text-ink-3">{p.pack!.id} {p.pack!.version}</span> · {p.pack!.domain} · {p.pack!.tasks} tasks · {(p.skills ?? []).length} skills{p.pack!.licence ? ` · ${p.pack!.licence}` : ""}</span>
              <Button size="sm" busy={act.busy} disabled={!ok} onClick={() => install(p.path)}>Install</Button></>}
          </li>))}</ul>) : <Empty icon="dot">No packs in the folder yet.</Empty>}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1"><Field label="Pack file"><input className={inputCls} value={path} placeholder="C:\path\to\name-1.0.0.forgepack.zip" onChange={(e) => setPath(e.target.value)} /></Field></div>
        <Button busy={act.busy} disabled={!ok || !path.trim()} onClick={() => install(path.trim())}>Install from path</Button>
      </div>
      <label className="mt-2 flex items-start gap-2 text-[12px] text-ink-2"><input type="checkbox" className="mt-0.5" checked={ok} onChange={(e) => setOk(e.target.checked)} /> I confirm this pack contains no patient, personal or confidential information (synthetic data only).</label>
      <ErrorLine error={act.error} />
      {res && <div className="mt-2"><Notice tone={res.dropped_total ? "warn" : "info"}>Installed: {res.tasks_verified} of {res.tasks_included} tasks re-verified{res.dropped_total ? `; ${res.dropped_total} dropped (${res.tasks_dropped.slice(0, 3).map((d) => d.reason).join("; ")})` : ""}.</Notice></div>}
    </Panel>
  );
}

interface Check { check: string; ok: boolean; detail: string }
/** Reproducibility bundle: write one for the study, list them, verify any bundle by recomputing its statistics. */
export function BundlePanel({ sid }: { sid: string | null }) {
  const l = useApi<{ bundles: { name: string; path: string; bytes: number }[] }>(sid ? `/api/studies/${sid}/bundles` : null);
  const [adapters, setAdapters] = useState(false);
  const [vpath, setVpath] = useState("");
  const [v, setV] = useState<{ ok: boolean; checks: Check[]; bundle?: { name: string; forge_version: string; made_at: string } } | null>(null);
  const act = useAction();
  return (
    <div className="grid gap-4 xl:grid-cols-2 [&>*]:min-w-0">
      <Panel title="Reproducibility bundle" prov={<Prov kind="measured" source="hashed study files" />}>
        <p className="mb-2 text-[12.5px] text-ink-2">Everything someone else needs to check this study's numbers: frozen plan, tasks, every raw episode, analyses, training logs, seal record, quantization manifests — each file hashed. Synthetic data only.</p>
        {!sid ? <Empty icon="dot">Choose a study in the top bar.</Empty> : <>
          <label className="flex items-center gap-2 text-[12px] text-ink-2"><input type="checkbox" checked={adapters} onChange={(e) => setAdapters(e.target.checked)} /> include trained adapter weights (larger; lets others run the student)</label>
          <div className="mt-2"><Button icon="download" busy={act.busy} onClick={() => void act.run(async () => { const r = await api.post<{ path: string }>(`/api/studies/${sid}/bundle`, { include_adapters: adapters }); setVpath(r.path); await l.reload(); })}>Make bundle</Button></div>
          <ul className="mt-2 space-y-1">{(l.data?.bundles ?? []).map((b) => (
            <li key={b.name} className="flex flex-wrap items-center justify-between gap-2 text-[12px]"><span className="font-mono text-ink-2">{b.name} · {(b.bytes / 1e6).toFixed(2)} MB</span>
              <span className="flex gap-1.5"><a className="text-accent underline" href={`/api/studies/${sid}/bundles/${b.name}`} download>download</a><button type="button" className="text-accent underline" onClick={() => setVpath(b.path)}>verify</button></span></li>))}</ul>
        </>}
        <ErrorLine error={act.error} />
      </Panel>
      <Panel title="Verify a bundle" prov={<Prov kind="computed" source="recomputed from raw episodes" />}>
        <p className="mb-2 text-[12.5px] text-ink-2">Checks every file hash and the frozen plan, then <b>recomputes</b> each analysis — gains, ranges, p-values — from the raw episodes with FORGE's own statistics and compares. It does not re-train.</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1"><Field label="Bundle file"><input className={inputCls} value={vpath} placeholder="path to a FORGE bundle .zip" onChange={(e) => setVpath(e.target.value)} /></Field></div>
          <Button busy={act.busy} disabled={!vpath.trim()} onClick={() => void act.run(async () => setV(await api.post("/api/bundles/verify", { path: vpath.trim() })))}>Verify</Button>
        </div>
        {v && (
          <div className="mt-3">
            <div className="mb-1.5"><Badge tone={v.ok ? "good" : "crit"}>{v.ok ? "verified" : "not verified"}</Badge> {v.bundle && <span className="text-[12px] text-ink-3">{v.bundle.name} · FORGE {v.bundle.forge_version} · {v.bundle.made_at?.slice(0, 16)}</span>}</div>
            <ul className="space-y-1">{v.checks.map((c) => <li key={c.check} className="text-[12px]"><span className={cx("font-medium", c.ok ? "text-good-ink" : "text-crit-ink")}>{c.ok ? "pass" : "fail"}</span> <span className="text-ink">{c.check}</span> <span className="break-words text-ink-3">— {c.detail}</span></li>)}</ul>
          </div>)}
      </Panel>
    </div>
  );
}
