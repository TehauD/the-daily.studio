import { useState } from "react";
import type { CompareT, GraphNode, LineageNode, LineageT, PathGraphT } from "../lib/types";
import { cx } from "./ui";

const NW = 158, NH = 62, GAP = 34;

function nodeText(n: GraphNode): string {
  if (n.kind === "tool_call") return JSON.stringify(n.detail).replace(/[{}"]/g, "").replace(/,/g, " ").slice(0, 34);
  if (n.kind === "tool_result") {
    const d = n.detail as Record<string, unknown>;
    if (Array.isArray(d?.results)) return `${(d.results as unknown[]).length} passages · ${(d.results as { id: string }[]).map((r) => r.id.split(":")[1]).join(",")}`;
    return d?.error ? String(d.error) : d?.total ? `total ${d.total}` : d?.unit_price ? `${d.name ?? ""} ${d.unit_price}` : "";
  }
  if (n.kind === "prompt") return String(n.detail ?? "").slice(0, 34) + (String(n.detail ?? "").length > 34 ? "…" : "");
  if (n.kind === "error") return String(n.detail ?? "").slice(0, 34);
  return "";
}

const KIND_LABEL: Record<string, string> = { prompt: "PROMPT", tool_call: "CALL", tool_result: "RESULT", answer: "ANSWER", error: "ERROR" };

function Node({ n, x, y, accent, selected, onClick }: { n: GraphNode; x: number; y: number; accent: string; selected: boolean; onClick: () => void }) {
  const stroke = n.status === "fail" ? "var(--crit)" : n.status === "pass" ? "var(--good)" : "var(--line-strong)";
  return (
    <g transform={`translate(${x},${y})`} onClick={onClick} className="cursor-pointer" role="button" aria-label={`${n.kind} ${n.label}`}>
      <rect width={NW} height={NH} rx={5} fill="var(--surface)" stroke={selected ? "var(--ink)" : stroke} strokeWidth={selected ? 1.75 : 1} />
      <rect width={3} height={NH - 10} x={0} y={5} rx={1.5} fill={n.kind === "prompt" ? "var(--ink-3)" : accent} />
      <text x={12} y={16} className="fill-[var(--ink-3)] font-mono text-[9px] tracking-[0.08em]">{KIND_LABEL[n.kind] ?? n.kind}</text>
      {n.status !== "neutral" && (
        <text x={NW - 10} y={16} textAnchor="end" className={cx("font-mono text-[10px]", n.status === "pass" ? "fill-[var(--good-ink)]" : "fill-[var(--crit-ink)]")}>
          {n.status === "pass" ? "✓ correct" : "✕ wrong"}
        </text>
      )}
      <text x={12} y={34} className="fill-[var(--ink)] font-mono text-[12px] font-medium">{n.label.slice(0, 18)}</text>
      <text x={12} y={50} className="fill-[var(--ink-2)] font-mono text-[10px]">{nodeText(n)}</text>
    </g>
  );
}

function Edge({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  return (
    <g>
      <path d={`M${x1},${y} C${x1 + GAP / 2},${y} ${x2 - GAP / 2},${y} ${x2 - 5},${y}`} fill="none" stroke="var(--line-strong)" strokeWidth={1.25} />
      <path d={`M${x2 - 6},${y - 3.5} L${x2},${y} L${x2 - 6},${y + 3.5}`} fill="var(--line-strong)" />
    </g>
  );
}

export function PathGraph({ g, accent = "var(--s-tuned)", onSelect, selected }: { g: PathGraphT; accent?: string; onSelect?: (n: GraphNode) => void; selected?: string | null }) {
  const W = g.nodes.length * (NW + GAP), H = NH + 8;
  return (
    <div className="scroll-thin overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W }} role="img" aria-label={`Path graph for ${g.task_id}`}>
        {g.nodes.map((n, i) => (
          <g key={n.id}>
            {i > 0 && <Edge x1={(i - 1) * (NW + GAP) + NW + 2} x2={i * (NW + GAP)} y={4 + NH / 2} />}
            <Node n={n} x={i * (NW + GAP) + 1} y={4} accent={accent} selected={selected === n.id} onClick={() => onSelect?.(n)} />
          </g>
        ))}
      </svg>
    </div>
  );
}

const LANES: Record<string, { color: string; label: string }> = {
  teacher: { color: "var(--s-teacher)", label: "Teacher" }, base: { color: "var(--s-base)", label: "Base student" },
  tuned: { color: "var(--s-tuned)", label: "Tuned student" },
};

/** Index of the node that carries action `k` (tool calls, answer, error are actions). */
function actionNodeIndex(g: PathGraphT, k: number): number | null {
  const idx = g.nodes.map((n, i) => (["tool_call", "answer", "error"].includes(n.kind) ? i : -1)).filter((i) => i >= 0);
  return k < idx.length ? idx[k] : g.nodes.length;
}

export function PathCompare({ c, onSelect }: { c: CompareT; onSelect?: (lane: string, n: GraphNode) => void }) {
  const [sel, setSel] = useState<string | null>(null);
  const maxN = Math.max(1, ...c.lanes.map((l) => l.graph?.nodes.length ?? 0));
  const LW = 120, laneH = NH + 30;
  const W = LW + maxN * (NW + GAP), H = c.lanes.length * laneH + 10;
  return (
    <div className="scroll-thin overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W }} role="img" aria-label={`Teacher, base, and tuned paths for ${c.task_id}`}>
        {c.lanes.map((lane, li) => {
          const y0 = li * laneH + 6;
          const meta = LANES[lane.lane];
          const g = lane.graph;
          const div = g && lane.divergence_from_teacher != null ? actionNodeIndex(g, lane.divergence_from_teacher) : null;
          return (
            <g key={lane.lane}>
              <rect x={0} y={y0 - 2} width={W} height={laneH - 6} rx={4} fill={li % 2 ? "transparent" : "var(--surface-2)"} />
              <rect x={6} y={y0 + 8} width={3} height={NH - 16} rx={1.5} fill={meta.color} />
              <text x={16} y={y0 + 22} className="fill-[var(--ink)] text-[12px] font-semibold">{meta.label}</text>
              <text x={16} y={y0 + 38} className="fill-[var(--ink-3)] font-mono text-[10px]">
                {g ? (g.strict_success ? "✓ strict success" : "✕ not strict") : "not run"}
              </text>
              {g && lane.lane !== "teacher" && (
                <text x={16} y={y0 + 52} className="fill-[var(--ink-3)] font-mono text-[10px]">
                  {lane.divergence_from_teacher == null ? "= teacher path" : `diverges @ action ${lane.divergence_from_teacher + 1}`}
                </text>
              )}
              {g?.nodes.map((n, i) => (
                <g key={n.id}>
                  {i > 0 && <Edge x1={LW + (i - 1) * (NW + GAP) + NW + 2} x2={LW + i * (NW + GAP)} y={y0 + 4 + NH / 2} />}
                  <Node n={n} x={LW + i * (NW + GAP)} y={y0 + 4} accent={meta.color} selected={sel === `${lane.lane}:${n.id}`}
                    onClick={() => { setSel(`${lane.lane}:${n.id}`); onSelect?.(lane.lane, n); }} />
                </g>
              ))}
              {div != null && (
                <g>
                  <line x1={LW + div * (NW + GAP) - GAP / 2} x2={LW + div * (NW + GAP) - GAP / 2} y1={y0} y2={y0 + NH + 10} stroke="var(--crit)" strokeWidth={1.5} />
                  <text x={LW + div * (NW + GAP) - GAP / 2 + 4} y={y0 + NH + 18} className="fill-[var(--crit-ink)] font-mono text-[9.5px]">first divergence</text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const LKIND: Record<string, string> = { base_model: "BASE MODEL", teacher: "TEACHER", plan: "FROZEN PLAN", dataset: "DATASET", config: "CONFIG", adapter: "ADAPTER", report: "REPORT", export: "MERGED EXPORT" };

export function LineageGraph({ g, onOpen }: { g: LineageT; onOpen?: (n: LineageNode) => void }) {
  const BW = 176, BH = 56;
  const pos = new Map(g.nodes.map((n) => [n.id, n]));
  const W = g.width + 20, H = g.height + 10;
  return (
    <div className="scroll-thin overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: Math.max(W, 600) }} role="img" aria-label="Artifact lineage">
        {g.edges.map((e, i) => {
          const a = pos.get(e.from), b = pos.get(e.to);
          if (!a || !b) return null;
          const x1 = a.x + BW + 4, y1 = a.y + BH / 2 + 4, x2 = b.x + 4, y2 = b.y + BH / 2 + 4;
          return <path key={i} d={`M${x1},${y1} C${x1 + 14},${y1} ${x2 - 14},${y2} ${x2},${y2}`} fill="none" stroke="var(--line-strong)" strokeWidth={1.2} />;
        })}
        {g.nodes.map((n) => (
          <g key={n.id} transform={`translate(${n.x + 4},${n.y + 4})`} onClick={() => onOpen?.(n)} className={n.path ? "cursor-pointer" : ""} role="button" aria-label={`${n.kind} ${n.label}`}>
            <rect width={BW} height={BH} rx={5} fill="var(--surface)" stroke={n.exists || n.kind === "teacher" ? "var(--line-strong)" : "var(--line)"} strokeDasharray={n.exists || n.kind === "teacher" ? undefined : "3 3"} />
            <text x={10} y={15} className="fill-[var(--ink-3)] font-mono text-[8.5px] tracking-[0.08em]">{LKIND[n.kind] ?? n.kind}</text>
            <text x={10} y={32} className="fill-[var(--ink)] text-[11.5px] font-medium">{n.label.slice(0, 24)}</text>
            <text x={10} y={47} className="fill-[var(--ink-2)] font-mono text-[9.5px]">{n.digest ? `sha ${n.digest.slice(0, 14)}` : n.exists ? "" : n.kind === "teacher" ? "external · served by provider" : "not produced yet"}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
