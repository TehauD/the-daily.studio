export type CapStatus = "supported" | "conditional" | "unsupported" | "unknown";
export type CheckStatus = "pass" | "warn" | "fail" | "info" | "unknown" | "skip";
export interface Capability { status: CapStatus; reason: string }
export interface Check { check: string; status: CheckStatus; reason: string }

export interface ParamReport {
  stored_total: number | null; embedding: number | null; lm_head_stored: number | null; unique_total?: number;
  non_embedding: number | null; tie_word_embeddings?: boolean; lm_head_is_duplicate_of_tied_embedding?: boolean; note?: string;
}

export interface Eligibility {
  kind: string;
  teacher: { verdict: CheckStatus; checks: Check[] };
  student: { verdict: CheckStatus; checks: Check[] };
}

export interface Model {
  id: string; provider: string; locator: string; name: string;
  architecture: string | null; parameter_count: number | null; parameter_count_source: string;
  quantization: string | null; context_length: number | null; format: string;
  storage_path: string | null; size_bytes: number | null; license: string | null;
  metadata: Record<string, unknown> & { parameter_report?: ParamReport | null; model_kind?: string; lmstudio_state?: string };
  capabilities: Record<string, Capability>;
  status: "available" | "missing" | "provider_offline"; first_seen: string; last_seen: string; roles: string[];
  eligibility: Eligibility;
}

export interface Gpu {
  index: number; name: string; vram_total_mb: number | null; vram_used_mb: number | null; vram_free_mb: number | null;
  utilization_pct: number | null; temperature_c: number | null; power_draw_w: number | null; power_limit_w: number | null;
  driver_version: string | null; compute_capability: string | null;
}

export interface Hardware {
  os: string; python: string; python_executable: string; cpu_model: string; cpu_physical_cores: number | null;
  cpu_logical_cores: number | null; ram_total_mb: number; ram_available_mb: number;
  disks: { path: string; mount: string; total_gb: number; free_gb: number; used_pct: number }[];
  nvidia_smi: string | null; cuda_driver_version: string | null; gpus: Gpu[]; wsl: boolean;
  torch: { installed: boolean; version: string | null; cuda_build: string | null; cuda_available: boolean;
           device_count: number; bf16_supported: boolean | null; numpy_version: string | null;
           python_executable: string | null; error: string | null };
  optional_packages: Record<string, boolean>;
}

export interface TelemetrySample {
  ts: number; cpu_pct: number; ram_used_mb: number; ram_total_mb: number; active_jobs: number;
  gpus: { index: number; name: string; util_pct: number | null; vram_used_mb: number | null; vram_total_mb: number | null; temp_c: number | null; power_w: number | null }[];
}
export interface TelemetryResponse { gpu_source: string | null; interval_s: number; running: boolean; scope: string; samples: TelemetrySample[] }

export interface ReadinessCheck { id: string; label: string; status: CheckStatus; detail: string; blocks: string[] }
export interface Readiness { checks: ReadinessCheck[]; blocked_stages: Record<string, string[]>; cpu_wiring_mode: boolean }

export interface ProviderSummary { status: string; detail: string | null; models: number; marked_missing: number; duration_ms: number }
export interface DiscoveryRun { run_id?: string; started_at: string; providers?: Record<string, ProviderSummary> }

export interface Job {
  id: string; kind: string; label: string; argv: string[]; gpu: number; study_id: string | null;
  status: "running" | "completed" | "failed" | "cancelled" | "cancelling" | "interrupted";
  pid: number | null; exit_code: number | null; created_at: string; started_at: string | null; ended_at: string | null;
}
export interface JobEvent { ts?: number; event?: string; text?: string; [k: string]: unknown }

export interface OverviewT {
  models_total: number; models_available: number; models_trainable: number; by_provider: Record<string, number>;
  teachers: string[]; students: string[]; studies: number; active_jobs: number; gpu_job: Job | null;
  latest_study: { id: string; name: string; profile: string; created_at: string } | null;
  models_hidden_non_generative: number; last_discovery: string | null;
}

export interface Estimate {
  weights_mb: number; lora_params: number; trainable_state_mb: number; activations_mb: number; logits_mb: number;
  overhead_mb: number; total_mb: number; available_mb: number | null; utilization: number | null;
  verdict: "safe" | "tight" | "unsafe" | "no_gpu" | "not_applicable"; notes: string[]; reason?: string;
  lora_breakdown?: { per_layer: Record<string, number>; per_layer_total: number; total: number; exact: boolean } | null;
}

export interface PairCheck {
  teacher: string; student: string; teacher_id: string; student_id: string; verdict: CheckStatus;
  capacity_ratio: number | null; vram_estimate: Estimate | null; distillation_modes: string[]; checks: Check[];
}

export interface HubResult { id: string; downloads: number | null; likes: number | null; pipeline_tag: string | null; library: string | null; parameters: number | null; gated: boolean | string | null; last_modified: string | null; tags: string[] }
export interface Outbound { host: string; endpoint: string; [k: string]: unknown }
export interface HubInspect {
  repo_id: string; revision: string | null; kind: string; architecture: string | null; model_type: string | null;
  parameters: { total: number | null; by_dtype?: Record<string, number>; error?: string };
  hidden_size: number | null; num_hidden_layers: number | null; intermediate_size: number | null; vocab_size: number | null;
  num_attention_heads: number | null; num_key_value_heads: number | null; head_dim: number | null; tie_word_embeddings: boolean | null;
  context_length: number | null; license: string | null; download_bytes: number; weight_files: { name: string; size: number | null }[];
  checks: Check[]; verdict: CheckStatus; outbound: Outbound;
}

export interface StudyPlan {
  study_id: string; name: string; created_at: string; profile: string; profile_purpose: string; seeds: number[]; arms: string[];
  primary_contrast: string; min_gain: number; device: string;
  teacher: { provider: string; endpoint: string; model: string };
  student: { name: string; path: string; parameter_report?: ParamReport | null };
  taskset: { version: string; sha256: string; counts: Record<string, number>; spec: Record<string, unknown> };
  train: Record<string, unknown>; eval: Record<string, unknown>; base_hash: string | null; engine_source_sha256: string;
  environment: Record<string, unknown>;
}
export interface StageState { status: "completed" | "running" | "failed"; at: string; error?: string; summary?: unknown }
export interface Contrast {
  mean: number; ci_low: number; ci_high: number; level: number; method: string; seeds: number; groups: number;
  arm_rate: number; control_rate: number; teacher_gap_closed: number | null;
  sign_flip_groups: { p: number; method: string; n_units: number; min_attainable_p: number };
  sign_flip_seeds: { p: number; method: string; n_units: number; min_attainable_p: number };
  invalid_rate_arm: number; invalid_rate_control: number;
  mcnemar_diagnostic: Record<string, { b: number; c: number; p: number }>;
  families: Record<string, Record<string, { rate: number; n: number; ci: [number, number] }>>;
  per_group_delta: Record<string, number>;
}
export interface AnalysisReport {
  computed: boolean; generated_at: string; note?: string;
  splits: Record<string, { base_rate: number | null; teacher_rate: number | null; arms: Record<string, Contrast> }>;
  holm_secondary?: Record<string, number>;
  gate?: { verdict: string; checks: { check: string; status: "pass" | "fail"; detail: string }[]; disclaimer: string };
}
export interface StudySummary {
  id: string; plan: StudyPlan; state: { stages: Record<string, StageState>; sealed: boolean; history: { stage: string; status?: string; at: string }[] };
  next_stage: string | null; reports: Record<string, AnalysisReport>; gpu_stages: string[]; path: string; jobs?: Job[];
}
export interface StudyRow { id: string; name: string; profile: string; created_at: string; next_stage: string | null; sealed: boolean; stages: Record<string, string>; teacher: string; student: string; arms: string[]; seeds: number[]; error?: string }

export interface EpisodeRow { arm: string; split: string; seed: number; task_id: string; family: string; group_id: string; strict_success: boolean; answer_correct: boolean; calls: number; invalid: number; termination: string; latency_ms: number; trace_hash: string }
export interface GraphNode { id: string; kind: string; label: string; detail: unknown; status: "pass" | "fail" | "neutral"; layer: number; x: number; y: number }
export interface PathGraphT { task_id: string; model: string; arm: string; seed: number; strict_success: boolean; score: Record<string, unknown>; nodes: GraphNode[]; edges: { from: string; to: string }[]; trace_hash: string; width: number; height: number }
export interface CompareT { task_id: string; outcome: string; lanes: { lane: string; graph: PathGraphT | null; divergence_from_teacher: number | null }[]; honesty: string }

export interface LineageNode { id: string; kind: string; label: string; digest: string | null; path: string | null; layer: number; exists: boolean; x: number; y: number; [k: string]: unknown }
export interface LineageT { nodes: LineageNode[]; edges: { from: string; to: string }[]; width: number; height: number }

export interface InspectionModule { module: string; layer: number | null; kind: string; shape: number[]; rank: number; delta_fro: number; base_fro: number | null; relative_change: number | null; singular_values: number[]; effective_rank: number; trainable_params: number }
export interface Inspection { computed: boolean; r: number; alpha: number; scale: number; use_rslora: boolean; modules: InspectionModule[]; layer_delta_fro: Record<string, number>; total_trainable_params: number; base_available: boolean; method: string }

export type KMetric = "strict_success" | "answer_correct" | "tool_selection_correct" | "argument_accuracy" | "invalid_rate";
export interface KNode { id: string; kind: "teacher" | "reference" | "base" | "tuned" | "dataset" | "skill" | "tool"; label: string; col: number; x: number; y: number; [k: string]: unknown }
export interface KEdge { from: string; to: string; kind: "produced" | "trained" | "adapted" | "performs" | "requires"; label?: string; measured: boolean; n?: number;
  metrics?: Record<KMetric, number>; ci?: Record<KMetric, [number, number] | null>; delta_vs_base?: Record<KMetric, number> }
export interface KnowledgeT { study_id: string; view: string; splits: string[]; metrics: KMetric[]; nodes: KNode[]; edges: KEdge[]; rows: number; cols: number; provenance: string; honesty: string }
export interface ProjToken { id: number; token: string; special: boolean; z: number }
export interface ProjModule { module: string; layer: number; kind: string; sigma1: number; energy_share: number; plus: ProjToken[]; minus: ProjToken[] }
export interface ProjectionT { computed: boolean; heuristic: boolean; unembedding: string; vocab_size: number; layers: number[]; k: number; modules: ProjModule[]; method: string; caveats: string[]; adapter_sha256: string }
