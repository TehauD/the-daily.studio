import { useMemo, useState } from "react";
import { PathCompare, PathGraph } from "../components/graphs";
import { StudySelect } from "../components/live";
import { Badge, Empty, ErrorLine, Hash, KV, Notice, PageHeader, Panel, Prov, Segmented, Status, cx, inputCls, td, th, tr } from "../components/ui";
import { fmt, qs } from "../lib/api";
import { useApi } from "../lib/hooks";
import { usePrefs } from "../lib/prefs";
import type { CompareT, EpisodeRow, GraphNode, PathGraphT } from "../lib/types";

export const HONESTY = "A model's hidden chain of thought cannot be faithfully visualized — its written “reasoning” is generated text, not its computation. FORGE shows observable behavior only: the actions a model emitted, the tool results it saw, and its final answer. Reasoning blocks are stripped at ingest and only their removal is counted.";

const ARM_TONE: Record<string, "teacher" | "base" | "tuned" | "default"> = { teacher: "teacher", base: "base", oracle: "default" };

export default function Trajectories() {
  const { prefs } = usePrefs();
  const sid = prefs.activeStudy;
  const eps = useApi<EpisodeRow[]>(sid ? `/api/studies/${sid}/episodes` : null);
  const [split, setSplit] = useState("dev");
  const [src, setSrc] = useState("");
  const [fam, setFam] = useState("");
  const [outcome, setOutcome] = useState<"all" | "pass" | "fail">("all");
  const [sel, setSel] = useState<EpisodeRow | null>(null);
  const rows = eps.data ?? [];
  const sources = useMemo(() => [...new Set(rows.filter((r) => r.split === split).map((r) => `${r.arm}|${r.seed}`))].sort(), [rows, split]);
  const families = useMemo(() => [...new Set(rows.map((r) => r.family))].sort(), [rows]);
  const list = rows.filter((r) => r.split === split && (!src || `${r.arm}|${r.seed}` === src) && (!fam || r.family === fam)
    && (outcome === "all" || (outcome === "pass") === r.strict_success)).slice(0, 400);
  const splits = useMemo(() => [...new Set(rows.map((r) => r.split))], [rows]);
  return (
    <div className="space-y-4 fit:flex fit:h-full fit:min-h-0 fit:flex-col fit:gap-3 fit:space-y-0">
      <PageHeader kicker="Research" title="Trajectory Explorer" subtitle="Every episode as an observable path: prompt → tool call → tool result → … → answer. Compare teacher, base, and tuned students on the same task and see where they first diverge."
        right={<StudySelect />} />
      <Notice tone="honesty" icon="info">{HONESTY}</Notice>
      <ErrorLine error={eps.error} />
      {!sid ? <Panel><Empty icon="trajectory">Create a study and run the collect stage to see trajectories.</Empty></Panel> : (
        <div className="grid gap-4 2xl:grid-cols-[420px_minmax(0,1fr)] fit:min-h-0 fit:flex-1 fit:grid-cols-[400px_minmax(0,1fr)] fit:gap-3">
          <Panel fill flush title="Episodes" prov={<Prov kind="measured" source="episodes/*.jsonl" />} right={<span className="num font-mono text-[10.5px] text-ink-3">{list.length} shown</span>}>
            <div className="space-y-2 border-b border-line p-3">
              <Segmented label="Split" value={splits.includes(split) ? split : (splits[0] ?? split)} onChange={(v) => { setSplit(v); setSrc(""); }} options={(splits.length ? splits : ["dev"]).map((s) => ({ value: s, label: s }))} />
              <div className="grid grid-cols-3 gap-2">
                <select className={inputCls} value={src} onChange={(e) => setSrc(e.target.value)} aria-label="Source"><option value="">all sources</option>{sources.map((s) => <option key={s} value={s}>{s.replace("|", " · s")}</option>)}</select>
                <select className={inputCls} value={fam} onChange={(e) => setFam(e.target.value)} aria-label="Family"><option value="">all families</option>{families.map((f) => <option key={f}>{f}</option>)}</select>
                <select className={inputCls} value={outcome} onChange={(e) => setOutcome(e.target.value as "all")} aria-label="Outcome"><option value="all">any outcome</option><option value="pass">strict ✓</option><option value="fail">strict ✕</option></select>
              </div>
            </div>
            {list.length === 0 ? <Empty>No episodes for this filter.</Empty> : (
              <div className="scroll-thin max-h-[640px] overflow-y-auto fit:max-h-none fit:overflow-visible">
                <table className="w-full text-[12px]">
                  <thead className="sticky top-0 bg-surface-2"><tr><th className={th}>Task</th><th className={th}>Source</th><th className={th}>Result</th><th className={cx(th, "text-right")}>Calls</th></tr></thead>
                  <tbody>{list.map((r) => (
                    <tr key={`${r.arm}${r.seed}${r.task_id}`} onClick={() => setSel(r)} className={cx(tr, "cursor-pointer", sel?.task_id === r.task_id && sel.arm === r.arm && sel.seed === r.seed && "!bg-accent-soft")}>
                      <td className={td}><div className="font-mono text-[11px] text-ink">{r.task_id}</div><div className="text-[10.5px] text-ink-3">{r.family}</div></td>
                      <td className={td}><Badge tone={ARM_TONE[r.arm] ?? "tuned"}>{r.arm}{r.arm !== "teacher" && r.arm !== "base" ? ` s${r.seed}` : ""}</Badge></td>
                      <td className={td}><Status s={r.strict_success ? "pass" : "fail"} label={r.strict_success ? "strict" : r.termination === "invalid_action" ? "invalid" : r.answer_correct ? "answer only" : "wrong"} /></td>
                      <td className={cx(td, "num text-right font-mono text-[11px]")}>{r.calls}</td>
                    </tr>))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
          {sel ? <EpisodeDetail key={`${sel.arm}${sel.seed}${sel.task_id}`} sid={sid} e={sel} /> : <Panel><Empty icon="trajectory">Select an episode.</Empty></Panel>}
        </div>
      )}
    </div>
  );
}

function EpisodeDetail({ sid, e }: { sid: string; e: EpisodeRow }) {
  const ep = useApi<{ episode: Record<string, unknown> & { score: Record<string, unknown>; usage: Record<string, number>; messages: unknown[] }; graph: PathGraphT }>(
    `/api/studies/${sid}/episode${qs({ arm: e.arm, split: e.split, seed: e.seed, task_id: e.task_id })}`);
  const cmp = useApi<CompareT>(`/api/studies/${sid}/compare${qs({ split: e.split, task_id: e.task_id, arm: ["teacher", "base", "oracle"].includes(e.arm) ? undefined : e.arm, seed: ["teacher", "base", "oracle"].includes(e.arm) ? undefined : e.seed })}`);
  const [node, setNode] = useState<{ lane: string; n: GraphNode } | null>(null);
  const [raw, setRaw] = useState(false);
  const d = ep.data;
  const color = e.arm === "teacher" ? "var(--s-teacher)" : e.arm === "base" ? "var(--s-base)" : "var(--s-tuned)";
  return (
    <div className="scroll-thin min-w-0 space-y-4 fit:grid fit:min-h-0 fit:content-start fit:gap-3 fit:space-y-0 fit:overflow-auto 3xl:fit:grid-cols-[minmax(0,1fr)_400px] 3xl:fit:overflow-hidden">
      <div className="scroll-thin space-y-4 fit:space-y-3 3xl:fit:min-h-0 3xl:fit:overflow-auto 3xl:fit:pr-1">
      <Panel title={e.task_id} eyebrow={`${e.arm}${["teacher", "base", "oracle"].includes(e.arm) ? "" : ` · seed ${e.seed}`} · ${e.split}`} prov={<Prov kind="measured" />}
        right={<Hash value={e.trace_hash} n={16} label="trace hash" />}>
        <ErrorLine error={ep.error} />
        {d && (
          <div className="space-y-4">
            <PathGraph g={d.graph} accent={color} selected={node?.lane === "self" ? node.n.id : null} onSelect={(n) => setNode({ lane: "self", n })} />
            <div className="grid gap-4 md:grid-cols-2">
              <KV rows={[["strict success", <Status key="s" s={d.graph.strict_success ? "pass" : "fail"} />], ["answer correct", String(d.episode.score.answer_correct)],
                ["tool selection", String(d.episode.score.tool_selection_correct)], ["argument accuracy", fmt.pct(d.episode.score.argument_accuracy as number, 0)],
                ["invalid calls", String(d.episode.score.invalid_calls)], ["unsupported answer", String(d.episode.score.unsupported_answer)]]} />
              <KV rows={[["termination", String(d.episode.termination)], ["latency", `${d.episode.usage.latency_ms} ms`], ["tokens in / out", `${d.episode.usage.prompt_tokens} / ${d.episode.usage.completion_tokens}`],
                ["reasoning stripped", `${d.episode.reasoning_blocks_stripped} block(s)`], ["model", String(d.episode.model)], ["errors", ((d.episode.score.errors as string[]) ?? []).join(", ") || "none"]]} />
            </div>
          </div>
        )}
      </Panel>
      <Panel title="Path comparison" eyebrow="teacher · base · tuned" prov={<Prov kind="computed" />} right={cmp.data && <Badge tone={cmp.data.outcome === "fixed" ? "good" : cmp.data.outcome === "regressed" ? "crit" : "default"}>{cmp.data.outcome}</Badge>}>
        <ErrorLine error={cmp.error} />
        {cmp.data && <PathCompare c={cmp.data} onSelect={(lane, n) => setNode({ lane, n })} />}
        {cmp.data && <div className="mt-2 text-[11px] text-ink-3">{cmp.data.honesty} Divergence is measured on the canonical action sequence (tool, arguments, answer).</div>}
      </Panel>
      </div>
      <div className="grid gap-4 xl:grid-cols-2 3xl:fit:flex 3xl:fit:min-h-0 3xl:fit:flex-col 3xl:fit:gap-3">
        <Panel fill title="Node inspector">
          {node ? (
            <div className="space-y-2"><div className="flex gap-2"><Badge>{node.lane}</Badge><Badge>{node.n.kind}</Badge><Status s={node.n.status === "neutral" ? "info" : node.n.status} /></div>
              <pre className="scroll-thin max-h-72 overflow-auto rounded bg-surface-2 3xl:fit:max-h-none p-2.5 font-mono text-[11px] text-ink-2">{JSON.stringify(node.n.detail, null, 2)}</pre></div>
          ) : <Empty>Click any node to see its exact payload.</Empty>}
        </Panel>
        <Panel fill title="Raw episode" right={<button type="button" className="micro text-accent" onClick={() => setRaw((r) => !r)}>{raw ? "hide" : "show"} JSON</button>}>
          {raw && d ? <pre className="scroll-thin max-h-96 overflow-auto rounded bg-surface-2 3xl:fit:max-h-none p-2.5 font-mono text-[10.5px] text-ink-2">{JSON.stringify(d.episode, null, 2)}</pre>
            : <div className="text-[12px] text-ink-3">Exact JSONL record as stored, including messages fed to the model (assistant turns are canonical JSON re-serializations; malformed text is never stored).</div>}
        </Panel>
      </div>
    </div>
  );
}
