import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./icons";

/** "Explain this panel": what you are looking at, how to read it, and the math — with the numbers on screen. */
export function Explain({ title, what, read, math }: { title: string; what: ReactNode; read: ReactNode; math?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    close.current?.focus();
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open]);
  return (
    <>
      <button ref={btn} type="button" onClick={() => setOpen(true)} className="inline-flex h-7 items-center gap-1 rounded-full border border-line px-2.5 text-[11.5px] text-ink-2 hover:border-accent-line hover:text-ink print:hidden">
        <Icon name="info" size={12} />Explain
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setOpen(false)} aria-hidden />
          <aside role="dialog" aria-modal="true" aria-label={`Explain: ${title}`} className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-surface shadow-[var(--shadow)] sm:w-[460px]">
            <div className="flex h-12 items-center justify-between border-b border-line px-4"><span className="text-[13px] font-medium text-ink">Explain · {title}</span>
              <button ref={close} type="button" onClick={() => { setOpen(false); btn.current?.focus(); }} aria-label="Close explanation" className="rounded p-1 text-ink-3 hover:bg-surface-3 hover:text-ink"><Icon name="x" /></button></div>
            <div className="scroll-thin flex-1 space-y-5 overflow-y-auto p-4 text-[13px] leading-relaxed text-ink-2">
              <section><h3 className="micro mb-1.5 text-ink-3">What you're looking at</h3><div>{what}</div></section>
              <section><h3 className="micro mb-1.5 text-ink-3">How to read it</h3><div>{read}</div></section>
              {math && <section><h3 className="micro mb-1.5 text-ink-3">The math, with these numbers</h3><div className="space-y-2">{math}</div></section>}
              <p className="border-t border-line pt-3 text-[11.5px] text-ink-3">Hover or focus any underlined symbol for its meaning. These are measurements of weights — they show where and how much the model changed, not why it behaves as it does.</p>
            </div>
          </aside>
        </>)}
    </>
  );
}
