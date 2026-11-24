import { useEffect, useMemo, useState } from "react";
import { LegendKey } from "../components/charts";
import { JobLog, StudySelect } from "../components/live";
import { Badge, Button, Empty, ErrorLine, Notice, PageHeader, Panel, Prov, Segmented, Skeleton, cx, inputCls } from "../components/ui";
import { api, fmt, qs } from "../lib/api";
import { useAction, useApi } from "../lib/hooks";
import { usePrefs } from "../lib/prefs";
import type { Job, StudySummary } from "../lib/types";

/* ------------------------------------------------------------------ types */
interface DNode { id: string; kind: "skill" | "action" | "outcome"; label: string; col: number; y: number; count: number; tasks: string[]; outcome?: string }
interface DSkill { skill: string; label: string; tasks: number; distinct_paths: number; consistency: number; most_common_path: string[]; most_common_outcome: string; strict_rate: number }
interface DGraph { available: boolean; models: { key: string; label: string }[]; nodes?: DNode[]; edges?: { from: string; to: string; count: number }[]; columns?: number; rows?: number; skills?: DSkill[]; honesty?: string }
interface LayerMap { layer: number; variance_2d: number; shift: number; base: { xy: [number, number][]; silhouette: number | null; knn_purity: number | null }; tuned: { xy: [number, number][]; silhouette: number | null; knn_purity: number | null } }
interface MapT { available: boolean; trained?: boolean; tasks?: { task_id: string; family: string; prompt: string }[]; layers?: LayerMap[]; n_layers?: number; hidden_size?: number; honesty?: string; generated_at?: string; arm?: string; seed?: number }
interface Explain { id: string; prompt: string; task_id: string | null; model: string; first_action: string; decision_token: string; words: { w: string; score: number }[]; user_share: number;
  lens: { layer: number; top: { t: string; p: number }[]; chosen_p: number; chosen_rank: number }[]; n_layers: number; honesty: string; generated_at: string }

const OUT_COLOR: Record<string, string> = { strict: "var(--good)", answer_only: "var(--warn)", wrong: "var(--crit)", invalid: "var(--crit)", no_answer: "var(--ink-3)" };
const cat = (i: number) => (i < 8 ? `var(--cat-${i + 1})` : "var(--ink-3)");
const show = (t: string) => t.replace(/\n/g, "↵").replace(/ /g, "·") || "∅";

export default function ModelMap() {
  const { prefs } = usePrefs();
  const sid = prefs.activeStudy;
  const s = useApi<StudySummary & { jobs?: Job[] }>(sid ? `/api/studies/${sid}` : null, 5000);
  const plan = s.data?.plan;
  const sealed = !!s.data?.state.sealed;
  const [split, setSplit] = useState("dev");
  const runs = useMemo(() => (plan ? plan.arms.flatMap((a) => plan.seeds.map((sd) => `${a}:${sd}`)) : []), [plan]);
  const [run, setRun] = useState("");
  useEffect(() => { if (runs.length && !runs.includes(run)) setRun(runs[0]); }, [runs, run]);
  const [arm, seed] = run ? [run.split(":")[0], Number(run.split(":")[1])] : ["", 0];
  const [picked, setPicked] = useState<{ label: string; tasks: string[] } | null>(null);
  const [task, setTask] = useState<string | null>(null);
  useEffect(() => { setPicked(null); setTask(null); }, [sid, split]);
  const map = useApi<MapT>(sid && run ? `/api/studies/${sid}/modelmap/map${qs({ split, arm, seed })}` : null);
  const running = s.data?.jobs?.find((j) => j.status === "running" && j.kind.startsWith("modelmap"));
  return (
    <div className="space-y-4 fit:flex fit:h-full fit:min-h-0 fit:flex-col fit:gap-3 fit:space-y-0">
      <PageHeader kicker="See inside & control" title="Model Map"
        subtitle="Three linked, measured views of the same tasks: how each model behaves (decision graph), how the student organises tasks inside its layers (representation map), and which words drove one decision (word view)."
        right={<>
          <StudySelect />
          <Segmented label="Split" value={split} onChange={setSplit} options={[{ value: "train", label: "train" }, { value: "dev", label: "dev" }, ...(sealed ? [{ value: "test", label: "test" }] : [])]} />
          {runs.length > 1 && <select className={cx(inputCls, "h-8 !w-auto font-sans")} value={run} onChange={(e) => setRun(e.target.value)} aria-label="Trained run">{runs.map((r) => <option key={r} value={r}>{r.replace(":", " · seed ")}</option>)}</select>}
        </>} />
      <ErrorLine error={s.error} />
      {!sid ? <Panel><Empty icon="graph">Select or create a study.</Empty></Panel> : !plan ? <Skeleton h={400} /> : (
        <div className="grid gap-4 fit:min-h-0 fit:flex-1 fit:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] fit:gap-3">
          <div className="flex min-w-0 flex-col gap-4 fit:min-h-0 fit:gap-3">
            <DecisionGraph sid={sid} split={split} run={run} picked={picked} task={task} onPick={setPicked} />
            <RepresentationMap sid={sid} split={split} arm={arm} seed={seed} map={map.data} onReload={() => void map.reload()} running={running}
              picked={picked} task={task} onTask={setTask} />
          </div>
          <WordView sid={sid} arm={arm} seed={seed} tasks={map.data?.tasks ?? []} task={task} onTask={setTask} running={running} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ decision graph */
const CW = 170, RH = 30, NW = 150, NH = 24, PX = 12, PY = 12;
function DecisionGraph({ sid, split, run, picked, task, onPick }: { sid: string; split: string; run: string; picked: { label: string; tasks: string[] } | null; task: string | null; onPick: (p: { label: string; tasks: string[] } | null) => void }) {
  const [model, setModel] = useState("teacher");
  const g = useApi<DGraph>(`/api/studies/${sid}/modelmap/decisions${qs({ split, model })}`);
  const d = g.data;
  const W = PX * 2 + ((d?.columns ?? 1) - 1) * CW + NW, H = PY * 2 + (d?.rows ?? 1) * RH;
  const byId = useMemo(() => new Map((d?.nodes ?? []).map((n) => [n.id, n])), [d]);
  const maxC = Math.max(1, ...(d?.edges ?? []).map((e) => e.count));
  const opts = (d?.models ?? [{ key: "teacher", label: "teacher" }, { key: "base", label: "untrained student" }]).map((m) => ({ value: m.key, label: m.key === run ? "trained" : m.label }));
  return (
    <Panel fill flush title="Decision graph" eyebrow="how each model behaves" className="fit:min-h-0 fit:flex-[1.05]" prov={d?.available ? <Prov kind="measured" source={`episodes · ${split}`} /> : undefined}
      right={<select className={cx(inputCls, "h-7 !w-auto font-sans")} value={model} onChange={(e) => setModel(e.target.value)} aria-label="Model">{opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>}>
      <ErrorLine error={g.error} />
      {!d ? <Skeleton h={200} /> : !d.available ? <Empty>No {split} episodes for this model yet (collect / evaluate first).</Empty> : (
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-line px-[var(--pad)] py-2 text-[11.5px] text-ink-2">
            {d.skills!.map((k) => (
              <span key={k.skill} title={`Most common path: ${k.most_common_path.join(" → ") || "(no tool)"} → ${k.most_common_outcome}`}>
                <b className="font-medium text-ink">{k.label}</b> · same procedure <span className="num font-mono">{fmt.pct(k.consistency, 0)}</span> · {k.distinct_paths} path{k.distinct_paths === 1 ? "" : "s"} · strict <span className="num font-mono">{fmt.pct(k.strict_rate, 0)}</span>
              </span>
            ))}
          </div>
          <div className="scroll-thin min-h-0 flex-1 overflow-auto">
            <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Decision graph">
              {d.edges!.map((e, i) => {
                const a = byId.get(e.from)!, b = byId.get(e.to)!;
                const x1 = PX + a.col * CW + NW, y1 = PY + a.y * RH + NH / 2, x2 = PX + b.col * CW, y2 = PY + b.y * RH + NH / 2;
                const mx = (x1 + x2) / 2;
                const color = b.kind === "outcome" ? OUT_COLOR[b.outcome!] : "var(--line-strong)";
                const lit = !picked || b.tasks.some((t) => picked.tasks.includes(t));
                return <path key={i} d={`M${x1} ${y1}C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`} fill="none" stroke={color} strokeWidth={1 + (6 * e.count) / maxC} opacity={lit ? 0.8 : 0.15}><title>{`${e.count} task(s)`}</title></path>;
              })}
              {d.nodes!.map((n) => {
                const x = PX + n.col * CW, y = PY + n.y * RH;
                const sel = picked?.label === n.id;
                const hasTask = task ? n.tasks.includes(task) : false;
                const stroke = n.kind === "outcome" ? OUT_COLOR[n.outcome!] : n.kind === "skill" ? "var(--accent)" : "var(--line-strong)";
                return (
                  <g key={n.id} className="cursor-pointer" onClick={() => onPick(sel ? null : { label: n.id, tasks: n.tasks })}>
                    <rect x={x} y={y} width={NW} height={NH} rx={4} fill={sel ? "var(--accent-soft)" : "var(--surface)"} stroke={hasTask ? "var(--ink)" : stroke} strokeWidth={sel || hasTask ? 2 : 1.2} />
                    <text x={x + 7} y={y + 16} fontSize={10.5} fill="var(--ink)" fontFamily={n.kind === "action" ? "var(--font-mono)" : "Inter,system-ui,sans-serif"} fontWeight={n.kind === "skill" ? 600 : 400}>
                      {n.label.length > 19 ? n.label.slice(0, 18) + "…" : n.label}</text>
                    <text x={x + NW - 6} y={y + 16} fontSize={10} textAnchor="end" fill="var(--ink-3)" fontFamily="var(--font-mono)">{n.count}</text>
                    <title>{`${n.label} — ${n.count} task(s). Click to highlight them on the map.`}</title>
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-line px-[var(--pad)] py-2 text-[11px] text-ink-3">
            <LegendKey items={[{ label: "strict ✓", color: "var(--good)" }, { label: "right answer, wrong path", color: "var(--warn)" }, { label: "wrong / invalid", color: "var(--crit)" }]} />
            <span>line width = number of tasks · {picked ? <button type="button" className="text-accent" onClick={() => onPick(null)}>clear selection ({picked.tasks.length} tasks)</button> : "click a step to follow its tasks"}</span>
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ representation map */
function Plot({ pts, ids, fams, famIdx, picked, task, onTask, title, b }: { pts: [number, number][]; ids: string[]; fams: string[]; famIdx: Map<string, number>; picked: Set<string> | null;
  task: string | null; onTask: (id: string) => void; title: string; b: [number, number, number, number] }) {
  const W = 300, H = 230, P = 12;
  const sx = (v: number) => P + ((v - b[0]) / (b[1] - b[0] || 1)) * (W - 2 * P), sy = (v: number) => H - P - ((v - b[2]) / (b[3] - b[2] || 1)) * (H - 2 * P);
  return (
    <div className="min-w-0">
      <div className="micro mb-1 text-ink-3">{title}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full rounded-[var(--radius)] border border-line bg-surface" role="img" aria-label={title}>
        {pts.map((p, i) => {
          const on = !picked || picked.has(ids[i]);
          const sel = task === ids[i];
          return (
            <g key={ids[i]} className="cursor-pointer" onClick={() => onTask(ids[i])}>
              <circle cx={sx(p[0])} cy={sy(p[1])} r={10} fill="transparent" />
              <circle cx={sx(p[0])} cy={sy(p[1])} r={sel ? 6 : 4} fill={cat(famIdx.get(fams[i]) ?? 9)} stroke={sel ? "var(--ink)" : "var(--surface)"} strokeWidth={sel ? 2 : 1.5} opacity={on ? 0.95 : 0.15}>
                <title>{`${ids[i]} · ${fams[i]}`}</title></circle>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function MetricLine({ layers, get, label, lo }: { layers: LayerMap[]; get: (l: LayerMap, k: "base" | "tuned") => number | null; label: string; lo: number }) {
  const W = 260, H = 90, L = 30, R = 6, T = 8, B = 18;
  const xs = (i: number) => L + (layers.length > 1 ? (i / (layers.length - 1)) * (W - L - R) : (W - L - R) / 2);
  const ys = (v: number) => T + (1 - (v - lo) / (1 - lo)) * (H - T - B);
  const line = (k: "base" | "tuned") => layers.map((l, i) => [xs(i), ys(get(l, k) ?? lo)] as const).map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join("");
  return (
    <div className="min-w-0">
      <div className="micro mb-0.5 text-ink-3">{label}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={label}>
        {[lo, (lo + 1) / 2, 1].map((t) => <g key={t}><line x1={L} x2={W - R} y1={ys(t)} y2={ys(t)} stroke="var(--line)" /><text x={L - 4} y={ys(t) + 3} fontSize={9} textAnchor="end" fill="var(--ink-3)" fontFamily="var(--font-mono)">{t.toFixed(1)}</text></g>)}
        <path d={line("base")} fill="none" stroke="var(--s-base)" strokeWidth={2} />
        <path d={line("tuned")} fill="none" stroke="var(--s-tuned)" strokeWidth={2} />
        {layers.map((l, i) => <text key={i} x={xs(i)} y={H - 4} fontSize={9} textAnchor="middle" fill="var(--ink-3)" fontFamily="var(--font-mono)">{layers.length <= 12 || i % Math.ceil(layers.length / 10) === 0 ? l.layer : ""}</text>)}
      </svg>
      <div className="text-center text-[10px] text-ink-3">layer (0 = embeddings)</div>
    </div>
  );
}

function RepresentationMap({ sid, split, arm, seed, map, onReload, running, picked, task, onTask }: { sid: string; split: string; arm: string; seed: number; map: MapT | undefined | null; onReload: () => void;
  running?: Job; picked: { label: string; tasks: string[] } | null; task: string | null; onTask: (t: string) => void }) {
  const [layer, setLayer] = useState<number | null>(null);
  const [job, setJob] = useState<string | null>(null);
  const act = useAction();
  const m = map;
  const L = m?.layers ? (layer ?? m.layers.length - 1) : 0;
  const cur = m?.layers?.[Math.min(L, (m.layers.length ?? 1) - 1)];
  const fams = (m?.tasks ?? []).map((t) => t.family);
  const famList = [...new Set(fams)].sort();
  const famIdx = new Map(famList.map((f, i) => [f, i]));
  const ids = (m?.tasks ?? []).map((t) => t.task_id);
  const pickedSet = picked ? new Set(picked.tasks) : null;
  const b: [number, number, number, number] = cur ? (() => {
    const all = [...cur.base.xy, ...cur.tuned.xy];
    return [Math.min(...all.map((p) => p[0])), Math.max(...all.map((p) => p[0])), Math.min(...all.map((p) => p[1])), Math.max(...all.map((p) => p[1]))];
  })() : [0, 1, 0, 1];
  const id = job ?? (running?.kind === "modelmap:map" ? running.id : null);
  return (
    <Panel fill title="Representation map" eyebrow="how tasks are organised inside the student" className="fit:min-h-0 fit:flex-1" prov={m?.available ? <Prov kind="measured" source={`hidden states · ${m.hidden_size}-d → 2-d`} /> : undefined}>
      {id ? <JobLog key={id} jobId={id} height={140} onDone={() => { setJob(null); onReload(); }} /> : !m ? <Skeleton h={200} /> : !m.available ? (
        <div className="space-y-3 text-[12.5px] text-ink-2">
          <p>FORGE reads the student's internal state at the moment it decides what to do — for every {split} task, at every layer — before and after training, and shows whether tasks of the same skill cluster together.</p>
          {m.trained === false ? <Notice tone="info">Train the study first — the map compares the untrained and the trained student.</Notice> :
            <Button tone="primary" icon="play" busy={act.busy} onClick={() => void act.run(async () => setJob((await api.post<Job>(`/api/studies/${sid}/modelmap/map`, { split, arm, seed })).id))}>Compute the map</Button>}
          <ErrorLine error={act.error} />
        </div>
      ) : cur && (
        <div className="scroll-thin h-full space-y-3 overflow-auto pr-1">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex flex-1 items-center gap-2 text-[12px] text-ink-2"><span className="micro whitespace-nowrap text-ink-3">layer {cur.layer} / {m.n_layers}</span>
              <input type="range" min={0} max={m.layers!.length - 1} value={L} onChange={(e) => setLayer(Number(e.target.value))} className="flex-1 accent-[var(--accent)]" aria-label="Layer" /></label>
            <Badge>{cur.layer === 0 ? "word embeddings" : `after layer ${cur.layer}`}</Badge>
            <Badge title="How much of the spread the 2-D picture shows">2-D shows {fmt.pct(cur.variance_2d, 0)}</Badge>
            <Badge tone="accent" title="Mean relative change of the decision state caused by training at this layer">training moved it {fmt.pct(cur.shift, 0)}</Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Plot pts={cur.base.xy} ids={ids} fams={fams} famIdx={famIdx} picked={pickedSet} task={task} onTask={onTask} b={b}
              title={`untrained · skill purity ${fmt.pct(cur.base.knn_purity, 0)} · silhouette ${cur.base.silhouette?.toFixed(2) ?? "—"}`} />
            <Plot pts={cur.tuned.xy} ids={ids} fams={fams} famIdx={famIdx} picked={pickedSet} task={task} onTask={onTask} b={b}
              title={`trained · skill purity ${fmt.pct(cur.tuned.knn_purity, 0)} · silhouette ${cur.tuned.silhouette?.toFixed(2) ?? "—"}`} />
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-2">{famList.map((f) => <span key={f} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: cat(famIdx.get(f)!) }} />{f}</span>)}</div>
          <div className="grid gap-3 md:grid-cols-2">
            <MetricLine layers={m.layers!} get={(l, k) => l[k].knn_purity} label="skill purity by layer (share of 5 nearest tasks with the same skill)" lo={0} />
            <MetricLine layers={m.layers!} get={(l, k) => l[k].silhouette} label="silhouette by layer (−1 mixed … 1 clean clusters)" lo={-0.2} />
          </div>
          <LegendKey items={[{ label: "untrained", color: "var(--s-base)" }, { label: "trained", color: "var(--s-tuned)" }]} />
          <div className="text-[11px] text-ink-3">{m.honesty} Click a point to open it in the word view.</div>
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ word view */
function WordView({ sid, arm, seed, tasks, task, onTask, running }: { sid: string; arm: string; seed: number; tasks: { task_id: string; family: string; prompt: string }[];
  task: string | null; onTask: (t: string) => void; running?: Job }) {
  const [model, setModel] = useState<"trained" | "untrained">("trained");
  const [msg, setMsg] = useState("");
  const [job, setJob] = useState<string | null>(null);
  const list = useApi<{ id: string; prompt: string; model: string; task_id: string | null; generated_at: string }[]>(`/api/studies/${sid}/modelmap/explain`);
  const [eid, setEid] = useState<string | null>(null);
  useEffect(() => { if (!eid && list.data?.length) setEid(list.data[0].id); }, [list.data, eid]);
  const ex = useApi<Explain>(eid ? `/api/studies/${sid}/modelmap/explain/${eid}` : null);
  const act = useAction();
  const t = tasks.find((x) => x.task_id === task);
  const start = () => void act.run(async () => {
    const j = await api.post<Job>(`/api/studies/${sid}/modelmap/explain`, { task_id: task && !msg.trim() ? task : null, prompt: msg.trim() || null, model, arm, seed });
    setJob(j.id);
  });
  const id = job ?? (running?.kind === "modelmap:explain" ? running.id : null);
  const e = ex.data;
  const maxP = Math.max(0.0001, ...(e?.lens ?? []).map((l) => l.chosen_p));
  return (
    <Panel fill title="Word view" eyebrow="one decision, up close" className="fit:min-h-0" prov={e ? <Prov kind="computed" source="gradients + logit lens" /> : undefined}>
      <div className="scroll-thin h-full space-y-3 overflow-auto pr-1">
        <p className="text-[12px] leading-relaxed text-ink-2">Pick a point on the map (or write a message). FORGE runs the student once and shows <b className="text-ink">which words pushed its first action</b>, and <b className="text-ink">at which layer the decision formed</b>.</p>
        <div className="space-y-2 rounded-[var(--radius)] border border-line p-2.5">
          {t ? <div className="text-[12.5px] text-ink"><Badge>{t.family}</Badge> {t.prompt}</div> : <div className="text-[12px] text-ink-3">No task selected — click a point on the map{tasks.length ? "" : " (compute the map first)"}, or write a message:</div>}
          <input className={cx(inputCls, "font-sans")} placeholder="…or your own message" value={msg} onChange={(x) => setMsg(x.target.value)} aria-label="Message" />
          <div className="flex flex-wrap items-center gap-2">
            <Segmented label="Model" value={model} onChange={setModel} options={[{ value: "trained", label: "trained" }, { value: "untrained", label: "untrained" }]} />
            <Button tone="primary" icon="play" busy={act.busy} disabled={!!id || (!task && !msg.trim())} onClick={start}>Look closer</Button>
          </div>
          <ErrorLine error={act.error} />
        </div>
        {id && <JobLog key={id} jobId={id} height={110} onDone={() => { setJob(null); setEid(null); void list.reload(); }} />}
        {!e ? (!id && <Empty>No word view yet.</Empty>) : (
          <div className="space-y-3">
            <div className="text-[12.5px] text-ink">{e.prompt}</div>
            <div className="flex flex-wrap gap-1.5"><Badge>{e.model} student</Badge>{e.task_id && <button type="button" className="micro text-accent" onClick={() => onTask(e.task_id!)}>show on map</button>}</div>
            <div>
              <div className="micro mb-1 text-ink-3">word influence on its first action</div>
              <div className="flex flex-wrap gap-1 leading-relaxed">{e.words.map((w, i) => (
                <span key={i} className="rounded-[3px] px-1 text-[13px] text-ink" title={`influence ${w.score.toFixed(2)}`} style={{ background: `color-mix(in oklab, var(--accent) ${Math.round(w.score * 60)}%, transparent)` }}>{w.w}</span>
              ))}</div>
              <div className="mt-1 text-[11px] text-ink-3">{fmt.pct(e.user_share, 0)} of the influence came from this message; the rest from the instructions and tool list.</div>
            </div>
            <div>
              <div className="micro mb-1 text-ink-3">what it did · decision token</div>
              <div className="rounded bg-surface-2 p-2 font-mono text-[11.5px] text-ink-2 [font-variant-ligatures:none]">{e.first_action.trim() ? e.first_action : <span className="text-ink-3">(no visible output)</span>}</div>
              <div className="mt-1 text-[11.5px] text-ink-2">decided on <span className="rounded bg-accent-soft px-1 font-mono text-ink [font-variant-ligatures:none]">{show(e.decision_token)}</span></div>
            </div>
            <div>
              <div className="micro mb-1 text-ink-3">layer by layer: what the model would say if it stopped here</div>
              <table className="w-full text-[11.5px]">
                <thead><tr className="text-ink-3"><th className="text-left font-normal">layer</th><th className="text-left font-normal">top guesses</th><th className="w-32 text-left font-normal">chosen token</th></tr></thead>
                <tbody>{e.lens.map((l) => (
                  <tr key={l.layer} className="border-t border-line">
                    <td className="py-1 font-mono text-ink-3">{l.layer === 0 ? "emb" : l.layer}</td>
                    <td className="py-1"><div className="flex flex-wrap gap-1">{l.top.slice(0, 3).map((x, i) => <span key={i} className="rounded border border-line px-1 font-mono text-[10.5px] [font-variant-ligatures:none]">{show(x.t)} <span className="text-ink-3">{fmt.pct(x.p, 0)}</span></span>)}</div></td>
                    <td className="py-1"><div className="flex items-center gap-1.5"><div className="h-[6px] w-16 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-[color:var(--s-tuned)]" style={{ width: `${(l.chosen_p / maxP) * 100}%` }} /></div><span className="num font-mono text-[10.5px]">#{l.chosen_rank}</span></div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="text-[11px] text-ink-3">{e.honesty}</div>
            {(list.data?.length ?? 0) > 1 && <details className="text-[11.5px] text-ink-3"><summary className="cursor-pointer">earlier word views</summary>
              <div className="mt-1 space-y-1">{list.data!.map((x) => <button key={x.id} type="button" onClick={() => setEid(x.id)} className={cx("block w-full truncate text-left hover:text-ink", x.id === eid && "text-ink")}>{fmt.ago(x.generated_at)} · {x.model} · {x.prompt}</button>)}</div></details>}
          </div>
        )}
      </div>
    </Panel>
  );
}
