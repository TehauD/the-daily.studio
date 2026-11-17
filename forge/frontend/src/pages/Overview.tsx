import { useCallback, useState } from "react";
import { TraceStrip } from "../components/charts";
import { Icon } from "../components/icons";
import { JobLog, useTelemetry } from "../components/live";
import { Button, Checklist, ErrorLine, KV, Meter, PageHeader, Panel, Prov, Readout, Skeleton, Status, cx } from "../components/ui";
import { api, fmt } from "../lib/api";
import { useAction, useApi } from "../lib/hooks";
import { usePrefs } from "../lib/prefs";
import type { Hardware, Job, OverviewT, Readiness } from "../lib/types";

function LoopStep({ n, title, state, detail }: { n: number; title: string; state: "done" | "ready" | "blocked"; detail: string }) {
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      <span className={cx("num z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px]",
        state === "done" ? "border-[color:var(--good)] bg-[color:var(--good)] text-white" : state === "ready" ? "border-accent text-accent" : "border-line-strong text-ink-3")}>
        {state === "done" ? <Icon name="check" size={13} /> : n}
      </span>
      <span className="absolute left-3 top-6 h-[calc(100%-24px)] w-px bg-line last:hidden" aria-hidden />
      <div className="min-w-0 pt-0.5">
        <div className={cx("text-[12.5px] font-medium", state === "blocked" ? "text-ink-3" : "text-ink")}>{title}</div>
        <div className="text-[11.5px] leading-snug text-ink-3">{detail}</div>
      </div>
    </li>
  );
}

export default function Overview() {
  const hw = useApi<Hardware>("/api/system/hardware");
  const ov = useApi<OverviewT>("/api/overview", 6000);
  const rd = useApi<Readiness>("/api/system/readiness", 15000);
  const { data: tel } = useTelemetry();
  const { prefs } = usePrefs();
  const act = useAction();
  const [verifyJob, setVerifyJob] = useState<string | null>(null);
  const onDone = useCallback(() => { void rd.reload(); }, [rd]);
  const h = hw.data, o = ov.data;
  const gpu = h?.gpus[0];
  const samples = (tel?.samples ?? []).slice(-prefs.telemetryWindow);
  const last = samples.at(-1);
  const times = samples.map((s) => s.ts);
  const failing = rd.data?.checks.filter((c) => c.status === "fail") ?? [];

  const loop = [
    { title: "Select a student", state: o && o.students.length ? "done" : "ready", detail: o?.students.length ? o.students.join(", ") : "Hub search or local HF snapshot → Observatory" },
    { title: "Pair with a teacher", state: o?.teachers.length && o.students.length ? "done" : o?.students.length ? "ready" : "blocked", detail: o?.teachers.length ? o.teachers.join(", ") : "LM Studio model → set as teacher" },
    { title: "Collect · build · train", state: o?.studies ? "ready" : o?.teachers.length && o.students.length ? "ready" : "blocked", detail: o?.latest_study ? `latest study: ${o.latest_study.name} (${o.latest_study.profile})` : "Create a study in Experiment Studio" },
    { title: "Evaluate base and tuned", state: "blocked", detail: "Identical held-out tasks, greedy decoding" },
    { title: "Paired gain + path comparison", state: "blocked", detail: "95% CI, sign-flip tests, teacher/base/tuned paths" },
  ] as const;

  return (
    <div className="space-y-4">
      <PageHeader kicker="System state" title="Overview" subtitle="Measured hardware, readiness for each stage of the distillation loop, and live telemetry. A missing sensor reads —; nothing on this page is simulated."
        right={<>
          <Button icon="refresh" onClick={() => { void api.get("/api/system/hardware?refresh=true").then(() => { void hw.reload(); void rd.reload(); }); }}>Re-probe</Button>
          <Button tone="primary" icon="gpu" busy={act.busy} onClick={() => void act.run(async () => setVerifyJob((await api.post<Job>("/api/jobs/verify-gpu")).id))}>Verify GPU</Button>
        </>} />
      <ErrorLine error={hw.error ?? ov.error ?? act.error} />

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <Panel title="GPU" eyebrow="01" prov={<Prov kind="measured" source="nvidia-smi" />}>
          {!h ? <div className="space-y-2"><Skeleton h={26} /><Skeleton h={12} w="60%" /></div> : gpu ? (
            <div className="space-y-3">
              <Readout label={`device ${gpu.index} · sm_${gpu.compute_capability?.replace(".", "") ?? "?"}`} value={gpu.name.replace("NVIDIA ", "").replace("GeForce ", "")} size="sm" />
              <div>
                <div className="mb-1 flex justify-between font-mono text-[10.5px] text-ink-3"><span>VRAM</span><span className="num text-ink-2">{fmt.mb(gpu.vram_used_mb)} / {fmt.mb(gpu.vram_total_mb)}</span></div>
                <Meter pct={gpu.vram_total_mb && gpu.vram_used_mb != null ? (gpu.vram_used_mb / gpu.vram_total_mb) * 100 : null} label="VRAM used" />
              </div>
              <KV rows={[["driver", gpu.driver_version ?? "—"], ["CUDA (driver)", h.cuda_driver_version ?? <span className="text-crit-ink">not parsed</span>], ["power limit", gpu.power_limit_w ? `${gpu.power_limit_w.toFixed(0)} W` : "—"]]} />
            </div>
          ) : <Readout label="NVIDIA GPU" value="not detected" tone="muted" size="sm" sub={h.nvidia_smi ? "nvidia-smi returned no devices" : "nvidia-smi not found on PATH"} />}
        </Panel>

        <Panel title="Compute stack" eyebrow="02" prov={<Prov kind="measured" source="subprocess probe" />}>
          {!h ? <Skeleton h={90} /> : (
            <div className="space-y-3">
              <Readout label="torch" value={h.torch.installed ? h.torch.version ?? "?" : "not installed"} size="sm" tone={h.torch.cuda_available ? "good" : h.torch.installed ? "default" : "crit"}
                sub={h.torch.installed ? `CUDA build ${h.torch.cuda_build ?? "cpu-only"}` : "Run setup.ps1 -WithML in the project venv"} />
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <Status s={h.torch.cuda_available ? "pass" : "fail"} label="CUDA" />
                <Status s={h.torch.bf16_supported ? "pass" : h.torch.cuda_available ? "fail" : "unknown"} label="BF16" />
                <Status s={h.torch.numpy_version ? "pass" : "fail"} label={`NumPy ${h.torch.numpy_version ?? ""}`} />
              </div>
              <div className="break-all rounded bg-surface-2 px-2 py-1.5 font-mono text-[10.5px] text-ink-2" title="Interpreter used by FORGE and all jobs">{h.torch.python_executable ?? h.python_executable}</div>
              {h.torch.error && <div className="font-mono text-[11px] text-crit-ink">{h.torch.error}</div>}
            </div>
          )}
        </Panel>

        <Panel title="Host" eyebrow="03" prov={<Prov kind="measured" source="psutil" />}>
          {!h ? <Skeleton h={90} /> : (
            <div className="space-y-3">
              <Readout label={`${h.cpu_physical_cores ?? "—"}C / ${h.cpu_logical_cores ?? "—"}T`} value={(h.ram_total_mb / 1024).toFixed(0)} unit="GB RAM" size="sm" sub={h.cpu_model} />
              <div>
                <div className="mb-1 flex justify-between font-mono text-[10.5px] text-ink-3"><span>RAM in use</span><span className="num text-ink-2">{fmt.pct(1 - h.ram_available_mb / h.ram_total_mb, 0)}</span></div>
                <Meter pct={(1 - h.ram_available_mb / h.ram_total_mb) * 100} label="RAM used" />
              </div>
              <div className="font-mono text-[10.5px] text-ink-3">{h.os}{h.wsl && " · WSL"}</div>
            </div>
          )}
        </Panel>

        <Panel title="Storage" eyebrow="04" prov={<Prov kind="measured" source="psutil" />}>
          {!h ? <Skeleton h={90} /> : (
            <div className="space-y-3">
              {h.disks.map((d) => (
                <div key={d.path}>
                  <div className="mb-1 flex justify-between font-mono text-[10.5px]"><span className="truncate text-ink-2" title={d.path}>{d.mount}</span>
                    <span className={cx("num", d.used_pct >= 90 ? "text-crit-ink" : "text-ink-3")}>{d.free_gb} GB free · {d.used_pct.toFixed(0)}%</span></div>
                  <Meter pct={d.used_pct} label={`Disk ${d.mount}`} />
                  {d.used_pct >= 90 && <div className="mt-1 text-[11px] text-crit-ink">Above 90% — checkpoints and merged exports may fail.</div>}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Live telemetry" eyebrow="05" prov={<Prov kind="measured" source={tel?.gpu_source ?? "psutil"} />}
        right={<span className="font-mono text-[10.5px] text-ink-3">{tel?.scope ?? ""} · every {(prefs.telemetryPollMs / 1000).toFixed(0)}s · {samples.length} samples</span>}>
        {samples.length === 0 ? <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={86} />)}</div> : (
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
            {last?.gpus[0] && <TraceStrip title="GPU utilization" unit="%" values={samples.map((s) => s.gpus[0]?.util_pct ?? null)} times={times} current={last.gpus[0].util_pct?.toFixed(0) ?? "—"} />}
            {last?.gpus[0] && <TraceStrip title="VRAM in use" unit="%" values={samples.map((s) => (s.gpus[0]?.vram_used_mb != null && s.gpus[0]?.vram_total_mb ? (s.gpus[0].vram_used_mb! / s.gpus[0].vram_total_mb!) * 100 : null))} times={times}
              current={last.gpus[0].vram_used_mb != null && last.gpus[0].vram_total_mb ? ((last.gpus[0].vram_used_mb / last.gpus[0].vram_total_mb) * 100).toFixed(0) : "—"} sub={last.gpus[0].vram_used_mb != null ? fmt.mb(last.gpus[0].vram_used_mb) : ""} />}
            <TraceStrip title="CPU" unit="%" values={samples.map((s) => s.cpu_pct)} times={times} current={last?.cpu_pct.toFixed(0)} />
            <TraceStrip title="RAM in use" unit="%" values={samples.map((s) => (s.ram_used_mb / s.ram_total_mb) * 100)} times={times} current={last ? ((last.ram_used_mb / last.ram_total_mb) * 100).toFixed(0) : "—"} sub={last ? fmt.mb(last.ram_used_mb) : ""} />
            {!last?.gpus[0] && <div className="text-[12px] text-ink-3 sm:col-span-2">No GPU sensor: nvidia-smi was not found, so GPU traces are omitted rather than shown as zero.</div>}
          </div>
        )}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <Panel title="Readiness" eyebrow="06" prov={<Prov kind="measured" />}
          right={rd.data && (failing.length ? <Status s="fail" label={`${failing.length} blocking`} /> : <Status s="pass" label="all clear" />)}>
          {!rd.data ? <Skeleton h={200} /> : (
            <>
              <Checklist items={rd.data.checks.map((c) => ({ check: c.label, status: c.status, detail: c.detail + (c.status === "fail" && c.blocks.length ? `  ⟶ blocks: ${c.blocks.join(", ")}` : "") }))} />
              {rd.data.cpu_wiring_mode && <div className="mt-3 text-[11.5px] text-warn-ink">CPU wiring mode is on: training runs only to test the pipeline. No result produced in this mode is valid evidence.</div>}
            </>
          )}
        </Panel>
        <div className="space-y-4">
          <Panel title="MVP loop" eyebrow="07">
            <ol>{loop.map((s, i) => <LoopStep key={s.title} n={i + 1} title={s.title} state={s.state} detail={s.detail} />)}</ol>
          </Panel>
          <Panel title="Laboratory inventory" eyebrow="08" prov={<Prov kind="measured" source="registry" />}>
            <div className="grid grid-cols-3 gap-4">
              <Readout label="models" value={o?.models_available ?? "—"} size="sm" sub={o ? `${o.models_hidden_non_generative} non-generative hidden` : ""} />
              <Readout label="LoRA-trainable" value={o?.models_trainable ?? "—"} size="sm" />
              <Readout label="studies" value={o?.studies ?? "—"} size="sm" sub={`last scan ${fmt.ago(o?.last_discovery)}`} />
            </div>
          </Panel>
        </div>
      </div>
      {verifyJob && <Panel title="GPU verification" eyebrow="job"><JobLog jobId={verifyJob} height={180} onDone={onDone} /></Panel>}
    </div>
  );
}
