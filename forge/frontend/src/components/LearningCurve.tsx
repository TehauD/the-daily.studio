import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useChartVars, usePrefs } from "../lib/prefs";
import { LegendKey, useTooltipStyle } from "./charts";

/** Training loss curve (Recharts) — in its own module so only Training Lab loads the charting library. */
export function LearningCurve({ rows }: { rows: Record<string, unknown>[] }) {
  const v = useChartVars();
  const tt = useTooltipStyle();
  const { prefs } = usePrefs();
  const data = rows.filter((r) => r.loss != null || r.eval_loss != null).map((r) => ({
    step: r.step as number, train: (r.loss as number) ?? null, eval: (r.eval_loss as number) ?? null }));
  const objective = (rows.find((r) => r.objective)?.objective as string) ?? "completion_ce";
  const hasEval = data.some((d) => d.eval != null);
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <LegendKey items={[{ label: "train loss", color: v["s-teacher"] }, ...(hasEval ? [{ label: "dev loss (teacher successes)", color: v["s-tuned"] }] : [])]} />
        <span className="micro text-ink-3">objective · {objective === "all_token_ce" ? "all-token CE (not comparable to completion-only)" : "completion-only CE"}</span>
        <span className="text-[10.5px] text-ink-3">x: optimizer step · y: cross-entropy loss (nats/token)</span>
      </div>
      <div className="h-56">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 6, right: 12, left: -6, bottom: 0 }}>
            <CartesianGrid stroke={v.line} vertical={false} />
            <XAxis dataKey="step" tick={{ fill: v["ink-3"], fontSize: 10.5, fontFamily: "var(--font-mono)" }} stroke={v["line-strong"]} tickLine={false} />
            <YAxis tick={{ fill: v["ink-3"], fontSize: 10.5, fontFamily: "var(--font-mono)" }} stroke={v["line-strong"]} tickLine={false} width={48} tickFormatter={(x: number) => x.toFixed(2)} />
            <Tooltip {...tt} formatter={(x: number) => x?.toFixed(4)} labelFormatter={(s) => `step ${s}`} />
            <Legend content={() => null} />
            <Line type="monotone" dataKey="train" stroke={v["s-teacher"]} strokeWidth={2} dot={false} connectNulls isAnimationActive={prefs.chartAnimation} />
            {hasEval && <Line type="monotone" dataKey="eval" stroke={v["s-tuned"]} strokeWidth={2} dot={{ r: 3.5, strokeWidth: 0, fill: v["s-tuned"] }} connectNulls isAnimationActive={prefs.chartAnimation} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- forest plot (paired effects) */
