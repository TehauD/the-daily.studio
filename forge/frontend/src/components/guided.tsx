import type { ReactNode } from "react";
import { Icon } from "./icons";
import { Panel, cx } from "./ui";

export interface GuideStep<K extends string> { key: K; title: string; line: string }

/** Step bar for guided workflows: done steps are ticked, locked steps are disabled until reachable. */
export function Journey<K extends string>({ steps, cur, reached, done, onPick }: {
  steps: readonly GuideStep<K>[]; cur: K; reached: Record<K, boolean>; done: Record<K, boolean>; onPick: (k: K) => void;
}) {
  return (
    <ol className="grid gap-2 sm:grid-cols-5 fit:shrink-0" aria-label="Steps">
      {steps.map((j, i) => {
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

/** Plain-language side panel: a small flow diagram with the parts this step works on highlighted, then a glossary. */
export function Explainer({ stage, total, nodes, lit, title, body, terms, label }: {
  stage: number; total: number; nodes: string[]; lit: number[]; title: string; body: ReactNode; terms: [string, string][]; label: string;
}) {
  const w = (340 - 4 * 2 - (nodes.length - 1) * 10) / nodes.length;
  return (
    <Panel fill title="What's happening" eyebrow={`step ${stage} of ${total}`} className="fit:min-h-0">
      <div className="space-y-4">
        <svg viewBox="0 0 340 66" className="w-full" role="img" aria-label={label}>
          {nodes.map((n, i) => {
            const x = 4 + i * (w + 10), on = lit.includes(i);
            return (
              <g key={n}>
                {i > 0 && <line x1={x - 10} x2={x} y1={28} y2={28} stroke={on && lit.includes(i - 1) ? "var(--accent)" : "var(--line-strong)"} strokeWidth={1.5} />}
                <rect x={x} y={12} width={w} height={32} rx={6} fill={on ? "var(--accent-soft)" : "var(--surface-2)"} stroke={on ? "var(--accent)" : "var(--line)"} />
                <text x={x + w / 2} y={32} textAnchor="middle" fontSize={8.5} fill={on ? "var(--ink)" : "var(--ink-3)"} fontFamily="Inter,system-ui,sans-serif">{n}</text>
              </g>
            );
          })}
          <text x={4} y={60} fontSize={8} fill="var(--ink-3)" fontFamily="Inter,system-ui,sans-serif">highlighted: what this step works on</text>
        </svg>
        <h3 className="text-[14px] font-semibold text-ink">{title}</h3>
        <div className="text-[13px] leading-relaxed text-ink-2 [&_b]:font-semibold [&_b]:text-ink">{body}</div>
        <dl className="space-y-2 border-t border-line pt-3">
          {terms.map(([k, v]) => <div key={k}><dt className="text-[12px] font-semibold text-ink">{k}</dt><dd className="text-[12px] text-ink-3">{v}</dd></div>)}
        </dl>
      </div>
    </Panel>
  );
}
