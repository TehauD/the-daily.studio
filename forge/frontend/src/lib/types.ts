export type CapStatus = "supported" | "conditional" | "unsupported" | "unknown";
export interface Capability { status: CapStatus; reason: string }

export interface Model {
  id: string; provider: string; locator: string; name: string;
  architecture: string | null; parameter_count: number | null; parameter_count_source: string;
  quantization: string | null; context_length: number | null; format: string;
  storage_path: string | null; size_bytes: number | null; license: string | null;
  metadata: Record<string, unknown>; capabilities: Record<string, Capability>;
  status: "available" | "missing" | "provider_offline"; first_seen: string; last_seen: string; roles: string[];
}

export interface Gpu {
  index: number; name: string; vram_total_mb: number | null; vram_used_mb: number | null; vram_free_mb: number | null;
  utilization_pct: number | null; temperature_c: number | null; power_draw_w: number | null;
  driver_version: string | null; compute_capability: string | null;
}

export interface Hardware {
  os: string; python: string; cpu_model: string; cpu_physical_cores: number | null; cpu_logical_cores: number | null;
  ram_total_mb: number; ram_available_mb: number; disks: { path: string; mount: string; total_gb: number; free_gb: number; used_pct: number }[];
  nvidia_smi: string | null; cuda_driver_version: string | null; gpus: Gpu[]; wsl: boolean;
  torch: { installed: boolean; version: string | null; cuda_build: string | null; cuda_available: boolean; bf16_supported: boolean | null; error: string | null };
  optional_packages: Record<string, boolean>;
}

export interface TelemetrySample {
  ts: number; cpu_pct: number; ram_used_mb: number; ram_total_mb: number; active_jobs: number;
  gpus: { index: number; name: string; util_pct: number | null; vram_used_mb: number | null; vram_total_mb: number | null; temp_c: number | null; power_w: number | null }[];
}

export interface ProviderSummary { status: string; detail: string | null; models: number; marked_missing: number; duration_ms: number }
export interface DiscoveryRun { run_id?: string; id?: string; started_at: string; providers?: Record<string, ProviderSummary>; results?: Record<string, ProviderSummary> }

export interface Overview {
  models_total: number; models_available: number; models_trainable: number; by_provider: Record<string, number>;
  teachers: string[]; students: string[]; experiments: number; trajectories: number; datasets: number;
  active_runs: number; last_discovery: string | null;
}

export interface Estimate {
  weights_mb: number; lora_params: number; trainable_state_mb: number; activations_mb: number; logits_mb: number;
  overhead_mb: number; total_mb: number; available_mb: number | null; utilization: number | null;
  verdict: "safe" | "tight" | "unsafe" | "no_gpu" | "not_applicable"; notes: string[]; reason?: string;
}

export interface PairCheck {
  teacher: string; student: string; verdict: "pass" | "fail"; distillation_modes: string[];
  checks: { check: string; status: "pass" | "warn" | "fail" | "info"; reason: string }[];
}
