import { useEffect } from "react";
import { Limits, RangeBar, Score, fmtPct } from "../components/results";
import { Badge, Button, Empty, ErrorLine, PageHeader, Panel, Prov, Status, cx, inputCls, td, th, tr } from "../components/ui";
import { fmt } from "../lib/api";
import { Term } from "../lib/glossary";
import { goto } from "../lib/handoff";
import { useApi } from "../lib/hooks";
import { usePrefs } from "../lib/prefs";
import type { Model } from "../lib/types";

interface Hub {
  model: { id: string; name: string; provider: string; roles: string[]; architecture: string | null; parameter_count: number | null; quantization: string | null;
    context_length: number | null; size_bytes: number | null; status: string; license: string | null; vision: boolean; trainable: boolean; kind: string | null; storage_path: string | null };
  studies: { id: string; name: string; role: string; profile: string; sealed: boolean; next_stage: string | null; created_at: string; teacher_rate: number | null; untrained_rate: number | null }[];
  adapters: { study_id: string; study: string; arm: string; seed: number; sealed: boolean; turbo: Record<string, unknown>;
    results: Record<string, { rate: number | null; gain: number | null; ci: [number | null, number | null]; base: number | null }> }[];
  bench: { run: string; suite: string; at: string; lane: string; mode: string; adapter: boolean; rate: number; ci: [number, number] | null; n: number; by_category: Record<string, number> }[];
  variants: { id: string; name: string; status: string; created_at: string }[];
  exports: { study: string; file: string; bytes: number; type: string; check: { success: number; agreement_with_merged: number } | null }[];
}
const SUITE = { compute: "Computation", vision: "Documents (vision)", security: "Security analysis" } as Record<string, string>;
const MODE = { no_tools: "on its own", tools: "with tools", direct: "" } as Record<string, string>;

/** One page per model: everything FORGE has measured about it, and what to do next. */
export default function ModelHub() {
  const { prefs, set } = usePrefs();
  const models = useApi<{ models: Model[] }>("/api/models");
  const list = (models.data?.models ?? []).filter((m) => m.metadata.model_kind !== "embedding").sort((a, b) => a.name.localeCompare(b.name));
  useEffect(() => { if (!prefs.activeModel && list.length) set("activeModel", (list.find((m) => m.roles.includes("student")) ?? list[0]).id); }, [list, prefs.activeModel, set]);
  const id = prefs.activeModel;
  const hub = useApi<Hub>(id ? `/api/models/${encodeURIComponent(id)}/hub` : null, 15000);
  const h = hub.data;
  const latest = (suite: string, mode: string) => h?.bench.filter((b) => b.suite === suite && b.mode === mode && !b.adapter)[0];
  const bestAdapter = h?.adapters.map((a) => ({ a, r: a.results.test ?? a.results.dev, sp: a.results.test ? "sealed final test" : "practice (dev)" })).filter((x) => x.r?.rate != null)
    .sort((x, y) => (y.r!.rate ?? 0) - (x.r!.rate ?? 0))[0];
  return (
    <div className="space-y-4">
      <PageHeader kicker="Operate" title="Model Hub" subtitle="Everything FORGE has measured about one model — benches, studies, trained adapters, variants and exports — with the next sensible actions."
        right={<select className={cx(inputCls, "!w-auto max-w-[360px] font-sans")} value={id ?? ""} onChange={(e) => set("activeModel", e.target.value)} aria-label="Model">
          {list.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.provider}</option>)}</select>} />
      <ErrorLine error={models.error ?? hub.error} />
      {!h ? <Panel><Empty icon="observatory">{list.length ? "Loading…" : "No models discovered yet — run discovery in the Model Observatory."}</Empty></Panel> : (
        <>
          <Panel title={h.model.name} eyebrow={`${h.model.provider}${h.model.architecture ? ` · ${h.model.architecture}` : ""}`} prov={<Prov kind="measured" source="registry · studies · benches" />}
            right={<Status s={h.model.status === "available" ? "pass" : "warn"} label={h.model.status} />}>
            <div className="flex flex-wrap gap-1.5">
              {h.model.roles.map((r) => <Badge key={r} tone={r === "teacher" ? "teacher" : "base"}>{r}</Badge>)}
              {h.model.vision && <Badge tone="accent">vision</Badge>}
              <Badge tone={h.model.trainable ? "good" : "default"}>{h.model.trainable ? "trainable (LoRA)" : "inference only"}</Badge>
              {h.model.quantization && <Badge>{h.model.quantization}</Badge>}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12px] sm:grid-cols-4">
              {([["Parameters", h.model.parameter_count ? fmt.params(h.model.parameter_count) : "—"], ["Context", h.model.context_length ? `${h.model.context_length.toLocaleString()} tokens` : "—"],
                ["Size on disk", h.model.size_bytes ? fmt.mb(h.model.size_bytes / 2 ** 20) : "—"], ["License", h.model.license ?? "—"]] as [string, string][]).map(([k, v]) => (
                <div key={k}><dt className="micro text-ink-3">{k}</dt><dd className="num font-mono text-ink">{v}</dd></div>))}
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" icon="flask" onClick={() => goto("bench")}>Run a bench</Button>
              {h.model.trainable && <Button size="sm" icon="studio" onClick={() => goto("studio")}>Start a study with it</Button>}
              <Button size="sm" icon="play" onClick={() => goto("playground")}>Try in Playground</Button>
              <Button size="sm" tone="ghost" icon="observatory" onClick={() => goto("observatory")}>Check GPU fit</Button>
            </div>
          </Panel>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[["compute", "no_tools"], ["compute", "tools"], ["vision", "direct"], ["security", "direct"]].map(([s, m]) => { const b = latest(s, m); return (
              <div key={s + m} className="rounded-[var(--radius)] border border-line bg-surface p-3">
                {b ? <Score label={`${SUITE[s]}${MODE[m] ? ` · ${MODE[m]}` : ""}`} rate={b.rate} ci={b.ci} n={b.n} sub={new Date(b.at).toLocaleDateString()} />
                  : <div><div className="micro text-ink-3">{SUITE[s]}{MODE[m] ? ` · ${MODE[m]}` : ""}</div><div className="mt-2 text-[12px] text-ink-3">{s === "vision" && !h.model.vision ? "not a vision model" : "not measured yet"}</div></div>}
              </div>); })}
            <div className="rounded-[var(--radius)] border border-line bg-surface p-3">
              {bestAdapter ? <Score label={`Best trained adapter · ${bestAdapter.sp}`} rate={bestAdapter.r!.rate} ci={bestAdapter.r!.ci as [number, number]} sub={`${bestAdapter.a.study} · ${bestAdapter.a.arm} s${bestAdapter.a.seed}`} />
                : <div><div className="micro text-ink-3">Trained adapters</div><div className="mt-2 text-[12px] text-ink-3">{h.model.trainable ? "none yet" : "not trainable here"}</div></div>}
            </div>
          </div>

          <div className="grid gap-4 2xl:grid-cols-2 [&>*]:min-w-0">
            <Panel flush title="Bench results" prov={<Prov kind="measured" source="Bench Lab" />} right={<Button size="sm" tone="ghost" onClick={() => goto("bench")}>Open Bench Lab</Button>}>
              {!h.bench.length ? <Empty icon="flask">No bench runs include this model yet.</Empty> : (
                <div className="overflow-x-auto"><table className="w-full text-[12.5px]">
                  <thead><tr>{["Bench", "Model / adapter", "Success", "95% range", "Items", "Date"].map((x, i) => <th key={x} className={cx(th, i > 1 && "text-right")}>{x}</th>)}</tr></thead>
                  <tbody>{h.bench.slice(0, 20).map((b) => (
                    <tr key={b.run + b.lane + b.mode} className={tr}><td className={td}>{SUITE[b.suite]}{MODE[b.mode] ? <span className="text-ink-3"> · {MODE[b.mode]}</span> : null}</td>
                      <td className={cx(td, "max-w-[220px] truncate")}>{b.lane}{b.adapter && <Badge tone="tuned">adapter</Badge>}</td>
                      <td className={cx(td, "num text-right font-mono")}>{fmtPct(b.rate)}</td>
                      <td className={cx(td, "w-40")}><RangeBar rate={b.rate} ci={b.ci} label={b.lane} /></td>
                      <td className={cx(td, "num text-right font-mono")}>{b.n}</td><td className={cx(td, "text-right font-mono text-ink-3")}>{new Date(b.at).toLocaleDateString()}</td></tr>))}</tbody></table></div>)}
            </Panel>
            <Panel flush title="Trained adapters" prov={<Prov kind="measured" source="study analyses" />}>
              {!h.adapters.length ? <Empty icon="training">No adapters trained on this model yet.</Empty> : (
                <div className="overflow-x-auto"><table className="w-full text-[12.5px]">
                  <thead><tr>{["Study", "Run", "Practice (dev)", "Final test", "Engine", ""].map((x) => <th key={x} className={th}>{x}</th>)}</tr></thead>
                  <tbody>{h.adapters.map((a) => (
                    <tr key={a.study_id + a.arm + a.seed} className={tr}>
                      <td className={cx(td, "max-w-[200px] truncate")}>{a.study}</td><td className={cx(td, "font-mono text-ink-3")}>{a.arm} s{a.seed}</td>
                      {(["dev", "test"] as const).map((sp) => { const r = a.results[sp]; return (
                        <td key={sp} className={cx(td, "w-36")}>{r?.rate != null ? <><span className="num font-mono">{fmtPct(r.rate)}</span>{r.gain != null && <span className={cx("ml-1 font-mono text-[11px]", r.gain > 0 ? "text-good-ink" : "text-ink-3")}>{r.gain > 0 ? "+" : ""}{(r.gain * 100).toFixed(0)} pts</span>}
                          <RangeBar rate={r.rate} ci={r.ci[0] != null ? (r.ci as [number, number]).map((x, i) => i === 0 ? Math.max(0, (r.base ?? 0) + x) : Math.min(1, (r.base ?? 0) + x)) : null} className="mt-1" /></> : <span className="text-ink-3">{sp === "test" && !a.sealed ? "sealed away" : "—"}</span>}</td>); })}
                      <td className={cx(td, "text-ink-3")}>{Object.values(a.turbo).some((v) => v === true || v === "offload" || v === "off" || v === "flash_attention_2") ? "Turbo" : "standard"}</td>
                      <td className={td}><Button size="sm" tone="ghost" onClick={() => { set("activeStudy", a.study_id); goto("evaluation"); }}>Open</Button></td>
                    </tr>))}</tbody></table></div>)}
              <div className="p-[var(--pad)] text-[11px] text-ink-3">Range bars show the 95 % range of the trained rate (untrained rate + the paired gain's interval).</div>
            </Panel>
            <Panel flush title="Studies" prov={<Prov kind="declared" source="study plans" />}>
              {!h.studies.length ? <Empty icon="studio">Not used in any study yet.</Empty> : (
                <div className="overflow-x-auto"><table className="w-full text-[12.5px]">
                  <thead><tr>{["Study", "Role", "Profile", "Status", ""].map((x) => <th key={x} className={th}>{x}</th>)}</tr></thead>
                  <tbody>{h.studies.map((s) => (
                    <tr key={s.id} className={tr}><td className={cx(td, "max-w-[240px] truncate")}>{s.name}</td><td className={td}><Badge tone={s.role === "teacher" ? "teacher" : "base"}>{s.role}</Badge></td>
                      <td className={cx(td, "font-mono text-ink-3")}>{s.profile}</td><td className={td}>{s.sealed ? <Badge tone="good">sealed</Badge> : s.next_stage ? <span className="text-ink-2">next: {s.next_stage}</span> : <Badge tone="good">complete</Badge>}</td>
                      <td className={td}><Button size="sm" tone="ghost" onClick={() => { set("activeStudy", s.id); goto("studio"); }}>Open</Button></td></tr>))}</tbody></table></div>)}
            </Panel>
            <Panel title="Variants & exports" prov={<Prov kind="measured" source="Weight Lab · Model Factory" />}>
              <div className="space-y-3 text-[12.5px]">
                <div><div className="micro mb-1 text-ink-3">Weight Lab variants</div>{h.variants.length ? <ul className="space-y-1">{h.variants.map((v) => <li key={v.id} className="flex justify-between"><span className="truncate">{v.name}</span><Badge>{v.status}</Badge></li>)}</ul> : <span className="text-ink-3">none</span>}</div>
                <div><div className="micro mb-1 text-ink-3">GGUF exports</div>{h.exports.length ? <ul className="space-y-1">{h.exports.map((x) => <li key={x.file} className="flex flex-wrap justify-between gap-2"><span className="font-mono">{x.file}</span>
                  <span className="text-ink-3">{x.type} · {fmt.mb(x.bytes / 2 ** 20)}{x.check ? ` · LM Studio check ${fmtPct(x.check.success)}, agreement ${fmtPct(x.check.agreement_with_merged)}` : " · not checked"}</span></li>)}</ul> : <span className="text-ink-3">none</span>}</div>
              </div>
            </Panel>
          </div>
          <Limits>Bench results describe FORGE's generated items, and study results describe that study's tasks — not general ability, clinical validity or readiness for use. Scores from different runs may use different items; compare models within one run. <Term k="human">People decide</Term>.</Limits>
        </>
      )}
    </div>
  );
}
