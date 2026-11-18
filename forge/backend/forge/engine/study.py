"""Study lifecycle — the unit of a FORGE experiment.

  init → collect → build → train → evaluate_dev → analyze_dev → seal → evaluate_test → analyze_test → [export]

Invariants
- The plan (pair, profile, seeds, arms, tasks, hyperparameters, base-model hash, engine
  source hash, environment) is frozen at init and content-hashed; it is never rewritten.
- Stages run in order; a stage re-run resumes from its JSONL (per-record SHA-256 verified).
- After SEAL, build/train are refused: test/OOD/regression results can no longer
  influence any training decision.
- One process may hold the study lock at a time. Writes are atomic (tmp + rename).
"""
from __future__ import annotations

import json
import os
import platform
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Any, Callable, Iterator

import psutil

from forge.engine import datasets as ds
from forge.engine import statistics as st
from forge.engine.runtime import (ChatBackend, EpisodeConfig, OllamaBackend, OpenAICompatBackend, OracleBackend,
                                  TransformersBackend, run_episode)
from forge.engine.tasks import TASKSET_VERSION, Task, TaskSetSpec, ToolWorld, build_catalog, generate_taskset, taskset_hash
from forge.util import canonical_json, new_id, sha256_file, sha256_text, utcnow

STAGES = ("init", "collect", "build", "train", "evaluate_dev", "analyze_dev", "seal", "evaluate_test",
          "analyze_test", "export")
REQUIRES = {
    "collect": ["init"], "build": ["collect"], "train": ["build"], "evaluate_dev": ["train"],
    "analyze_dev": ["evaluate_dev"], "seal": ["analyze_dev"], "evaluate_test": ["seal"],
    "analyze_test": ["evaluate_test"], "export": ["analyze_test"],
}
GPU_STAGES = {"train", "evaluate_dev", "evaluate_test", "export"}
POST_SEAL_FORBIDDEN = {"build", "train", "evaluate_dev", "analyze_dev"}

PROFILES: dict[str, dict[str, Any]] = {
    "smoke": {"seeds": [0], "taskset": {"groups_per_family": 8, "ood_groups_per_family": 3, "regression_groups": 4},
              "train": {"max_steps": 2, "epochs": 1}, "purpose": "wiring only — no inferential claims"},
    "pilot": {"seeds": [0, 1, 2], "taskset": {"groups_per_family": 24}, "train": {"epochs": 3},
              "purpose": "exploratory — minimum exact sign-flip p over 3 seeds is 0.25"},
    "research": {"seeds": [0, 1, 2, 3, 4, 5], "taskset": {"groups_per_family": 40, "ood_groups_per_family": 10,
                                                           "regression_groups": 20},
                 "train": {"epochs": 3}, "purpose": "preregistered — eligible for the review gate"},
}
TRAIN_ARMS: dict[str, dict[str, Any]] = {
    "teacher_filtered": {"data": "teacher_filtered", "train": {}},
    "teacher_raw": {"data": "teacher_raw", "train": {}},
    "oracle_sft": {"data": "oracle_sft", "train": {}},
    "quarter_data": {"data": "quarter_data", "train": {}},
    "last_turn_only": {"data": "last_turn_only", "train": {}},
    "rank4": {"data": "teacher_filtered", "train": {"rank": 4, "alpha": 8}},
    "attention_only": {"data": "teacher_filtered", "train": {"target_modules": ["q_proj", "k_proj", "v_proj", "o_proj"]}},
    "all_token_loss": {"data": "teacher_filtered", "train": {"all_token_loss": True}},
}
DEFAULT_TRAIN = {"rank": 16, "alpha": 32, "dropout": 0.05, "lr": 2e-4, "warmup_ratio": 0.03, "micro_batch": 1,
                 "grad_accum": 8, "max_seq_len": 2048, "epochs": 3.0, "max_steps": -1, "target_modules": "all-linear",
                 "min_free_vram_mb": 12000}


class StudyError(RuntimeError):
    pass


def engine_source_hash() -> str:
    root = Path(__file__).resolve().parent
    files = sorted(list(root.glob("*.py")) + list((root.parent / "analysis").glob("*.py")))
    return sha256_text(canonical_json({p.name: sha256_file(p) for p in files}))


# ------------------------------------------------------------------ IO primitives

def atomic_write_json(path: Path, obj: Any) -> None:
    tmp = path.with_suffix(path.suffix + f".tmp-{os.getpid()}")
    tmp.write_text(json.dumps(obj, indent=2, default=str, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, path)


def _repair_torn_tail(path: Path) -> None:
    """Drop a partial final line left by a hard kill mid-write (e.g. a cancelled job).

    Without this, the next append would be glued onto the fragment, producing a corrupt line
    that is no longer last — which read_jsonl rightly refuses.
    """
    if not path.exists() or path.stat().st_size == 0:
        return
    with open(path, "rb+") as f:
        f.seek(-1, os.SEEK_END)
        if f.read(1) == b"\n":
            return
        f.seek(0)
        content = f.read()
        f.truncate(content.rfind(b"\n") + 1)


def append_jsonl(path: Path, record: dict[str, Any]) -> None:
    """Each line carries the SHA-256 of its canonical payload so resume can detect corruption."""
    path.parent.mkdir(parents=True, exist_ok=True)
    _repair_torn_tail(path)
    payload = canonical_json(record)
    with open(path, "a", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps({"sha256": sha256_text(payload), "record": record}, ensure_ascii=False) + "\n")
        f.flush()
        os.fsync(f.fileno())


def read_jsonl(path: Path, verify: bool = True) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    out = []
    with open(path, encoding="utf-8") as f:
        for n, line in enumerate(f, 1):
            if not line.strip():
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                # A torn final line (crash mid-write) is dropped; anything earlier is corruption.
                if n == sum(1 for _ in open(path, encoding="utf-8")):
                    break
                raise StudyError(f"{path}:{n}: corrupt line")
            if verify and sha256_text(canonical_json(row["record"])) != row["sha256"]:
                raise StudyError(f"{path}:{n}: sha256 mismatch")
            out.append(row["record"])
    return out


class StudyLock:
    def __init__(self, path: Path):
        self.path = path

    @staticmethod
    def holder_alive(pid: int, created: float | None) -> bool:
        """A PID alone is not identity: Windows reuses PIDs quickly. Match the process start time too."""
        if pid <= 0:
            return False
        try:
            proc = psutil.Process(pid)
            return created is None or abs(proc.create_time() - created) < 1.0
        except psutil.Error:
            return False

    def __enter__(self) -> "StudyLock":
        if self.path.exists():
            try:
                info = json.loads(self.path.read_text(encoding="utf-8") or "{}")
                if isinstance(info, int):  # v0.5.0 lock format: bare PID
                    info = {"pid": info}
            except (ValueError, json.JSONDecodeError):
                info = {}
            pid = int(info.get("pid") or 0)
            if pid and pid != os.getpid() and self.holder_alive(pid, info.get("created")):
                raise StudyError(f"Study is locked by running process {pid}")
        me = psutil.Process(os.getpid())
        self.path.write_text(json.dumps({"pid": me.pid, "created": me.create_time()}), encoding="utf-8")
        return self

    def __exit__(self, *exc: Any) -> None:
        try:
            self.path.unlink()
        except FileNotFoundError:
            pass


# ------------------------------------------------------------------ Study

class Study:
    def __init__(self, root: Path):
        self.root = root
        if not (root / "plan.json").exists():
            raise StudyError(f"No study at {root}")
        self.plan = json.loads((root / "plan.json").read_text(encoding="utf-8"))
        if sha256_text(canonical_json(self.plan)) != (root / "plan.sha256").read_text(encoding="utf-8").strip():
            raise StudyError("Frozen plan hash mismatch — plan.json was modified after init")

    # ---- creation
    @staticmethod
    def init(studies_dir: Path, *, name: str, profile: str, teacher: dict, student: dict, arms: list[str],
             seeds: list[int] | None = None, train_overrides: dict | None = None, taskset_overrides: dict | None = None,
             min_gain: float = 0.05, device: str = "cuda", environment: dict | None = None,
             base_hash: str | None = None) -> "Study":
        if profile not in PROFILES:
            raise StudyError(f"profile must be one of {list(PROFILES)}")
        unknown = [a for a in arms if a not in TRAIN_ARMS]
        if unknown or not arms:
            raise StudyError(f"unknown/empty arms {unknown}; choose from {list(TRAIN_ARMS)}")
        prof = PROFILES[profile]
        spec = TaskSetSpec(**{**prof["taskset"], **(taskset_overrides or {})})
        tasks = generate_taskset(spec)
        sid = new_id("study")
        root = studies_dir / sid
        root.mkdir(parents=True)
        train = {**DEFAULT_TRAIN, **prof["train"], **(train_overrides or {})}
        plan = {
            "study_id": sid, "name": name, "created_at": utcnow(), "profile": profile, "profile_purpose": prof["purpose"],
            "seeds": seeds if seeds is not None else prof["seeds"], "arms": arms, "control": "base",
            "primary_contrast": f"{arms[0]} − base on test (strict success)", "min_gain": min_gain,
            "teacher": teacher, "student": student, "device": device,
            "taskset": {"version": TASKSET_VERSION, "spec": asdict(spec), "sha256": taskset_hash(tasks),
                        "counts": {s: sum(1 for t in tasks if t.split == s) for s in ("train", "dev", "test", "ood", "regression")}},
            "train": train, "arm_overrides": {a: TRAIN_ARMS[a] for a in arms},
            "eval": {"max_turns": 6, "max_new_tokens": 128, "decoding": "greedy", "control_seed_broadcast": 0},
            "base_hash": base_hash, "engine_source_sha256": engine_source_hash(),
            "environment": environment or {"python": sys.version.split()[0], "platform": platform.platform()},
        }
        (root / "tasks.jsonl").write_text("".join(canonical_json(t.to_dict()) + "\n" for t in tasks), encoding="utf-8")
        atomic_write_json(root / "plan.json", plan)
        (root / "plan.sha256").write_text(sha256_text(canonical_json(plan)), encoding="utf-8")
        atomic_write_json(root / "state.json", {"stages": {"init": {"status": "completed", "at": utcnow()}},
                                                "sealed": False, "history": [{"stage": "init", "at": utcnow()}]})
        return Study(root)

    # ---- state
    @property
    def state(self) -> dict[str, Any]:
        return json.loads((self.root / "state.json").read_text(encoding="utf-8"))

    def _set_stage(self, stage: str, status: str, **extra: Any) -> None:
        s = self.state
        s["stages"][stage] = {"status": status, "at": utcnow(), **extra}
        s["history"].append({"stage": stage, "status": status, "at": utcnow()})
        atomic_write_json(self.root / "state.json", s)

    def check_can_run(self, stage: str) -> None:
        if stage not in STAGES or stage == "init":
            raise StudyError(f"Unknown stage {stage}")
        s = self.state
        if s["sealed"] and stage in POST_SEAL_FORBIDDEN:
            raise StudyError(f"Study is sealed; '{stage}' is no longer permitted")
        for req in REQUIRES[stage]:
            if s["stages"].get(req, {}).get("status") != "completed":
                raise StudyError(f"'{stage}' requires '{req}' to be completed first")

    def tasks(self) -> list[Task]:
        rows = [json.loads(line) for line in (self.root / "tasks.jsonl").read_text(encoding="utf-8").splitlines() if line]
        tasks = [Task(**r) for r in rows]
        if taskset_hash(tasks) != self.plan["taskset"]["sha256"]:
            raise StudyError("tasks.jsonl does not match the frozen taskset hash")
        return tasks

    def world(self) -> ToolWorld:
        return ToolWorld(build_catalog(self.plan["taskset"]["spec"]["seed"]))

    def episode_path(self, arm: str, split: str, seed: int) -> Path:
        return self.root / "episodes" / arm / split / f"seed{seed}.jsonl"

    def episodes(self, arm: str, split: str, seed: int) -> list[dict]:
        return read_jsonl(self.episode_path(arm, split, seed))

    def iter_episode_files(self) -> Iterator[tuple[str, str, int, Path]]:
        base = self.root / "episodes"
        if not base.exists():
            return
        for arm_dir in sorted(base.iterdir()):
            for split_dir in sorted(arm_dir.iterdir()):
                for f in sorted(split_dir.glob("seed*.jsonl")):
                    yield arm_dir.name, split_dir.name, int(f.stem[4:]), f

    def run_dir(self, arm: str, seed: int) -> Path:
        return self.root / "runs" / arm / f"seed{seed}"

    # ---- episodes
    def _evaluate(self, backend: ChatBackend, arm: str, split: str, seed: int, tasks: list[Task], emit: Callable) -> None:
        path = self.episode_path(arm, split, seed)
        done = {e["task_id"] for e in read_jsonl(path)}
        todo = [t for t in tasks if t.split == split and t.task_id not in done]
        world = self.world()
        cfg = EpisodeConfig(max_turns=self.plan["eval"]["max_turns"])
        for i, t in enumerate(todo, 1):
            ep = run_episode(t, backend, world, cfg, arm=arm, seed=seed)
            if ep["termination"] == "backend_error":
                # Infrastructure failure, not model behavior: never record it as a failed episode.
                # The stage stops; a re-run resumes from the last recorded task.
                detail = next((e["detail"] for e in ep["events"] if e["type"] == "error"), "")
                raise StudyError(f"{arm}/{split}/seed{seed} {t.task_id}: backend error — {detail}")
            append_jsonl(path, ep)
            emit({"event": "episode", "arm": arm, "split": split, "seed": seed, "task_id": t.task_id,
                  "strict_success": ep["score"]["strict_success"], "progress": f"{len(done) + i}/{len(done) + len(todo)}"})

    def teacher_backend(self) -> ChatBackend:
        t = self.plan["teacher"]
        if t["provider"] == "ollama":
            return OllamaBackend(t["endpoint"], t["model"])
        return OpenAICompatBackend(t["endpoint"], t["model"], allow_remote=bool(t.get("allow_remote")))

    # ---- stages
    def run_stage(self, stage: str, emit: Callable[[dict], None] = print, confirm: str | None = None,
                  teacher_backend: ChatBackend | None = None, student_factory: Callable[..., ChatBackend] | None = None,
                  hash_cache: Path | None = None) -> dict[str, Any]:
        self.check_can_run(stage)
        with StudyLock(self.root / ".lock"):
            self._set_stage(stage, "running", pid=os.getpid(), pid_created=psutil.Process(os.getpid()).create_time())
            try:
                fn = getattr(self, f"_stage_{stage}")
                kwargs: dict[str, Any] = {"emit": emit}
                if stage == "collect":
                    kwargs["teacher_backend"] = teacher_backend
                if stage in ("evaluate_dev", "evaluate_test", "export"):
                    kwargs["student_factory"] = student_factory
                if stage == "seal":
                    kwargs["confirm"] = confirm
                if stage == "train":
                    kwargs["hash_cache"] = hash_cache
                result = fn(**kwargs) or {}
            except BaseException as e:
                self._set_stage(stage, "failed", error=f"{type(e).__name__}: {e}"[:2000])
                raise
            self._set_stage(stage, "completed", summary=result)
            if stage == "seal":
                s = self.state
                s["sealed"] = True
                atomic_write_json(self.root / "state.json", s)
            return result

    def _stage_collect(self, emit: Callable, teacher_backend: ChatBackend | None) -> dict:
        tasks = self.tasks()
        teacher = teacher_backend or self.teacher_backend()
        oracle = OracleBackend({t.prompt: t for t in tasks})
        for t_split in ("train",):  # oracle trajectories: needed only as an SFT data arm / eligibility reference
            self._evaluate(oracle, "oracle", t_split, 0, tasks, emit)
        for split in ("train", "dev", "test", "ood", "regression"):
            self._evaluate(teacher, "teacher", split, 0, tasks, emit)
        tr = self.episodes("teacher", "train", 0)
        return {"teacher_train_episodes": len(tr),
                "teacher_train_strict_success": sum(e["score"]["strict_success"] for e in tr)}

    def _stage_build(self, emit: Callable) -> dict:
        teacher_eps, oracle_eps = self.episodes("teacher", "train", 0), self.episodes("oracle", "train", 0)
        out = {}
        for arm in self.plan["arms"]:
            data_arm = TRAIN_ARMS[arm]["data"]
            res = ds.build_arm(ds.BuildPolicy(arm=data_arm, seed=self.plan["taskset"]["spec"]["seed"]), teacher_eps, oracle_eps)
            if not res["records"]:
                raise StudyError(f"Arm {arm}: zero training records (teacher produced no strict successes?)")
            d = self.root / "datasets" / arm
            d.mkdir(parents=True, exist_ok=True)
            rec_path = d / "records.jsonl"
            rec_path.write_text("".join(canonical_json(r) + "\n" for r in res["records"]), encoding="utf-8")
            manifest = {"arm": arm, "data_policy": data_arm, "records": len(res["records"]),
                        "episodes_used": res["episodes_used"], "exclusions": res["exclusions"],
                        "eligible_task_ids": len(res["eligible_task_ids"]),
                        "eligible_task_ids_sha256": sha256_text(canonical_json(res["eligible_task_ids"])),
                        "records_sha256": sha256_file(rec_path), "created_at": utcnow()}
            atomic_write_json(d / "manifest.json", manifest)
            emit({"event": "dataset", **manifest})
            out[arm] = {k: manifest[k] for k in ("records", "episodes_used", "records_sha256")}
        hashes = {json.loads((self.root / "datasets" / a / "manifest.json").read_text(encoding="utf-8"))["eligible_task_ids_sha256"]
                  for a in self.plan["arms"]}
        if len(hashes) != 1:
            raise StudyError("Arms do not share the same eligible task ids")
        return out

    def _dev_records(self) -> list[dict]:
        eps = [e for e in self.episodes("teacher", "dev", 0) if e["score"]["strict_success"]]
        return [r for e in eps for r in ds.episode_records(e)]

    def _stage_train(self, emit: Callable, hash_cache: Path | None = None) -> dict:
        from forge.engine.train import TrainConfig, train_lora
        out = {}
        dev = self._dev_records()
        for arm in self.plan["arms"]:
            records = [json.loads(line) for line in (self.root / "datasets" / arm / "records.jsonl").read_text(encoding="utf-8").splitlines() if line]
            for seed in self.plan["seeds"]:
                rd = self.run_dir(arm, seed)
                if (rd / "run.json").exists():
                    emit({"event": "skip_trained", "arm": arm, "seed": seed})
                    out[f"{arm}/seed{seed}"] = json.loads((rd / "run.json").read_text(encoding="utf-8"))["adapter_sha256"]
                    continue
                params = {**self.plan["train"], **TRAIN_ARMS[arm]["train"]}
                cfg = TrainConfig(model_path=self.plan["student"]["path"], records=records, output_dir=str(rd), seed=seed,
                                  eval_records=dev, teacher_endpoint=self.plan["teacher"].get("endpoint"),
                                  device=self.plan["device"], **{k: v for k, v in params.items()
                                                                 if k in TrainConfig.__dataclass_fields__})
                emit({"event": "train_start", "arm": arm, "seed": seed, "records": len(records)})
                rep = train_lora(cfg, hash_cache=hash_cache, emit=emit)
                if self.plan.get("base_hash") and rep["base_hash_before"] != self.plan["base_hash"]:
                    raise StudyError("Student weights differ from the base hash frozen at init")
                out[f"{arm}/seed{seed}"] = rep["adapter_sha256"]
        return out

    def _student(self, factory: Callable | None, adapter: Path | None) -> ChatBackend:
        if factory:
            return factory(adapter)
        return TransformersBackend(self.plan["student"]["path"], str(adapter) if adapter else None,
                                   device=self.plan["device"], max_new_tokens=self.plan["eval"]["max_new_tokens"])

    def _evaluate_students(self, splits: tuple[str, ...], emit: Callable, factory: Callable | None) -> dict:
        tasks = self.tasks()
        b = self._student(factory, None)
        for split in splits:
            self._evaluate(b, "base", split, self.plan["eval"]["control_seed_broadcast"], tasks, emit)
        getattr(b, "unload", lambda: None)()
        for arm in self.plan["arms"]:
            for seed in self.plan["seeds"]:
                adapter = self.run_dir(arm, seed) / "adapter"
                if not (adapter / "adapter_model.safetensors").exists():
                    raise StudyError(f"Missing adapter for {arm} seed {seed}")
                s = self._student(factory, adapter)
                for split in splits:
                    self._evaluate(s, arm, split, seed, tasks, emit)
                getattr(s, "unload", lambda: None)()
        return {"splits": list(splits)}

    def _stage_evaluate_dev(self, emit: Callable, student_factory: Callable | None) -> dict:
        return self._evaluate_students(("dev",), emit, student_factory)

    def _stage_evaluate_test(self, emit: Callable, student_factory: Callable | None) -> dict:
        return self._evaluate_students(("test", "ood", "regression"), emit, student_factory)

    def _stage_seal(self, emit: Callable, confirm: str | None) -> dict:
        if confirm != "SEAL":
            raise StudyError("Sealing requires typing SEAL")
        adapters = {}
        for arm in self.plan["arms"]:
            for seed in self.plan["seeds"]:
                p = self.run_dir(arm, seed) / "adapter" / "adapter_model.safetensors"
                adapters[f"{arm}/seed{seed}"] = sha256_file(p)
        atomic_write_json(self.root / "seal.json", {"sealed_at": utcnow(), "adapters": adapters})
        emit({"event": "sealed", "adapters": adapters})
        return {"adapters": len(adapters)}

    # ---- analysis
    def observations(self, arm: str, split: str) -> list[dict]:
        seeds = [self.plan["eval"]["control_seed_broadcast"]] if arm in ("base", "teacher") else self.plan["seeds"]
        rows = []
        for s in seeds:
            for e in self.episodes(arm, split, s):
                rows.append({"seed": s, "group_id": e["group_id"], "task_id": e["task_id"], "family": e["family"],
                             "success": float(e["score"]["strict_success"]), "invalid": e["score"]["invalid_calls"],
                             "paraphrase": e["paraphrase"]})
        return rows

    def _rate(self, arm: str, split: str) -> float | None:
        obs = self.observations(arm, split)
        return (sum(o["success"] for o in obs) / len(obs)) if obs else None

    def analyze(self, splits: tuple[str, ...]) -> dict:
        control_seed = self.plan["eval"]["control_seed_broadcast"]
        report: dict[str, Any] = {"computed": True, "generated_at": utcnow(), "splits": {}, "plan_sha256":
                                  (self.root / "plan.sha256").read_text(encoding="utf-8").strip()}
        for split in splits:
            base = self.observations("base", split)
            sec: dict[str, Any] = {"base_rate": self._rate("base", split), "teacher_rate": self._rate("teacher", split),
                                   "arms": {}}
            for arm in self.plan["arms"]:
                a = self.observations(arm, split)
                if not a or not base:
                    continue
                c = st.analyze_contrast(a, base, broadcast_control_seed=control_seed)
                c["invalid_rate_arm"] = sum(o["invalid"] > 0 for o in a) / len(a)
                c["invalid_rate_control"] = sum(o["invalid"] > 0 for o in base) / len(base)
                c["teacher_gap_closed"] = st.teacher_gap_closed(c["control_rate"], c["arm_rate"], sec["teacher_rate"])
                # McNemar (diagnostic): one fixed paraphrase (p0) per group, per seed.
                mc = {}
                b0 = {o["group_id"]: o["success"] for o in base if o["paraphrase"] == 0}
                for s in self.plan["seeds"]:
                    a0 = {o["group_id"]: o["success"] for o in a if o["seed"] == s and o["paraphrase"] == 0}
                    bb = sum(1 for g in a0 if a0[g] and not b0.get(g))
                    cc = sum(1 for g in a0 if not a0[g] and b0.get(g))
                    mc[str(s)] = st.mcnemar_exact(bb, cc)
                c["mcnemar_diagnostic"] = mc
                # Per-family success (skill map) with Wilson intervals.
                fam: dict[str, Any] = {}
                for name, obs in (("base", base), (arm, a), ("teacher", self.observations("teacher", split))):
                    for f in sorted({o["family"] for o in obs}):
                        fo = [o for o in obs if o["family"] == f]
                        k = sum(o["success"] for o in fo)
                        fam.setdefault(f, {})[name] = {"rate": k / len(fo), "n": len(fo), "ci": st.wilson(k, len(fo))}
                c["families"] = fam
                sec["arms"][arm] = c
            report["splits"][split] = sec
        primary = self.plan["arms"][0]
        test = report["splits"].get("test", {}).get("arms", {}).get(primary)
        if test:
            secondary = {}
            for split in ("ood", "regression"):
                c = report["splits"].get(split, {}).get("arms", {}).get(primary)
                if c:
                    secondary[split] = c["sign_flip_groups"]["p"]
            for arm in self.plan["arms"][1:]:
                c = report["splits"]["test"]["arms"].get(arm)
                if c:
                    secondary[f"test:{arm}"] = c["sign_flip_groups"]["p"]
            report["holm_secondary"] = st.holm(secondary) if secondary else {}
            ood = report["splits"].get("ood", {}).get("arms", {}).get(primary)
            reg = report["splits"].get("regression", {}).get("arms", {}).get(primary)
            report["gate"] = st.review_gate(st.GateInput(
                profile=self.plan["profile"], n_seeds=len(self.plan["seeds"]), ci_low=test["ci_low"],
                min_gain=self.plan["min_gain"], p_group=test["sign_flip_groups"]["p"], p_seed=test["sign_flip_seeds"]["p"],
                invalid_call_delta=test["invalid_rate_arm"] - test["invalid_rate_control"],
                ood_delta_ci_low=ood["ci_low"] if ood else None, regression_delta_ci_low=reg["ci_low"] if reg else None,
                teacher_measured=report["splits"]["test"]["teacher_rate"] is not None))
        return report

    def _stage_analyze_dev(self, emit: Callable) -> dict:
        rep = self.analyze(("dev",))
        rep["note"] = "Development analysis — used for decisions before SEAL. Not the confirmatory result."
        (self.root / "reports").mkdir(exist_ok=True)
        atomic_write_json(self.root / "reports" / "analysis_dev.json", rep)
        return {"arms": list(rep["splits"]["dev"]["arms"])}

    def _stage_analyze_test(self, emit: Callable) -> dict:
        rep = self.analyze(("test", "ood", "regression"))
        (self.root / "reports").mkdir(exist_ok=True)
        atomic_write_json(self.root / "reports" / "analysis_test.json", rep)
        return {"gate": rep.get("gate", {}).get("verdict")}

    def _stage_export(self, emit: Callable, student_factory: Callable | None) -> dict:
        """Merge the primary arm's seed-0 adapter into a NEW bf16 directory, then re-evaluate it on test."""
        import torch
        from peft import PeftModel
        from transformers import AutoModelForCausalLM, AutoTokenizer
        arm, seed = self.plan["arms"][0], self.plan["seeds"][0]
        adapter = self.run_dir(arm, seed) / "adapter"
        out = self.root / "exports" / f"{arm}-seed{seed}-merged"
        if out.exists():
            raise StudyError(f"{out} exists; exports are immutable")
        dtype = torch.bfloat16 if self.plan["device"] == "cuda" else torch.float32
        base = AutoModelForCausalLM.from_pretrained(self.plan["student"]["path"], local_files_only=True,
                                                    trust_remote_code=False, torch_dtype=dtype)
        merged = PeftModel.from_pretrained(base, str(adapter)).merge_and_unload()
        merged.save_pretrained(out, safe_serialization=True)
        AutoTokenizer.from_pretrained(self.plan["student"]["path"], local_files_only=True).save_pretrained(out)
        del merged, base
        files = {p.name: sha256_file(p) for p in sorted(out.iterdir()) if p.is_file()}
        tasks = self.tasks()
        backend = student_factory(None, model_path=str(out)) if student_factory else TransformersBackend(
            str(out), None, device=self.plan["device"], max_new_tokens=self.plan["eval"]["max_new_tokens"])
        self._evaluate(backend, "merged", "test", seed, tasks, emit)
        getattr(backend, "unload", lambda: None)()
        merged_eps = {e["task_id"]: e["score"]["strict_success"] for e in self.episodes("merged", "test", seed)}
        adapter_eps = {e["task_id"]: e["score"]["strict_success"] for e in self.episodes(arm, "test", seed)}
        agree = sum(merged_eps[t] == adapter_eps.get(t) for t in merged_eps) / max(1, len(merged_eps))
        manifest = {"source_adapter": str(adapter), "adapter_sha256": sha256_file(adapter / "adapter_model.safetensors"),
                    "files": files, "post_merge_eval": {"split": "test", "agreement_with_adapter": agree,
                                                        "merged_rate": sum(merged_eps.values()) / max(1, len(merged_eps))},
                    "created_at": utcnow(), "note": "Merged bf16 copy. Original weights untouched."}
        atomic_write_json(out / "forge_export.json", manifest)
        return {"path": str(out), "agreement_with_adapter": agree}

    # ---- summaries for the API
    def summary(self) -> dict[str, Any]:
        s = self.state
        # A stage left "running" by a killed process (cancel, crash, reboot) is reported as interrupted.
        # Display-only: re-running the stage resumes from the verified JSONL and overwrites this status.
        for st in s["stages"].values():
            if st.get("status") == "running" and not StudyLock.holder_alive(int(st.get("pid") or 0), st.get("pid_created")):
                st["status"] = "interrupted"
        reports = {}
        for k in ("dev", "test"):
            p = self.root / "reports" / f"analysis_{k}.json"
            if p.exists():
                reports[k] = json.loads(p.read_text(encoding="utf-8"))
        nxt = next((x for x in STAGES[1:] if s["stages"].get(x, {}).get("status") != "completed"), None)
        return {"id": self.plan["study_id"], "plan": self.plan, "state": s, "next_stage": nxt, "reports": reports,
                "gpu_stages": sorted(GPU_STAGES), "path": str(self.root)}
