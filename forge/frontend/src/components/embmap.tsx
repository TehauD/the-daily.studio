import { useMemo, useState } from "react";
import { fmt } from "../lib/api";
import { AskAI } from "../lib/assistant";
import { useApi } from "../lib/hooks";
import { Badge, Empty, Notice, Panel, Prov, Readout, Segmented, Skeleton, cx } from "./ui";

export interface MapQuestion {
  task_id: string; prompt: string; family: string; split: string; x: number; y: number; gold: number | null;
  retrieved: number[]; retrieved_detail: { i: number; keyword_rank?: number; vector_rank?: number; similarity?: number }[];
  hit: boolean | null; gold_similarity: number | null; gold_vector_rank: number | null; top_similarity: number;
}
export interface MapT {
  model: string; dim: number; mode: string; k: number; generated_at: string;
  projection: { method: string; explained_variance: number[]; neighbour_preservation: number | null; neighbours: number };
  docs: { doc_id: string; title: string; color: number }[];
  passages: { i: number; chunk_id: string; doc: number; x: number; y: number; text: string }[];
  questions: MapQuestion[]; retrieval_hit_rate: number; note: string | null; honesty: string;
}

const CATS = 8;
const docColor = (i: number) => (i < CATS ? `var(--cat-${i + 1})` : "var(--ink-3)");
const W = 760, H = 460, PAD = 18;

/** Passages and questions on a PCA plane; the student's real search results are drawn for the selected question. */
export function EmbeddingMap({ pid }: { pid: string }) {
  const m = useApi<MapT>(`/api/knowledge/${pid}/map`);
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "miss" | "neg">("all");
  const d = m.data;
  const scale = useMemo(() => {
    if (!d) return null;
    const pts = [...d.passages, ...d.questions];
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const s = Math.min((W - 2 * PAD) / (x1 - x0 || 1), (H - 2 * PAD) / (y1 - y0 || 1));
    const ox = (W - s * (x1 - x0)) / 2, oy = (H - s * (y1 - y0)) / 2;
    return { x: (v: number) => ox + (v - x0) * s, y: (v: number) => H - (oy + (v - y0) * s) };
  }, [d]);
  if (m.error) return <Panel title="Map of meaning" eyebrow="embedding space"><Notice tone="info">{m.error.replace(/^\d+\s*/, "")}</Notice></Panel>;
  if (!d || !scale) return <Panel title="Map of meaning" eyebrow="embedding space"><Skeleton h={320} /></Panel>;
  const q = d.questions.find((x) => x.task_id === sel) ?? null;
  const list = d.questions.filter((x) => filter === "all" || (filter === "miss" ? x.hit === false : x.gold === null));
  const misses = d.questions.filter((x) => x.hit === false).length;
  const ev = d.projection.explained_variance.reduce((a, b) => a + b, 0);
  const hp = hover != null ? d.passages[hover] : null;
  const title = (i: number) => d.docs[d.passages[i].doc]?.title ?? "";
  return (
    <Panel title="Map of meaning" eyebrow="embedding space · every passage and question" prov={<Prov kind="computed" source={`${d.model} · ${d.dim}-d → PCA 2-d`} />}
      right={<AskAI q="Look at the questions search missed. Explain why each was missed and what would fix it (chunk size, embedding model, wording)." content label="Why does search miss?" />}>
      <div className="space-y-3">
        <p className="text-[12.5px] leading-relaxed text-ink-2">
          Each dot is a passage, coloured by document; each <b className="font-medium text-ink">◆</b> is a practice question. Passages that mean similar things sit close together.
          Click a question to see the passages the student's search actually returns (numbered lines) and where the right passage is (dashed, if search missed it).
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Readout size="sm" label="Search found the right passage" value={fmt.pct(d.retrieval_hit_rate, 0)} sub={`${misses} miss${misses === 1 ? "" : "es"} · top ${d.k}, ${d.mode}`} />
          <Readout size="sm" label="Neighbours kept on the map" value={fmt.pct(d.projection.neighbour_preservation, 0)} sub={`${d.projection.neighbours} nearest, full space vs 2-d`} />
          <Readout size="sm" label="Variance shown (2 axes)" value={fmt.pct(ev, 0)} sub="the rest is flattened away" />
          <Readout size="sm" label="Points" value={`${d.passages.length} · ${d.questions.length}`} sub="passages · questions" />
        </div>
        {d.note && <Notice tone="warn">{d.note}</Notice>}
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="relative min-w-0 rounded-[var(--radius)] border border-line bg-surface">
            <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="2D map of passage and question embeddings">
              {q && q.retrieved.map((pi, r) => (
                <line key={pi} x1={scale.x(q.x)} y1={scale.y(q.y)} x2={scale.x(d.passages[pi].x)} y2={scale.y(d.passages[pi].y)}
                  stroke={pi === q.gold ? "var(--good)" : "var(--ink-2)"} strokeWidth={2} opacity={0.85 - r * 0.15} />
              ))}
              {q && q.gold != null && !q.retrieved.includes(q.gold) && (
                <line x1={scale.x(q.x)} y1={scale.y(q.y)} x2={scale.x(d.passages[q.gold].x)} y2={scale.y(d.passages[q.gold].y)} stroke="var(--crit)" strokeWidth={2} strokeDasharray="5 4" />
              )}
              {d.passages.map((p) => {
                const inQ = q && (q.retrieved.includes(p.i) || q.gold === p.i);
                return (
                  <g key={p.i} onMouseEnter={() => setHover(p.i)} onMouseLeave={() => setHover(null)}>
                    <circle cx={scale.x(p.x)} cy={scale.y(p.y)} r={12} fill="transparent" />
                    <circle cx={scale.x(p.x)} cy={scale.y(p.y)} r={inQ ? 6.5 : 4.5} fill={docColor(p.doc)} stroke="var(--surface)" strokeWidth={2}
                      opacity={q && !inQ ? 0.28 : 0.95} />
                    {q?.gold === p.i && <circle cx={scale.x(p.x)} cy={scale.y(p.y)} r={10} fill="none" stroke={q.hit ? "var(--good)" : "var(--crit)"} strokeWidth={2} />}
                  </g>
                );
              })}
              {q && q.retrieved.map((pi, r) => (
                <text key={`n${pi}`} x={scale.x(d.passages[pi].x) + 9} y={scale.y(d.passages[pi].y) - 8} className="num" fontSize={11} fontFamily="var(--font-mono)" fill="var(--ink)">#{r + 1}</text>
              ))}
              {d.questions.map((x) => {
                const on = x.task_id === sel;
                const c = x.gold === null ? "var(--ink-3)" : x.hit ? "var(--good)" : "var(--crit)";
                const cx_ = scale.x(x.x), cy_ = scale.y(x.y), s = on ? 7 : 4.5;
                return (
                  <g key={x.task_id} onClick={() => setSel(on ? null : x.task_id)} className="cursor-pointer">
                    <circle cx={cx_} cy={cy_} r={11} fill="transparent" />
                    <path d={`M${cx_} ${cy_ - s}L${cx_ + s} ${cy_}L${cx_} ${cy_ + s}L${cx_ - s} ${cy_}Z`} fill={x.gold === null ? "var(--surface)" : c} stroke={on ? "var(--ink)" : c}
                      strokeWidth={on ? 2 : 1.5} opacity={sel && !on ? 0.35 : 1} />
                  </g>
                );
              })}
            </svg>
            {hp && (
              <div className="pointer-events-none absolute left-2 top-2 max-w-[60%] rounded-[var(--radius)] border border-line bg-surface p-2 shadow-[var(--shadow)]">
                <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-ink"><span className="h-2.5 w-2.5 rounded-full" style={{ background: docColor(hp.doc) }} />{title(hp.i)}</div>
                <div className="mt-1 line-clamp-4 text-[11px] leading-snug text-ink-2">{hp.text}</div>
              </div>
            )}
            <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-line px-3 py-2 text-[11px] text-ink-2">
              {d.docs.slice(0, CATS).map((x) => <span key={x.doc_id} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: docColor(x.color) }} />{x.title}</span>)}
              {d.docs.length > CATS && <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-ink-3" />{d.docs.length - CATS} more documents</span>}
              <span className="ml-auto inline-flex items-center gap-3 text-ink-3"><span>◆ <span className="text-good-ink">found</span> / <span className="text-crit-ink">missed</span></span><span>◇ has no answer</span></span>
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <Segmented label="Question filter" value={filter} onChange={setFilter} options={[{ value: "all", label: "all" }, { value: "miss", label: `missed (${misses})` }, { value: "neg", label: "no answer" }]} />
            {q ? <QuestionDetail q={q} d={d} onClose={() => setSel(null)} /> : (
              <div className="scroll-thin max-h-[380px] overflow-auto rounded-[var(--radius)] border border-line">
                {list.length === 0 ? <Empty>No questions in this view.</Empty> : list.map((x) => (
                  <button key={x.task_id} type="button" onClick={() => setSel(x.task_id)} className="block w-full border-b border-line px-2.5 py-2 text-left last:border-0 hover:bg-surface-2">
                    <div className="flex items-center gap-1.5">
                      <span className={cx("text-[11px]", x.gold === null ? "text-ink-3" : x.hit ? "text-good-ink" : "text-crit-ink")}>{x.gold === null ? "◇" : "◆"}</span>
                      <span className="line-clamp-2 text-[12px] text-ink">{x.prompt}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="text-[11px] text-ink-3">{d.honesty}</div>
      </div>
    </Panel>
  );
}

function QuestionDetail({ q, d, onClose }: { q: MapQuestion; d: MapT; onClose: () => void }) {
  const doc = (i: number) => d.docs[d.passages[i].doc]?.title ?? "";
  return (
    <div className="space-y-2 rounded-[var(--radius)] border border-line p-2.5">
      <div className="flex items-start gap-2">
        <div className="flex-1 text-[12.5px] font-medium text-ink">{q.prompt}</div>
        <button type="button" className="micro text-accent" onClick={onClose}>back</button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge>{q.split}</Badge>
        {q.gold === null ? <Badge>no answer in documents</Badge> : q.hit ? <Badge tone="good">search finds it</Badge> : <Badge tone="crit">search misses it</Badge>}
      </div>
      <div className="micro text-ink-3">what search returns (top {d.k})</div>
      <ol className="space-y-1.5">
        {q.retrieved_detail.map((r, n) => (
          <li key={r.i} className={cx("rounded border px-2 py-1.5", r.i === q.gold ? "border-good bg-surface-2" : "border-line")}>
            <div className="flex items-center gap-1.5 text-[11.5px]"><span className="num font-mono text-ink-3">#{n + 1}</span>
              <span className="h-2 w-2 rounded-full" style={{ background: docColor(d.passages[r.i].doc) }} /><span className="truncate font-medium text-ink">{doc(r.i)}</span>
              {r.i === q.gold && <span className="ml-auto text-[10.5px] text-good-ink">✓ right passage</span>}</div>
            <div className="num mt-0.5 font-mono text-[10.5px] text-ink-3">{[r.keyword_rank && `keywords #${r.keyword_rank}`, r.vector_rank && `meaning #${r.vector_rank}`, r.similarity != null && `cos ${r.similarity.toFixed(3)}`].filter(Boolean).join(" · ") || "—"}</div>
          </li>
        ))}
      </ol>
      {q.gold != null && (
        <div className="text-[11.5px] leading-relaxed text-ink-2">
          Right passage ({doc(q.gold)}): meaning rank <b className="num font-mono text-ink">#{q.gold_vector_rank}</b> of {d.passages.length}, cosine <span className="num font-mono">{q.gold_similarity?.toFixed(3)}</span> (best match {q.top_similarity.toFixed(3)}).
          {!q.hit && " The student cannot answer this one unless search improves — try smaller passages, keyword + meaning, or rewording the question."}
        </div>
      )}
      {q.gold === null && <div className="text-[11.5px] text-ink-2">No passage contains this answer; the right behaviour is to search and then say NOT_FOUND. Best cosine match is {q.top_similarity.toFixed(3)}.</div>}
    </div>
  );
}
