import { useState, type ReactNode } from "react";
import type { CapStatus } from "../lib/types";
import { Icon, type IconName } from "./icons";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

/* ---------------------------------------------------------------- provenance */
export type ProvKind = "measured" | "computed" | "declared" | "estimate" | "illustration" | "stale";
const PROV: Record<ProvKind, string> = {
  measured: "text-good-ink border-[color:var(--good)]/40",
  computed: "text-[color:var(--s-teacher)] border-[color:var(--s-teacher)]/40",
  declared: "text-ink-2 border-line-strong",
  estimate: "text-warn-ink border-[color:var(--warn)]/50",
  illustration: "text-ink-3 border-line-strong border-dashed",
  stale: "text-crit-ink border-[color:var(--crit)]/40",
};
/** Every number states where it came from. */
export function Prov({ kind, source }: { kind: ProvKind; source?: string }) {
  return (
    <span title={source ? `${kind} · ${source}` : kind}
      className={cx("micro inline-flex items-center gap-1 rounded-[3px] border px-1.5 py-[1px] !text-[9.5px] leading-[14px]", PROV[kind])}>
      {kind}{source && <span className="normal-case tracking-normal opacity-80">· {source}</span>}
    </span>
  );
}

/* ---------------------------------------------------------------- frame */
/** `fill`: in fit layouts the panel stretches to its grid cell and its body scrolls internally. */
export function Panel({ title, eyebrow, right, prov, children, className = "", flush = false, id, fill = false, bodyClass = "" }: {
  title?: ReactNode; eyebrow?: string; right?: ReactNode; prov?: ReactNode; children: ReactNode; className?: string; flush?: boolean;
  id?: string; fill?: boolean; bodyClass?: string;
}) {
  return (
    <section id={id} className={cx("reg min-w-0 rounded-[var(--radius)] border border-line bg-surface shadow-[var(--shadow)]",
      fill && "fit:flex fit:min-h-0 fit:flex-col", className)}>
      {(title || right || prov) && (
        <header className="flex min-h-10 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line px-[var(--pad)] py-2">
          <div className="flex min-w-0 items-baseline gap-2">
            {eyebrow && <span className="micro text-ink-3">{eyebrow}</span>}
            {title && <h2 className="truncate text-[13px] font-semibold tracking-tight text-ink">{title}</h2>}
            {prov}
          </div>
          {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
        </header>
      )}
      <div className={cx(flush ? "" : "p-[var(--pad)]", fill && "scroll-thin fit:min-h-0 fit:flex-1 fit:overflow-auto", bodyClass)}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, kicker, subtitle, right }: { title: string; kicker?: string; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-5 flex shrink-0 flex-wrap items-end justify-between gap-4 border-b border-line pb-4 fit:mb-3 fit:items-center fit:pb-3">
      <div className="min-w-0 fit:flex fit:items-baseline fit:gap-4">
        {kicker && <div className="micro mb-1 text-accent fit:mb-0">{kicker}</div>}
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.015em] text-ink fit:shrink-0 fit:text-[19px]">{title}</h1>
        {subtitle && <p title={typeof subtitle === "string" ? subtitle : undefined} className="mt-1 max-w-3xl text-[13px] leading-relaxed text-ink-2 fit:mt-0 fit:line-clamp-1 fit:max-w-[70ch] fit:text-[12px] fit:text-ink-3">{subtitle}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- readouts */
export function Readout({ label, value, unit, sub, tone = "default", size = "md", prov }: {
  label: ReactNode; value: ReactNode; unit?: string; sub?: ReactNode; tone?: "default" | "accent" | "good" | "crit" | "muted";
  size?: "sm" | "md" | "lg"; prov?: ReactNode;
}) {
  const color = { default: "text-ink", accent: "text-accent", good: "text-good-ink", crit: "text-crit-ink", muted: "text-ink-3" }[tone];
  const sz = { sm: "text-[15px]", md: "text-[22px]", lg: "text-[34px]" }[size];
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5"><span className="micro text-ink-3">{label}</span>{prov}</div>
      <div className={cx("num mt-1 flex items-baseline gap-1 font-mono font-medium leading-none tracking-[-0.02em]", sz, color)}>
        <span className="truncate">{value}</span>{unit && <span className="text-[11px] font-normal tracking-normal text-ink-3">{unit}</span>}
      </div>
      {sub && <div className="mt-1.5 truncate text-[11.5px] text-ink-3">{sub}</div>}
    </div>
  );
}

const STATUS: Record<string, { icon: IconName; cls: string; label: string }> = {
  pass: { icon: "check", cls: "text-good-ink", label: "pass" },
  supported: { icon: "check", cls: "text-good-ink", label: "supported" },
  completed: { icon: "check", cls: "text-good-ink", label: "completed" },
  warn: { icon: "alert", cls: "text-warn-ink", label: "warn" },
  conditional: { icon: "alert", cls: "text-warn-ink", label: "conditional" },
  fail: { icon: "x", cls: "text-crit-ink", label: "fail" },
  failed: { icon: "x", cls: "text-crit-ink", label: "failed" },
  unsupported: { icon: "x", cls: "text-ink-3", label: "unsupported" },
  info: { icon: "info", cls: "text-ink-2", label: "info" },
  unknown: { icon: "question", cls: "text-ink-3", label: "unknown" },
  skip: { icon: "dot", cls: "text-ink-3", label: "skipped" },
  running: { icon: "refresh", cls: "text-accent", label: "running" },
  pending: { icon: "dot", cls: "text-ink-3", label: "pending" },
  cancelled: { icon: "stop", cls: "text-ink-3", label: "cancelled" },
  cancelling: { icon: "stop", cls: "text-warn-ink", label: "cancelling" },
  interrupted: { icon: "alert", cls: "text-warn-ink", label: "interrupted" },
};
/** Status is never color alone: glyph + word. */
export function Status({ s, label, compact = false }: { s: string; label?: string; compact?: boolean }) {
  const st = STATUS[s] ?? STATUS.unknown;
  return (
    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap font-mono text-[11px]", st.cls)} title={label ?? st.label}>
      <Icon name={st.icon} size={13} className={s === "running" ? "animate-spin [animation-duration:2s]" : ""} />
      {!compact && <span>{label ?? st.label}</span>}
    </span>
  );
}

export function CapCell({ status, reason }: { status: CapStatus; reason: string }) {
  const m = { supported: "●", conditional: "◐", unsupported: "○", unknown: "?" }[status];
  const cls = { supported: "text-good-ink", conditional: "text-warn-ink", unsupported: "text-ink-3/60", unknown: "text-ink-3" }[status];
  return <span title={`${status}: ${reason}`} aria-label={`${status}: ${reason}`} className={cx("font-mono text-[13px]", cls)}>{m}</span>;
}

export function Badge({ children, tone = "default", title }: { children: ReactNode; tone?: "default" | "accent" | "good" | "warn" | "crit" | "teacher" | "base" | "tuned"; title?: string }) {
  const t = {
    default: "border-line-strong text-ink-2", accent: "border-accent-line text-accent bg-accent-soft",
    good: "border-[color:var(--good)]/40 text-good-ink", warn: "border-[color:var(--warn)]/60 text-warn-ink",
    crit: "border-[color:var(--crit)]/40 text-crit-ink", teacher: "border-teacher/50 text-teacher",
    base: "border-base/50 text-base", tuned: "border-tuned/60 text-tuned",
  }[tone];
  return <span title={title} className={cx("micro inline-flex items-center gap-1 whitespace-nowrap rounded-[3px] border px-1.5 py-[2px] !text-[9.5px]", t)}>{children}</span>;
}

/* ---------------------------------------------------------------- controls */
export function Button({ children, onClick, disabled, tone = "default", type = "button", icon, size = "md", title, busy }: {
  children?: ReactNode; onClick?: () => void; disabled?: boolean; tone?: "default" | "primary" | "danger" | "ghost";
  type?: "button" | "submit"; icon?: IconName; size?: "sm" | "md"; title?: string; busy?: boolean;
}) {
  const t = {
    default: "border-line-strong bg-surface text-ink hover:border-accent-line hover:bg-accent-soft",
    primary: "border-transparent bg-accent text-accent-ink hover:brightness-110",
    danger: "border-[color:var(--crit)]/40 bg-surface text-crit-ink hover:bg-[color:var(--crit)]/8",
    ghost: "border-transparent text-ink-2 hover:bg-surface-3 hover:text-ink",
  }[tone];
  const s = size === "sm" ? "h-7 px-2.5 text-[11.5px]" : "h-8 px-3 text-[12.5px]";
  return (
    <button type={type} onClick={onClick} disabled={disabled || busy} title={title}
      className={cx("relative inline-flex select-none items-center justify-center gap-1.5 overflow-hidden rounded-[calc(var(--radius)-1px)] border font-medium transition-[background,border,filter] disabled:cursor-not-allowed disabled:opacity-45", s, t)}>
      {icon && <Icon name={icon} size={14} />}{children}
      {busy && <span className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden"><span className="sweep block h-full w-1/3 bg-current opacity-60" /></span>}
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-[var(--radius)] border border-line bg-surface-2 p-0.5">
      {options.map((o) => (
        // Explicit aria-label: Segmented often sits inside a <label> (Field), which would otherwise name the FIRST option.
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          aria-label={typeof o.label === "string" ? o.label : o.value}
          className={cx("h-7 rounded-[calc(var(--radius)-2px)] px-2.5 text-[12px] transition", value === o.value ? "bg-surface text-ink shadow-[var(--shadow)] ring-1 ring-line" : "text-ink-3 hover:text-ink")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const inputCls = "h-8 w-full rounded-[calc(var(--radius)-1px)] border border-line-strong bg-surface px-2.5 font-mono text-[12px] text-ink outline-none transition placeholder:text-ink-3 focus:border-accent focus:ring-2 focus:ring-accent-soft";

/** `math` keeps case: uppercasing would turn α into A and σ into Σ. */
export function Field({ label, hint, children, math = false }: { label: string; hint?: ReactNode; children: ReactNode; math?: boolean }) {
  return (
    <label className="block">
      <span className={cx("micro mb-1 block text-ink-3", math && "!normal-case !tracking-normal")}>{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-3">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-2">
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={cx("relative h-[18px] w-8 rounded-full border transition", checked ? "border-accent bg-accent" : "border-line-strong bg-surface-3")}>
        <span className={cx("absolute top-[1px] h-[14px] w-[14px] rounded-full bg-surface shadow transition-all", checked ? "left-[15px]" : "left-[1px]")} />
      </button>
      {label}
    </label>
  );
}

export function Tabs<T extends string>({ value, tabs, onChange }: { value: T; tabs: { value: T; label: ReactNode; count?: number }[]; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="flex gap-0.5 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} type="button" onClick={() => onChange(t.value)}
          className={cx("-mb-px flex h-9 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-[12.5px] transition",
            value === t.value ? "border-accent font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink")}>
          {t.label}{t.count != null && <span className="num rounded bg-surface-3 px-1 font-mono text-[10px] text-ink-2">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- feedback */
export function ErrorLine({ error, onRetry }: { error: string | null | undefined; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-[var(--radius)] border border-[color:var(--crit)]/35 bg-[color:var(--crit)]/[0.05] px-3 py-2 text-[12.5px] text-crit-ink">
      <Icon name="alert" size={15} className="mt-0.5" /><span className="min-w-0 flex-1 break-words font-mono text-[11.5px]">{error}</span>
      {onRetry && <button type="button" onClick={onRetry} className="micro underline">retry</button>}
    </div>
  );
}

export function Notice({ children, tone = "info", icon }: { children: ReactNode; tone?: "info" | "warn" | "honesty"; icon?: IconName }) {
  const cls = { info: "border-line bg-surface-2 text-ink-2", warn: "border-[color:var(--warn)]/50 bg-[color:var(--warn)]/[0.07] text-ink-2",
    honesty: "border-teacher/30 bg-teacher/[0.05] text-ink-2" }[tone];
  return (
    <div className={cx("flex items-start gap-2.5 rounded-[var(--radius)] border px-3 py-2.5 text-[12.5px] leading-relaxed", cls)}>
      <Icon name={icon ?? (tone === "warn" ? "alert" : "info")} size={15} className="mt-0.5 text-ink-3" /><div className="min-w-0">{children}</div>
    </div>
  );
}

export function Empty({ children, icon = "dot" }: { children: ReactNode; icon?: IconName }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-9 text-center text-[12.5px] text-ink-3">
      <Icon name={icon} size={20} className="opacity-60" /><div className="max-w-md">{children}</div>
    </div>
  );
}

export function Skeleton({ h = 16, w = "100%" }: { h?: number; w?: number | string }) {
  return <div className="relative overflow-hidden rounded bg-surface-3" style={{ height: h, width: w }}><div className="sweep absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-surface/70 to-transparent" /></div>;
}

export function Meter({ pct, warnAt = 80, critAt = 90, label }: { pct: number | null; warnAt?: number; critAt?: number; label?: string }) {
  const tone = pct == null ? "bg-line-strong" : pct >= critAt ? "bg-crit" : pct >= warnAt ? "bg-warn" : "bg-accent";
  return (
    <div className="relative h-[5px] w-full rounded-full bg-surface-3" role="meter" aria-valuenow={pct ?? undefined} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      {pct != null && <div className={cx("h-full rounded-full transition-[width] duration-500", tone)} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />}
      <span className="absolute top-[-2px] h-[9px] w-px bg-line-strong" style={{ left: `${warnAt}%` }} />
      <span className="absolute top-[-2px] h-[9px] w-px bg-line-strong" style={{ left: `${critAt}%` }} />
    </div>
  );
}

export function Hash({ value, n = 12, label }: { value: string | null | undefined; n?: number; label?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="font-mono text-[11px] text-ink-3">—</span>;
  return (
    <button type="button" title={`${label ? label + ": " : ""}${value} (click to copy)`}
      onClick={() => { void navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
      className="num inline-flex items-center gap-1 rounded-[3px] bg-surface-3 px-1.5 py-[1px] font-mono text-[11px] text-ink-2 hover:text-ink">
      {copied ? "copied" : value.slice(0, n)}<Icon name="copy" size={11} className="opacity-50" />
    </button>
  );
}

export function KV({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(92px,auto)_1fr] gap-x-4 gap-y-1.5 text-[12px]">
      {rows.map(([k, v], i) => (<div key={i} className="contents"><dt className="micro pt-[2px] text-ink-3">{k}</dt><dd className="min-w-0 break-words font-mono text-[11.5px] text-ink">{v}</dd></div>))}
    </dl>
  );
}

export const th = "micro h-8 whitespace-nowrap px-2 text-left font-normal text-ink-3 first:pl-[var(--pad)] last:pr-[var(--pad)]";
export const td = "h-[var(--row)] px-2 align-middle first:pl-[var(--pad)] last:pr-[var(--pad)]";
export const tr = "border-t border-line transition-colors hover:bg-surface-2";

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-[3px] border border-line-strong bg-surface-2 px-1 font-mono text-[10px] text-ink-3">{children}</kbd>;
}

export function Checklist({ items }: { items: { check: string; status: string; reason?: string; detail?: string }[] }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((c) => (
        <li key={c.check} className="flex items-start gap-3 py-1.5">
          <span className="w-[86px] shrink-0"><Status s={c.status} /></span>
          <div className="min-w-0"><div className="font-mono text-[11.5px] text-ink">{c.check}</div><div className="text-[11.5px] leading-snug text-ink-3">{c.reason ?? c.detail}</div></div>
        </li>
      ))}
    </ul>
  );
}
