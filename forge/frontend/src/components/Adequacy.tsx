import { useState } from "react";
import { useApi } from "../lib/hooks";
import { Badge, cx } from "./ui";
import { OverlapBlock } from "./Lineage";

interface Skill { skill: string; tasks: Record<string, number>; untrained: number | null; teacher: number | null; top_answer: string; top_share: number; avg_steps: number;
  issues: { kind: string; text: string }[]; verdict: "good" | "weak" | "unusable" }
interface Adq { overall: string; measured: boolean; skills: Skill[]; note: string; regression_only?: string[] }
const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const TONE = { good: "good", weak: "warn", unusable: "crit" } as const;

/** Evaluation Lab → "Is this a good test?" — per skill: room to improve, a capable teacher, balanced answers, enough tasks. */
export function Adequacy({ sid }: { sid: string }) {
  const a = useApi<Adq>(`/api/studies/${sid}/adequacy`);
  const [open, setOpen] = useState(false);
  const d = a.data;
  if (!d) return null;
  const bad = d.skills.filter((s) => s.verdict !== "good").length;
  return (
    <div className={cx("rounded-[var(--radius)] border bg-surface px-3 py-2 text-[12.5px] fit:shrink-0", d.overall === "adequate" ? "border-line" : "border-warn/60")}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full flex-wrap items-center gap-2 text-left">
        <span className="font-medium text-ink">Is this a good test?</span>
        <Badge tone={d.overall === "adequate" ? "good" : d.overall.startsWith("not yet") ? "default" : "warn"}>{d.overall}</Badge>
        {d.skills.map((s) => <Badge key={s.skill} tone={TONE[s.verdict]} title={s.issues.map((i) => i.text).join(" ") || "Room to improve, capable teacher, balanced answers, enough tasks."}>{s.skill}</Badge>)}
        <span className="ml-auto text-[11.5px] text-ink-3">{bad ? `${bad} skill${bad > 1 ? "s" : ""} can't show a training effect well — ` : ""}{open ? "hide" : "details"}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2 border-t border-line pt-2">
          <OverlapBlock sid={sid} onJob={() => void a.reload()} />
          {d.regression_only && d.regression_only.length > 0 && <p className="text-[11.5px] text-ink-3">Regression checks, not trained or graded here: {d.regression_only.join(", ")} — they test that training did not damage an unrelated ability (Evaluation Lab → regression split).</p>}
          <div className="overflow-x-auto"><table className="w-full text-[12px]"><thead><tr className="text-ink-3">{["Skill", "Untrained", "Teacher", "Steps", "Most common answer", "Check-in / final-test tasks", "What to fix"].map((h) => <th key={h} className="py-1 pr-3 text-left font-normal">{h}</th>)}</tr></thead>
            <tbody>{d.skills.map((s) => (
              <tr key={s.skill} className="border-t border-line align-top">
                <td className="py-1.5 pr-3"><Badge tone={TONE[s.verdict]}>{s.verdict}</Badge> <span className="text-ink">{s.skill}</span></td>
                <td className="num pr-3 font-mono">{pct(s.untrained)}</td><td className="num pr-3 font-mono">{pct(s.teacher)}</td><td className="num pr-3 font-mono">{s.avg_steps}</td>
                <td className="pr-3 font-mono">{s.top_answer.slice(0, 20)} · {pct(s.top_share)}</td><td className="num pr-3 font-mono">{s.tasks.dev} / {s.tasks.test}</td>
                <td className="text-ink-2">{s.issues.length ? <ul className="list-disc pl-4">{s.issues.map((i) => <li key={i.kind}>{i.text}</li>)}</ul> : <span className="text-good-ink">fine</span>}</td></tr>))}</tbody></table></div>
          <p className="text-[11.5px] text-ink-3">{d.note}</p>
        </div>
      )}
    </div>
  );
}
