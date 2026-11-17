import { useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Button, CapCell, Empty, ErrorLine, PageHeader, Panel, Stat } from "../components/ui";
import { api, fmt } from "../lib/api";
import { useApi } from "../lib/hooks";
import type { CapStatus, DiscoveryRun, Estimate, Model, PairCheck } from "../lib/types";

interface ModelsResponse { capabilities: string[]; models: Model[] }
interface FitResponse { available: boolean; reason?: string; free_vram_mb: number | null; estimates: Record<string, Estimate> }

const STATUS_TONE: Record<string, "signal" | "amber" | "alert"> = { available: "signal", provider_offline: "amber", missing: "alert" };
const VERDICT_TONE: Record<string, "signal" | "amber" | "alert" | "default"> = { safe: "signal", tight: "amber", unsafe: "alert", no_gpu: "default", not_applicable: "default" };

export function Observatory() {
  const models = useApi<ModelsResponse>("/api/models");
  const [discovering, setDiscovering] = useState(false);
  const [lastRun, setLastRun] = useState<DiscoveryRun | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const discover = async () => {
    setDiscovering(true); setErr(null);
    try { setLastRun(await api.post<DiscoveryRun>("/api/models/discover")); await models.reload(); }
    catch (e) { setErr((e as Error).message); }
    finally { setDiscovering(false); }
  };

  const list = useMemo(() => (models.data?.models ?? []).filter((m) =>
    `${m.name} ${m.provider} ${m.architecture ?? ""} ${m.quantization ?? ""}`.toLowerCase().includes(filter.toLowerCase())), [models.data, filter]);
  const caps = models.data?.capabilities ?? [];
  const sel = list.find((m) => m.id === selected) ?? null;

  const capChart = caps.map((c) => {
    const row: Record<string, number | string> = { cap: c };
    for (const s of ["supported", "conditional", "unsupported", "unknown"] as CapStatus[])
      row[s] = (models.data?.models ?? []).filter((m) => m.capabilities[c]?.status === s).length;
    return row;
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Model Observatory" subtitle="Discovered models with measured metadata and a conservative capability matrix. Loading ≠ trainable."
        right={<Button tone="primary" onClick={discover} disabled={discovering}>{discovering ? "Discovering…" : "Run discovery"}</Button>} />
      <ErrorLine error={err ?? models.error} />

      {lastRun?.providers && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(lastRun.providers).map(([p, r]) => (
            <span key={p} title={r.detail ?? ""}><Badge tone={r.status === "ok" ? "signal" : r.status === "error" ? "alert" : "default"}>{p}: {r.status} · {r.models}</Badge></span>
          ))}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Panel title={`Capability matrix · ${list.length} models`} right={
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="filter…"
            className="w-44 rounded border border-edge bg-ink px-2 py-1 font-mono text-xs text-zinc-300 outline-none focus:border-cyan/50" />}>
          {list.length === 0 ? <Empty>No models registered. Run discovery, or add a model directory in System Settings.</Empty> : (
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="py-2 pr-3">Model</th><th className="pr-3">Provider</th><th className="pr-3">Params</th><th className="pr-3">Quant</th><th className="pr-3">Ctx</th>
                    {caps.map((c) => <th key={c} className="px-1 text-center" title={c}>{c.replace("_", " ")}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {list.map((m) => (
                    <tr key={m.id} onClick={() => setSelected(m.id)}
                      className={`cursor-pointer border-t border-edge/70 hover:bg-cyan/5 ${selected === m.id ? "bg-cyan/10" : ""}`}>
                      <td className="max-w-[260px] py-2 pr-3">
                        <div className="truncate text-zinc-200" title={m.name}>{m.name}</div>
                        <div className="flex gap-1 pt-0.5">
                          {m.status !== "available" && <Badge tone={STATUS_TONE[m.status]}>{m.status}</Badge>}
                          {m.roles.map((r) => <Badge key={r} tone="cyan">{r}</Badge>)}
                        </div>
                      </td>
                      <td className="pr-3 font-mono text-xs text-zinc-400">{m.provider}</td>
                      <td className="pr-3 font-mono text-xs" title={m.parameter_count_source}>{fmt.params(m.parameter_count)}{m.parameter_count_source === "config_estimate" && "~"}</td>
                      <td className="pr-3 font-mono text-xs text-zinc-400">{m.quantization ?? "—"}</td>
                      <td className="pr-3 font-mono text-xs text-zinc-400">{fmt.ctx(m.context_length)}</td>
                      {caps.map((c) => <td key={c} className="px-1 text-center">{m.capabilities[c] && <CapCell {...m.capabilities[c]} />}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 flex gap-4 font-mono text-[10px] text-zinc-500"><span>● supported</span><span>◐ conditional</span><span>○ unsupported</span><span>? unknown</span><span>~ estimated from config</span></div>
            </div>
          )}
        </Panel>
        <div className="space-y-4">
          {sel ? <ModelDetail key={sel.id} m={sel} onChange={models.reload} teachers={list.filter((x) => x.roles.includes("teacher"))} /> :
            <Panel title="Model detail"><Empty>Select a model to inspect metadata, VRAM fit, and roles.</Empty></Panel>}
          {capChart.length > 0 && (models.data?.models.length ?? 0) > 0 && (
            <Panel title="Capability distribution">
              <div className="h-48">
                <ResponsiveContainer>
                  <BarChart data={capChart} layout="vertical" margin={{ left: 20, right: 8 }}>
                    <XAxis type="number" hide allowDecimals={false} />
                    <YAxis type="category" dataKey="cap" tick={{ fill: "#71717a", fontSize: 10 }} width={80} />
                    <Tooltip contentStyle={{ background: "#0d1112", border: "1px solid #1b2224", fontSize: 12 }} />
                    <Bar dataKey="supported" stackId="a" fill="#34d399" isAnimationActive={false} />
                    <Bar dataKey="conditional" stackId="a" fill="#fbbf24" isAnimationActive={false} />
                    <Bar dataKey="unsupported" stackId="a" fill="#3f3f46" isAnimationActive={false} />
                    <Bar dataKey="unknown" stackId="a" fill="#27272a" isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function ModelDetail({ m, onChange, teachers }: { m: Model; onChange: () => Promise<void>; teachers: Model[] }) {
  const fit = useApi<FitResponse>(`/api/models/${m.id}/fit`);
  const [err, setErr] = useState<string | null>(null);
  const [pair, setPair] = useState<PairCheck | null>(null);

  const toggle = async (role: "teacher" | "student") => {
    setErr(null);
    try {
      if (m.roles.includes(role)) await api.del(`/api/models/${m.id}/roles/${role}`);
      else await api.put(`/api/models/${m.id}/roles`, { role });
      await onChange();
    } catch (e) { setErr((e as Error).message); }
  };
  const check = async (teacherId: string) => {
    try { setPair(await api.get<PairCheck>(`/api/models/pair-check?teacher=${teacherId}&student=${m.id}`)); }
    catch (e) { setErr((e as Error).message); }
  };

  return (
    <Panel title="Model detail">
      <div className="space-y-3">
        <div>
          <div className="break-all text-sm text-zinc-100">{m.name}</div>
          <div className="mt-0.5 break-all font-mono text-[10px] text-zinc-500">{m.locator}</div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Params" value={fmt.params(m.parameter_count)} sub={m.parameter_count_source} />
          <Stat label="Context" value={fmt.ctx(m.context_length)} />
          <Stat label="Size" value={fmt.bytes(m.size_bytes)} />
        </div>
        <dl className="grid grid-cols-[90px_1fr] gap-y-1 font-mono text-[11px]">
          <dt className="text-zinc-500">arch</dt><dd className="text-zinc-300">{m.architecture ?? "—"}</dd>
          <dt className="text-zinc-500">format</dt><dd className="text-zinc-300">{m.format}</dd>
          <dt className="text-zinc-500">quant</dt><dd className="text-zinc-300">{m.quantization ?? "—"}</dd>
          <dt className="text-zinc-500">license</dt><dd className={m.license ? "text-zinc-300" : "text-amber"}>{m.license ?? "not declared — verify before use"}</dd>
          <dt className="text-zinc-500">path</dt><dd className="break-all text-zinc-400">{m.storage_path ?? "—"}</dd>
        </dl>
        <div className="space-y-1.5">
          {Object.entries(m.capabilities).map(([k, c]) => (
            <div key={k} className="flex gap-2 text-xs"><CapCell {...c} /><div><span className="font-mono text-zinc-300">{k}</span> <span className="text-zinc-500">{c.reason}</span></div></div>
          ))}
        </div>
        <div className="border-t border-edge pt-3">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">VRAM fit @ 2048 tokens</div>
          {fit.data && !fit.data.available && <div className="text-xs text-zinc-500">{fit.data.reason}</div>}
          {fit.data?.available && Object.entries(fit.data.estimates).map(([method, e]) => (
            <div key={method} className="flex items-center justify-between py-0.5 text-xs">
              <span className="font-mono uppercase text-zinc-400">{method}</span>
              <span className="flex items-center gap-2">
                {e.total_mb != null && <span className="font-mono text-zinc-400">{fmt.mb(e.total_mb)}</span>}
                <Badge tone={VERDICT_TONE[e.verdict]}>{e.verdict.replace("_", " ")}</Badge>
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-edge pt-3">
          <Button onClick={() => toggle("teacher")}>{m.roles.includes("teacher") ? "Unset teacher" : "Set as teacher"}</Button>
          <Button onClick={() => toggle("student")}>{m.roles.includes("student") ? "Unset student" : "Set as student"}</Button>
        </div>
        {m.roles.includes("student") && teachers.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">pair-check with</span>
            {teachers.filter((t) => t.id !== m.id).map((t) => <Button key={t.id} onClick={() => check(t.id)}>{t.name}</Button>)}
          </div>
        )}
        {pair && (
          <div className="rounded border border-edge p-2">
            <div className="mb-1 flex items-center gap-2 text-xs"><Badge tone={pair.verdict === "pass" ? "signal" : "alert"}>{pair.verdict}</Badge><span className="text-zinc-400">modes: {pair.distillation_modes.join(", ")}</span></div>
            {pair.checks.map((c) => <div key={c.check} className="text-[11px]"><span className={c.status === "pass" ? "text-signal" : c.status === "fail" ? "text-alert" : c.status === "warn" ? "text-amber" : "text-zinc-400"}>{c.status}</span> <span className="font-mono text-zinc-300">{c.check}</span> <span className="text-zinc-500">{c.reason}</span></div>)}
          </div>
        )}
        <ErrorLine error={err} />
      </div>
    </Panel>
  );
}
