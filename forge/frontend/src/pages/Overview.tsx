import { TelemetryPanel } from "../components/Telemetry";
import { Badge, ErrorLine, Meter, PageHeader, Panel, Stat } from "../components/ui";
import { fmt } from "../lib/api";
import { useApi } from "../lib/hooks";
import type { Hardware, Overview as OverviewT } from "../lib/types";

const PHASES = [
  { n: 1, name: "Foundation", items: "Hardware · registry · capability matrix · API · dashboard", state: "built" },
  { n: 2, name: "Experiments", items: "Teacher agent · tool sandbox · trajectory capture", state: "contracts" },
  { n: 3, name: "First training", items: "LoRA/QLoRA jobs · checkpoints · adapter export", state: "planned" },
  { n: 4, name: "Evaluation", items: "Benchmarks · teacher/student comparison · lineage", state: "planned" },
  { n: 5, name: "Advanced research", items: "Logit KD · on-policy · DPO · GRPO", state: "planned" },
];

export function Overview() {
  const hw = useApi<Hardware>("/api/system/hardware");
  const ov = useApi<OverviewT>("/api/overview", 10000);
  const h = hw.data;
  const gpu = h?.gpus[0];
  return (
    <div className="space-y-4">
      <PageHeader title="Overview" subtitle="Measured system state and laboratory inventory. Missing sensors show as —, never as simulated values." />
      <ErrorLine error={hw.error ?? ov.error} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Panel title="GPU">
          {gpu ? (
            <div className="space-y-3">
              <Stat label={`GPU ${gpu.index}`} value={gpu.name.replace("NVIDIA ", "")} sub={`driver ${gpu.driver_version ?? "—"} · CUDA ${h?.cuda_driver_version ?? "—"} · sm_${gpu.compute_capability ?? "?"}`} tone="signal" />
              <div>
                <div className="mb-1 flex justify-between font-mono text-[11px] text-zinc-500"><span>VRAM</span><span>{fmt.mb(gpu.vram_used_mb)} / {fmt.mb(gpu.vram_total_mb)}</span></div>
                <Meter pct={gpu.vram_total_mb && gpu.vram_used_mb != null ? (gpu.vram_used_mb / gpu.vram_total_mb) * 100 : null} tone="signal" />
              </div>
            </div>
          ) : (
            <Stat label="NVIDIA GPU" value={hw.loading ? "probing…" : "not detected"} sub={h ? (h.nvidia_smi ? "nvidia-smi returned no devices" : "nvidia-smi not found") : ""} tone="muted" />
          )}
        </Panel>
        <Panel title="PyTorch">
          <Stat label="torch" value={h?.torch.installed ? h.torch.version : "not installed"}
            sub={h?.torch.installed ? `CUDA build ${h.torch.cuda_build ?? "cpu"} · ${h.torch.cuda_available ? "CUDA available" : "CUDA unavailable"} · bf16 ${h.torch.bf16_supported ?? "—"}` : "install ML stack for training (Phase 3)"}
            tone={h?.torch.cuda_available ? "signal" : "muted"} />
          {h?.torch.error && <div className="mt-2 font-mono text-[11px] text-alert">{h.torch.error}</div>}
        </Panel>
        <Panel title="CPU · RAM">
          <Stat label={`${h?.cpu_physical_cores ?? "—"}C / ${h?.cpu_logical_cores ?? "—"}T`} value={h ? `${(h.ram_total_mb / 1024).toFixed(0)} GB RAM` : "—"} sub={h?.cpu_model} />
          {h && <div className="mt-3"><Meter pct={(1 - h.ram_available_mb / h.ram_total_mb) * 100} /></div>}
        </Panel>
        <Panel title="Storage">
          <div className="space-y-2">
            {h?.disks.map((d) => (
              <div key={d.path}>
                <div className="flex justify-between font-mono text-[11px] text-zinc-500"><span className="truncate" title={d.path}>{d.mount}</span><span>{d.free_gb} GB free</span></div>
                <Meter pct={d.used_pct} tone={d.used_pct > 90 ? "amber" : "cyan"} />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <TelemetryPanel />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Laboratory inventory" className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Models" value={ov.data?.models_total ?? "—"} sub={`${ov.data?.models_available ?? 0} available`} />
            <Stat label="LoRA-trainable" value={ov.data?.models_trainable ?? "—"} tone="signal" />
            <Stat label="Experiments" value={ov.data?.experiments ?? "—"} />
            <Stat label="Datasets" value={ov.data?.datasets ?? "—"} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(ov.data?.by_provider ?? {}).map(([p, n]) => <Badge key={p} tone="cyan">{p} · {n}</Badge>)}
          </div>
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div><span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Teachers</span><div className="text-zinc-300">{ov.data?.teachers.join(", ") || "none registered"}</div></div>
            <div><span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Students</span><div className="text-zinc-300">{ov.data?.students.join(", ") || "none registered"}</div></div>
          </div>
          <div className="mt-3 font-mono text-[11px] text-zinc-500">last discovery: {fmt.time(ov.data?.last_discovery ?? null)}</div>
        </Panel>
        <Panel title="Build phases">
          <ol className="space-y-2.5">
            {PHASES.map((p) => (
              <li key={p.n} className="flex gap-3">
                <span className={`mt-0.5 font-mono text-xs ${p.state === "built" ? "text-signal" : p.state === "contracts" ? "text-cyan" : "text-zinc-600"}`}>{p.state === "built" ? "■" : p.state === "contracts" ? "◧" : "□"} {p.n}</span>
                <div><div className="text-sm text-zinc-200">{p.name}</div><div className="text-xs text-zinc-500">{p.items}</div></div>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </div>
  );
}
