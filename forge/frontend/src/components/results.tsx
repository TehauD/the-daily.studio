import type { ReactNode } from "react";
import { Icon } from "./icons";
import { cx } from "./ui";

/** Shared, clinical-grade result components: one way to show a measured rate, its uncertainty, what it doesn't show, and a
 *  fully labelled figure — used identically on every page. */

export const fmtPct = (v: number | null | undefined, digits = 0) => (v == null || Number.isNaN(v) ? "—" : `${(v * 100).toFixed(digits)}%`);

/** Inline 95 % range bar: the shaded band is the interval, the tick is the observed rate. */
export function RangeBar({ rate, ci, className = "", label }: { rate: number | null | undefined; ci?: [number, number] | number[] | null; className?: string; label?: string }) {
  if (rate == null) return <span className="text-ink-3">—</span>;
  const lo = ci?.[0], hi = ci?.[1];
  const text = `${label ? `${label}: ` : ""}${fmtPct(rate)}${lo != null && hi != null ? `, 95% range ${fmtPct(lo)} to ${fmtPct(hi)}` : ""}`;
  return (
    <span className={cx("relative block h-1.5 w-full rounded-full bg-surface-3", className)} role="img" aria-label={text} title={text}>
      {lo != null && hi != null && <span className="absolute top-0 h-1.5 rounded-full bg-accent/35" style={{ left: `${lo * 100}%`, width: `${Math.max(0.5, (hi - lo) * 100)}%` }} />}
      <span className="absolute -top-0.5 h-2.5 w-[2px] rounded bg-accent" style={{ left: `calc(${Math.min(1, Math.max(0, rate)) * 100}% - 1px)` }} />
    </span>
  );
}

/** A measured rate with its 95 % range and counts. Always shows the uncertainty; never just a bare number. */
export function Score({ label, rate, ci, k, n, sub, size = "md", tone = "default" }: {
  label: ReactNode; rate: number | null | undefined; ci?: [number, number] | number[] | null; k?: number; n?: number; sub?: ReactNode;
  size?: "sm" | "md" | "lg"; tone?: "default" | "good" | "crit" | "muted" }) {
  const big = { sm: "text-[16px]", md: "text-[22px]", lg: "text-[30px]" }[size];
  const color = { default: "text-ink", good: "text-good-ink", crit: "text-crit-ink", muted: "text-ink-3" }[tone];
  return (
    <div className="min-w-0">
      <div className="micro truncate text-ink-3">{label}</div>
      <div className={cx("num mt-0.5 font-mono font-medium leading-none", big, color)}>{fmtPct(rate)}</div>
      <RangeBar rate={rate} ci={ci} className="mt-1.5" label={typeof label === "string" ? label : undefined} />
      <div className="mt-1 font-mono text-[10.5px] text-ink-3">
        {ci ? `95% ${fmtPct(ci[0])}–${fmtPct(ci[1])}` : "no range"}{n != null ? ` · ${k != null ? `${k}/` : "n="}${n}` : ""}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-ink-3">{sub}</div>}
    </div>
  );
}

/** "What this doesn't show" — the standard honesty block. */
export function Limits({ children, title = "What this doesn't show" }: { children: ReactNode; title?: string }) {
  return (
    <aside className="flex gap-2 rounded-[var(--radius)] border border-line bg-surface-2 px-3 py-2 text-[12px] leading-relaxed text-ink-2" aria-label={title}>
      <Icon name="info" size={14} className="mt-0.5 shrink-0 text-ink-3" />
      <div><b className="font-medium text-ink">{title}.</b> {children}</div>
    </aside>
  );
}

/** A fully labelled figure: title, what is plotted, axis titles with units, legend, and a caption — for every chart. */
export function Figure({ title, subtitle, x, y, legend, caption, children, className = "" }: {
  title: string; subtitle?: ReactNode; x?: string; y?: string; legend?: { label: string; color: string; dashed?: boolean }[]; caption?: ReactNode;
  children: ReactNode; className?: string }) {
  return (
    <figure className={cx("min-w-0", className)} aria-label={title}>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
        <div className="text-[12.5px] font-medium text-ink">{title}</div>
        {subtitle && <div className="text-[11px] text-ink-3">{subtitle}</div>}
      </div>
      <div className="flex min-w-0 items-stretch gap-1">
        {y && <div className="flex w-4 shrink-0 items-center justify-center"><span className="-rotate-90 whitespace-nowrap text-[10.5px] text-ink-3">{y}</span></div>}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {x && <div className="mt-0.5 text-center text-[10.5px] text-ink-3">{x}</div>}
      {legend && legend.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-2" aria-label="Legend">
          {legend.map((l) => <li key={l.label} className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4" style={{ background: l.color, borderTop: l.dashed ? `2px dashed ${l.color}` : undefined, height: l.dashed ? 0 : undefined }} />{l.label}</li>)}
        </ul>)}
      {caption && <figcaption className="mt-1.5 text-[11px] leading-relaxed text-ink-3">{caption}</figcaption>}
    </figure>
  );
}
