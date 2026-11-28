import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { useAssistant, type Scope } from "../lib/assistant";
import { useApi } from "../lib/hooks";
import { Icon } from "./icons";
import { Badge, Button, ErrorLine, Toggle, cx } from "./ui";

interface Turn { role: "user" | "assistant"; content: string; sent?: Sent; local?: boolean }
interface Sent { sha256: string; bytes: number; included_content: boolean; content_items: string[] }
interface Prompt { label: string; q: string; content: boolean }
interface Preview { messages: { role: string; content: string }[]; sha256: string; bytes: number; includes_content: boolean; content_items: string[]; content_available: string[] }

const kb = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);

/* ------------------------------------------------------------------ minimal, safe Markdown (no HTML injection) */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    out.push(t.startsWith("**") ? <b key={`${key}b${i}`} className="font-semibold text-ink">{t.slice(2, -2)}</b>
      : t.startsWith("`") ? <code key={`${key}c${i}`} className="rounded bg-surface-3 px-1 font-mono text-[0.9em]">{t.slice(1, -1)}</code>
      : <i key={`${key}i${i}`}>{t.slice(1, -1)}</i>);
    last = m.index + t.length; i++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0, k = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.startsWith("```")) {
      const body: string[] = [];
      for (i++; i < lines.length && !lines[i].startsWith("```"); i++) body.push(lines[i]);
      i++;
      blocks.push(<pre key={k++} className="scroll-thin overflow-auto rounded bg-surface-3 p-2 font-mono text-[11.5px]">{body.join("\n")}</pre>);
    } else if (/^#{1,4}\s/.test(l)) {
      blocks.push(<div key={k++} className="mt-1 text-[13px] font-semibold text-ink">{inline(l.replace(/^#+\s/, ""), `h${k}`)}</div>); i++;
    } else if (/^\s*([-*]|\d+\.)\s/.test(l)) {
      const ordered = /^\s*\d+\./.test(l);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s/.test(lines[i])) { items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s/, "")); i++; }
      const L = ordered ? "ol" : "ul";
      blocks.push(<L key={k++} className={cx("space-y-1 pl-5", ordered ? "list-decimal" : "list-disc")}>{items.map((t, j) => <li key={j}>{inline(t, `l${k}${j}`)}</li>)}</L>);
    } else if (!l.trim()) { i++; } else {
      const para: string[] = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|\s*([-*]|\d+\.)\s)/.test(lines[i])) { para.push(lines[i]); i++; }
      blocks.push(<p key={k++}>{inline(para.join(" "), `p${k}`)}</p>);
    }
  }
  return <div className="space-y-2 text-[12.5px] leading-relaxed text-ink-2">{blocks}</div>;
}

/* ------------------------------------------------------------------ drawer */
export function AssistantDrawer() {
  const a = useAssistant();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [content, setContent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [review, setReview] = useState<{ pv: Preview; q: string } | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const scope = a.scope;
  const key = `${scope.kind}:${scope.id ?? ""}`;
  const prompts = useApi<{ prompts: Prompt[] }>(a.available ? `/api/assistant/prompts?scope=${scope.kind}` : null);
  const hist = useApi<{ history: { question: string; answer: string; included_content: boolean }[] }>(a.available && a.isOpen ? `/api/assistant/history?scope=${scope.kind}${scope.id ? `&id=${scope.id}` : ""}` : null);
  useEffect(() => { setTurns([]); setErr(null); }, [key]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [turns, busy]);
  const history = () => turns.filter((t) => !t.local).map((t) => ({ role: t.role, content: t.content }));
  const body = (question: string, withContent: boolean, approved?: string) =>
    ({ scope: scope.kind, id: scope.id, question, include_content: withContent, history: history(), approved_sha256: approved });

  const send = async (question: string, withContent: boolean) => {
    if (!question.trim() || busy) return;
    setErr(null);
    if (withContent) {  // real text: show the exact payload first
      setBusy(true);
      try { setReview({ pv: await api.post<Preview>("/api/assistant/preview", body(question, true)), q: question }); }
      catch (e) { setErr((e as Error).message); }
      finally { setBusy(false); }
      return;
    }
    await deliver(question, false);
  };
  const deliver = async (question: string, withContent: boolean, approved?: string) => {
    setBusy(true); setQ("");
    const before = history();
    setTurns((t) => [...t, { role: "user", content: question }]);
    try {
      const r = await api.post<{ answer: string; sent: Sent }>("/api/assistant/ask", { ...body(question, withContent, approved), history: before });
      setTurns((t) => [...t, { role: "assistant", content: r.answer, sent: r.sent }]);
    } catch (e) {
      setErr((e as Error).message);
      setTurns((t) => t.slice(0, -1));
      setQ(question);
    } finally { setBusy(false); }
  };
  useEffect(() => {
    if (a.isOpen && a.pending && !busy) { const p = a.pending; a.consume(); setContent(p.content); void send(p.q, p.content); }
  }, [a.isOpen, a.pending]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!a.available) return null;
  return (
    <>
      {!a.isOpen && (
        <button type="button" onClick={() => a.open()} className="fixed bottom-4 right-4 z-40 inline-flex h-10 items-center gap-2 rounded-full border border-accent-line bg-surface px-4 text-[12.5px] font-medium text-ink shadow-[var(--shadow)] transition hover:border-accent" aria-label="Open FORGE AI assistant">
          <Icon name="spark" size={16} className="text-accent" />Ask FORGE AI
        </button>
      )}
      {a.isOpen && (
        <aside className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-surface shadow-[var(--shadow)] sm:w-[480px]" aria-label="FORGE AI assistant">
          <header className="flex items-center gap-2 border-b border-line px-4 py-3">
            <Icon name="spark" size={16} className="text-accent" />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-ink">FORGE AI</div>
              <div className="truncate font-mono text-[10.5px] text-ink-3">Azure OpenAI · {a.deployment}</div>
            </div>
            <button type="button" onClick={a.close} className="rounded p-1.5 text-ink-3 hover:bg-surface-3 hover:text-ink" aria-label="Close assistant"><Icon name="x" size={16} /></button>
          </header>
          <ScopeBar scope={scope} onGeneral={() => a.setOverride(scope.kind === "general" ? null : { kind: "general", id: null, label: "FORGE overall" })} />
          <div className="scroll-thin flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {turns.length === 0 && (
              <div className="space-y-3">
                <p className="text-[12.5px] leading-relaxed text-ink-2">Ask about {scope.kind === "general" ? "FORGE and your setup" : scope.label}. Metrics and settings are shared automatically; <b className="text-ink">real text</b> (tasks, examples, rows, passages, episodes) is sent only after you review it.</p>
                <div className="flex flex-wrap gap-1.5">
                  {(prompts.data?.prompts ?? []).map((p) => (
                    <button key={p.label} type="button" disabled={busy} onClick={() => { setContent(p.content); void send(p.q, p.content); }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12px] text-ink-2 transition hover:border-accent-line hover:text-ink">
                      {p.label}{p.content && <span className="font-mono text-[9.5px] text-warn-ink" title="Needs your approval to send real text">review</span>}
                    </button>
                  ))}
                </div>
                {(hist.data?.history.length ?? 0) > 0 && (
                  <details className="text-[12px] text-ink-3"><summary className="cursor-pointer">Earlier answers here ({hist.data!.history.length}, stored on this computer)</summary>
                    <div className="mt-2 space-y-3">{hist.data!.history.slice(-5).reverse().map((h, i) => (
                      <div key={i} className="rounded border border-line p-2"><div className="mb-1 font-medium text-ink">{h.question}</div><Markdown text={h.answer} /></div>))}</div>
                  </details>
                )}
              </div>
            )}
            {turns.map((t, i) => (
              <Fragment key={i}>
                {t.role === "user" ? (
                  <div className="ml-8 rounded-[var(--radius)] bg-accent-soft px-3 py-2 text-[12.5px] text-ink">{t.content}</div>
                ) : (
                  <div className="space-y-1.5">
                    <Markdown text={t.content} />
                    {t.sent && <div className="font-mono text-[10px] text-ink-3" title={t.sent.content_items.join("\n")}>
                      sent: {t.sent.included_content ? `summary + ${t.sent.content_items.length} content item(s)` : "summary only"} · {kb(t.sent.bytes)} · sha256 {t.sent.sha256.slice(0, 10)}</div>}
                  </div>
                )}
              </Fragment>
            ))}
            {busy && <div className="flex items-center gap-2 text-[12px] text-ink-3"><span className="live-dot h-1.5 w-1.5 rounded-full bg-accent" />thinking…</div>}
            <ErrorLine error={err} />
            <div ref={end} />
          </div>
          <form className="space-y-2 border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); void send(q, content); }}>
            <textarea className="h-20 w-full resize-none rounded-[calc(var(--radius)-1px)] border border-line-strong bg-surface px-2.5 py-2 text-[12.5px] text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
              placeholder="Ask anything about this…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Question"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(q, content); } }} />
            <div className="flex items-center justify-between gap-2">
              <Toggle checked={content} onChange={setContent} label="Include real text (review first)" />
              <Button type="submit" tone="primary" icon="spark" busy={busy} disabled={!q.trim()}>{content ? "Review & send" : "Send"}</Button>
            </div>
          </form>
        </aside>
      )}
      {review && <ReviewDialog pv={review.pv} deployment={a.deployment ?? ""} onCancel={() => setReview(null)}
        onApprove={() => { const r = review; setReview(null); void deliver(r.q, true, r.pv.sha256); }} />}
    </>
  );
}

function ScopeBar({ scope, onGeneral }: { scope: Scope; onGeneral: () => void }) {
  const label = { general: "FORGE overall", study: "Study", agent: "Agent", pack: "Knowledge pack" }[scope.kind];
  return (
    <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-4 py-2 text-[11.5px]">
      <span className="micro text-ink-3">talking about</span>
      <Badge tone="accent">{label}{scope.kind !== "general" && scope.label && scope.label !== "this study" ? ` · ${scope.label}` : ""}</Badge>
      <button type="button" className="micro ml-auto text-accent" onClick={onGeneral}>{scope.kind === "general" ? "back to this page" : "ask generally"}</button>
    </div>
  );
}

function ReviewDialog({ pv, deployment, onCancel, onApprove }: { pv: Preview; deployment: string; onCancel: () => void; onApprove: () => void }) {
  const data = pv.messages.find((m) => m.content.startsWith("DATA (from FORGE"))?.content.replace(/^DATA \(from FORGE, JSON\):\n/, "") ?? "{}";
  let pretty = data;
  try { pretty = JSON.stringify(JSON.parse(data), null, 2); } catch { /* keep raw */ }
  const question = pv.messages.at(-1)?.content ?? "";
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Review what will be sent">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-[var(--radius-panel)] border border-line bg-surface shadow-[var(--shadow)]">
        <div className="border-b border-line px-5 py-4">
          <div className="text-[14px] font-semibold text-ink">Review what will be sent to Azure OpenAI</div>
          <div className="mt-1 text-[12px] text-ink-3">Deployment <span className="font-mono">{deployment}</span> · {kb(pv.bytes)} · FORGE sends exactly this (sha256 <span className="font-mono">{pv.sha256.slice(0, 12)}</span>, checked on send).</div>
        </div>
        <div className="scroll-thin flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <div>
            <div className="micro mb-1 text-ink-3">real text included</div>
            <ul className="list-disc space-y-0.5 pl-5 text-[12.5px] text-ink">{pv.content_items.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
          <div><div className="micro mb-1 text-ink-3">your question</div><div className="rounded bg-surface-2 p-2 text-[12.5px] text-ink">{question}</div></div>
          <div><div className="micro mb-1 text-ink-3">data (paths removed, personal-data patterns blocked)</div>
            <pre className="scroll-thin max-h-[40vh] overflow-auto rounded border border-line bg-surface-2 p-2.5 font-mono text-[11px] text-ink-2">{pretty}</pre></div>
          <details className="text-[12px] text-ink-3"><summary className="cursor-pointer">FORGE's instructions to the model</summary><pre className="mt-1 whitespace-pre-wrap font-mono text-[11px]">{pv.messages[0]?.content}</pre></details>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
          <Button tone="ghost" onClick={onCancel}>Cancel — send nothing</Button>
          <Button tone="primary" icon="spark" onClick={onApprove}>Send this to Azure</Button>
        </div>
      </div>
    </div>
  );
}
