import type { ReactNode } from "react";
import type { CapStatus } from "../lib/types";

export function Panel({ title, right, children, className = "" }: { title?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-edge bg-panel/90 ${className}`}>
      {title && (
        <header className="flex items-center justify-between border-b border-edge px-4 py-2.5">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400">{title}</h2>
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, tone = "default" }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "default" | "signal" | "cyan" | "muted" }) {
  const color = { default: "text-zinc-100", signal: "text-signal", cyan: "text-cyan", muted: "text-zinc-500" }[tone];
  return (
    <div className="min-w-0">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</div>
      <div className={`mt-1 truncate font-mono text-xl ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

const CAP_STYLE: Record<CapStatus, string> = {
  supported: "bg-signal/15 text-signal border-signal/30",
  conditional: "bg-amber/10 text-amber border-amber/30",
  unsupported: "bg-zinc-800/60 text-zinc-500 border-zinc-700/60",
  unknown: "bg-transparent text-zinc-500 border-zinc-700 border-dashed",
};
const CAP_GLYPH: Record<CapStatus, string> = { supported: "●", conditional: "◐", unsupported: "○", unknown: "?" };

export function CapCell({ status, reason }: { status: CapStatus; reason: string }) {
  return (
    <span title={`${status}: ${reason}`} className={`inline-flex h-6 w-6 items-center justify-center rounded border font-mono text-xs ${CAP_STYLE[status]}`}>
      {CAP_GLYPH[status]}
    </span>
  );
}

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "signal" | "cyan" | "amber" | "alert" }) {
  const t = {
    default: "border-zinc-700 text-zinc-400", signal: "border-signal/40 text-signal", cyan: "border-cyan/40 text-cyan",
    amber: "border-amber/40 text-amber", alert: "border-alert/40 text-alert",
  }[tone];
  return <span className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${t}`}>{children}</span>;
}

export function Button({ children, onClick, disabled, tone = "default", type = "button" }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; tone?: "default" | "primary" | "danger"; type?: "button" | "submit";
}) {
  const t = {
    default: "border-edge text-zinc-300 hover:border-cyan/50 hover:text-cyan",
    primary: "border-signal/50 bg-signal/10 text-signal hover:bg-signal/20",
    danger: "border-alert/40 text-alert hover:bg-alert/10",
  }[tone];
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`rounded border px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-40 ${t}`}>
      {children}
    </button>
  );
}

export function ErrorLine({ error }: { error: string | null }) {
  return error ? <div className="rounded border border-alert/30 bg-alert/5 px-3 py-2 font-mono text-xs text-alert">{error}</div> : null;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-6 text-center text-sm text-zinc-500">{children}</div>;
}

export function Meter({ pct, tone = "cyan" }: { pct: number | null; tone?: "cyan" | "signal" | "amber" }) {
  const c = { cyan: "bg-cyan", signal: "bg-signal", amber: "bg-amber" }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded bg-zinc-800">
      {pct != null && <div className={`h-full ${c} transition-all`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />}
    </div>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle: string; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-100">{title}</h1>
        <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>
      </div>
      {right}
    </div>
  );
}
