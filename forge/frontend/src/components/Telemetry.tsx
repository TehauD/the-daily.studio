import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApi } from "../lib/hooks";
import type { TelemetrySample } from "../lib/types";
import { Empty, Panel } from "./ui";

interface TelemetryResponse { gpu_source: string | null; interval_s: number; samples: TelemetrySample[] }

export function TelemetryPanel() {
  const { data, error } = useApi<TelemetryResponse>("/api/system/telemetry", 2000);
  const rows = (data?.samples ?? []).slice(-120).map((s) => ({
    t: new Date(s.ts * 1000).toLocaleTimeString(),
    cpu: Math.round(s.cpu_pct),
    ram: Math.round((s.ram_used_mb / s.ram_total_mb) * 100),
    gpu: s.gpus[0]?.util_pct ?? null,
    vram: s.gpus[0]?.vram_used_mb != null && s.gpus[0]?.vram_total_mb ? Math.round((s.gpus[0].vram_used_mb / s.gpus[0].vram_total_mb) * 100) : null,
  }));
  const last = data?.samples.at(-1);
  return (
    <Panel title="Live resource telemetry" right={<span className="font-mono text-[10px] text-zinc-500">{data?.gpu_source ? `GPU via ${data.gpu_source}` : "no GPU sensor"} · {data?.interval_s ?? 2}s</span>}>
      {error && <Empty>Telemetry unavailable: {error}</Empty>}
      {!error && rows.length < 2 && <Empty>Collecting samples…</Empty>}
      {rows.length >= 2 && (
        <div className="h-56">
          <ResponsiveContainer>
            <AreaChart data={rows} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="#1b2224" vertical={false} />
              <XAxis dataKey="t" tick={{ fill: "#52525b", fontSize: 10 }} minTickGap={40} />
              <YAxis domain={[0, 100]} tick={{ fill: "#52525b", fontSize: 10 }} unit="%" />
              <Tooltip contentStyle={{ background: "#0d1112", border: "1px solid #1b2224", fontSize: 12 }} />
              <Area type="monotone" dataKey="cpu" name="CPU" stroke="#a1a1aa" fill="#a1a1aa22" isAnimationActive={false} />
              <Area type="monotone" dataKey="ram" name="RAM" stroke="#22d3ee" fill="#22d3ee18" isAnimationActive={false} />
              {data?.gpu_source && <Area type="monotone" dataKey="gpu" name="GPU util" stroke="#34d399" fill="#34d39922" isAnimationActive={false} connectNulls={false} />}
              {data?.gpu_source && <Area type="monotone" dataKey="vram" name="VRAM" stroke="#fbbf24" fill="#fbbf2414" isAnimationActive={false} connectNulls={false} />}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      {last && (
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs text-zinc-400">
          <span>CPU {last.cpu_pct.toFixed(0)}%</span>
          <span>RAM {(last.ram_used_mb / 1024).toFixed(1)}/{(last.ram_total_mb / 1024).toFixed(1)} GB</span>
          {last.gpus.map((g) => (
            <span key={g.index}>GPU{g.index} {g.util_pct ?? "—"}% · {g.vram_used_mb ?? "—"}/{g.vram_total_mb ?? "—"} MB · {g.temp_c ?? "—"}°C · {g.power_w ?? "—"} W</span>
          ))}
          <span>training jobs: {last.active_jobs}</span>
        </div>
      )}
    </Panel>
  );
}
