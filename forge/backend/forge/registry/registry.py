from __future__ import annotations

import json
from typing import Any

from forge.db import Database
from forge.hardware.profiles import EstimateInput, estimate_lora_memory
from forge.providers.base import DiscoveredModel
from forge.registry.roles import eligibility
from forge.util import stable_id, utcnow

JSON_COLS = ("metadata", "capabilities")


class RegistryError(ValueError):
    pass


def _row(r: dict[str, Any]) -> dict[str, Any]:
    for c in JSON_COLS:
        r[c] = json.loads(r[c])
    return r


class ModelRegistry:
    def __init__(self, db: Database):
        self.db = db

    def upsert(self, m: DiscoveredModel, capabilities: dict) -> str:
        mid = stable_id("mdl", m.provider, m.locator)
        now = utcnow()
        with self.db.tx() as c:
            c.execute(
                """INSERT INTO models(id, provider, locator, name, architecture, parameter_count, parameter_count_source,
                       quantization, context_length, format, storage_path, size_bytes, license, metadata, capabilities,
                       status, first_seen, last_seen)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'available',?,?)
                   ON CONFLICT(provider, locator) DO UPDATE SET
                       name=excluded.name, architecture=excluded.architecture, parameter_count=excluded.parameter_count,
                       parameter_count_source=excluded.parameter_count_source, quantization=excluded.quantization,
                       context_length=excluded.context_length, format=excluded.format, storage_path=excluded.storage_path,
                       size_bytes=excluded.size_bytes, license=excluded.license, metadata=excluded.metadata,
                       capabilities=excluded.capabilities, status='available', last_seen=excluded.last_seen""",
                (mid, m.provider, m.locator, m.name, m.architecture, m.parameter_count, m.parameter_count_source,
                 m.quantization, m.context_length, m.format, m.storage_path, m.size_bytes, m.license,
                 json.dumps(m.metadata, default=str), json.dumps(capabilities), now, now),
            )
        return mid

    def mark_unseen(self, provider: str, seen_ids: set[str], status: str) -> int:
        rows = self.db.query("SELECT id FROM models WHERE provider = ? AND status = 'available'", (provider,))
        stale = [r["id"] for r in rows if r["id"] not in seen_ids]
        with self.db.tx() as c:
            c.executemany("UPDATE models SET status = ? WHERE id = ?", [(status, i) for i in stale])
        return len(stale)

    def mark_provider(self, provider: str, status: str) -> None:
        with self.db.tx() as c:
            c.execute("UPDATE models SET status = ? WHERE provider = ? AND status = 'available'", (status, provider))

    def purge_missing(self) -> int:
        """Delete rows marked 'missing' (files gone from an authoritative scan). Roles cascade."""
        with self.db.tx() as c:
            n = c.execute("DELETE FROM models WHERE status = 'missing'").rowcount
        return n

    def list(self, provider: str | None = None, include_missing: bool = True,
             include_ineligible: bool = True) -> list[dict]:
        sql = "SELECT m.*, (SELECT group_concat(role) FROM model_roles r WHERE r.model_id = m.id) AS roles FROM models m"
        clauses, params = [], []
        if provider:
            clauses.append("provider = ?")
            params.append(provider)
        if not include_missing:
            clauses.append("status = 'available'")
        if clauses:
            sql += " WHERE " + " AND ".join(clauses)
        sql += " ORDER BY provider, name"
        out = []
        for r in self.db.query(sql, tuple(params)):
            r = _row(r)
            r["roles"] = sorted(r["roles"].split(",")) if r["roles"] else []
            r["eligibility"] = eligibility(r)
            if not include_ineligible and r["eligibility"]["kind"] not in ("generative", "unknown"):
                continue
            out.append(r)
        return out

    def get(self, model_id: str) -> dict:
        r = self.db.one("SELECT m.*, (SELECT group_concat(role) FROM model_roles r WHERE r.model_id = m.id) AS roles "
                        "FROM models m WHERE id = ?", (model_id,))
        if not r:
            raise RegistryError(f"Unknown model: {model_id}")
        r = _row(r)
        r["roles"] = sorted(r["roles"].split(",")) if r["roles"] else []
        r["eligibility"] = eligibility(r)
        return r

    # --- roles ---
    def assign_role(self, model_id: str, role: str) -> dict:
        if role not in ("teacher", "student"):
            raise RegistryError("Role must be 'teacher' or 'student'")
        m = self.get(model_id)
        el = m["eligibility"][role]
        if el["verdict"] == "fail":
            failed = "; ".join(f"{c['check']}: {c['reason']}" for c in el["checks"] if c["status"] == "fail")
            raise RegistryError(f"Not eligible as {role} — {failed}")
        if m["status"] != "available":
            raise RegistryError(f"Model status is '{m['status']}'")
        with self.db.tx() as c:
            c.execute("INSERT OR IGNORE INTO model_roles(model_id, role, assigned_at) VALUES (?,?,?)", (model_id, role, utcnow()))
        return self.get(model_id)

    def remove_role(self, model_id: str, role: str) -> dict:
        with self.db.tx() as c:
            c.execute("DELETE FROM model_roles WHERE model_id = ? AND role = ?", (model_id, role))
        return self.get(model_id)

    def pair_check(self, teacher_id: str, student_id: str) -> dict:
        t, s = self.get(teacher_id), self.get(student_id)
        tc, sc = t["capabilities"], s["capabilities"]
        checks = []

        def add(name, ok, reason):
            checks.append({"check": name, "status": ok, "reason": reason})

        add("teacher_inference", "pass" if tc["inference"]["status"] == "supported" else "fail", tc["inference"]["reason"])
        trainable = sc["lora"]["status"] == "supported" or sc["qlora"]["status"] == "supported"
        add("student_trainable", "pass" if trainable else ("warn" if "conditional" in (sc["lora"]["status"], sc["qlora"]["status"]) else "fail"),
            sc["lora"]["reason"])
        add("student_inference", "pass" if sc["inference"]["status"] == "supported" else "warn", "Needed for baseline and post-training evaluation.")
        def gen(m: dict) -> str:
            k = m["eligibility"]["kind"]
            return "pass" if k == "generative" else ("warn" if k == "unknown" else "fail")

        add("teacher_generative", gen(t), t["metadata"].get("model_kind_evidence", "kind not determined"))
        add("student_generative", gen(s), s["metadata"].get("model_kind_evidence", "kind not determined"))
        tp, sp = t.get("parameter_count"), s.get("parameter_count")
        sp_unique = (s["metadata"].get("parameter_report") or {}).get("unique_total") or sp
        ratio = (tp / sp_unique) if (tp and sp_unique) else None
        if ratio:
            add("capacity_ratio", "pass" if ratio >= 2 else "warn",
                f"Teacher/student = {ratio:.1f}× ({tp/1e9:.2f}B / {sp_unique/1e9:.2f}B unique).")
        tt = tc["tool_calling"]["status"]
        add("teacher_tool_calling", "pass" if tt == "supported" else "warn", tc["tool_calling"]["reason"])
        # Logit-level KD needs teacher logits and an identical vocabulary.
        tv, sv = t["metadata"].get("vocab_size"), s["metadata"].get("vocab_size")
        logit_kd = tc["logits"]["status"] == "supported" and sc["logits"]["status"] == "supported" and tv and tv == sv
        add("logit_distillation", "pass" if logit_kd else "info",
            "Teacher logits available with matching vocabulary." if logit_kd else
            "Behavioral (sequence-level) distillation only: teacher logits unavailable or vocabularies differ.")
        md = s["metadata"]
        vram = None
        if sp:
            est = estimate_lora_memory(EstimateInput(
                params_b=sp / 1e9, quant="bf16", seq_len=2048, hidden=md.get("hidden_size"), layers=md.get("num_hidden_layers"),
                intermediate=md.get("intermediate_size"), vocab=md.get("vocab_size"), num_heads=md.get("num_attention_heads"),
                num_kv_heads=md.get("num_key_value_heads"), head_dim=md.get("head_dim")), 16376)
            vram = est.to_dict()
            add("student_vram_lora_bf16", {"safe": "pass", "tight": "warn"}.get(est.verdict, "fail"),
                f"Estimated {est.total_mb/1024:.1f} GB peak at seq 2048 vs 16 GB device (analytic, ±25%).")
        local_teacher = t["provider"] in ("lmstudio", "ollama") or t["format"] in ("gguf", "ollama")
        if local_teacher:
            add("one_gpu", "info", "Teacher and student share one GPU: the teacher must be unloaded before training "
                "and student evaluation (enforced by the training pre-flight).")
        for c in t["eligibility"]["teacher"]["checks"]:
            if c["check"] == "reasoning_first":
                add("teacher_reasoning_first", "warn", c["reason"])
        verdict = "fail" if any(c["status"] == "fail" for c in checks) else (
            "warn" if any(c["status"] == "warn" for c in checks) else "pass")
        return {"teacher": t["name"], "student": s["name"], "teacher_id": t["id"], "student_id": s["id"],
                "verdict": verdict, "capacity_ratio": ratio, "vram_estimate": vram,
                "distillation_modes": ["behavioral"] + (["logit_kd"] if logit_kd else []), "checks": checks}
