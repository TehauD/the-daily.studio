"""Starter agents for Agent Studio. Every template is SYNTHETIC: invented organisations, records and codes (public code
systems are used only where they are free to use, with paraphrased descriptions). They show a domain agent end to end;
FORGE makes no claim that an agent trained on them is fit for real-world, clinical, or security-critical use.

A template module defines:
    TEMPLATE  title, domain, description, role, tables (name, description, key, rows: callable), tools, skills
    values(tables) -> dict   bindings for the {placeholders} in the skills' examples
Each skill may carry `generate(tables, rng, not_found) -> {"question", "calls", "answer"}`: a built-in task generator, so
verified practice tasks can be created without a teacher. Generated tasks pass the same verification as teacher-written ones.
"""
from __future__ import annotations

import random
from types import ModuleType
from typing import Any, Callable

from forge.agents.templates import blank, claims_denials, itsm_servicenow, patient_access, pharmacy_benefits, prior_auth, security_triage

MODULES: dict[str, ModuleType] = {m.ID: m for m in (blank, itsm_servicenow, patient_access, pharmacy_benefits, claims_denials,
                                                   prior_auth, security_triage)}
TEMPLATES = {k: m.TEMPLATE for k, m in MODULES.items()}


def catalogue() -> list[dict[str, Any]]:
    return [{"id": k, "title": t["title"], "domain": t["domain"], "description": t["description"],
             "skills": [s["name"] for s in t["skills"]], "tables": [x["name"] for x in t["tables"]]} for k, t in TEMPLATES.items()]


def build_tables(template: str) -> dict[str, list[dict]]:
    return {ts["name"]: ts["rows"]() for ts in TEMPLATES[template]["tables"]}


def stored_skills(template: str, tables: dict[str, list[dict]]) -> list[dict]:
    """Skills as saved in agent.json: examples bound to real rows; generators referenced by template, never serialised."""
    vals = MODULES[template].values(tables)
    out = []
    for s in TEMPLATES[template]["skills"]:
        d = {k: v for k, v in s.items() if k != "generate"}
        d["examples"] = _bind(d.get("examples", []), vals)
        d["generator"] = "generate" in s
        out.append(d)
    return out


def generator(template: str, skill_id: str) -> Callable[[dict, random.Random, bool], dict] | None:
    t = TEMPLATES.get(template)
    if not t:
        return None
    return next((s.get("generate") for s in t["skills"] if s["id"] == skill_id), None)


def _bind(x: Any, vals: dict[str, Any]) -> Any:
    if isinstance(x, str):
        if x.startswith("{") and x.endswith("}") and x.count("{") == 1 and x[1:-1] in vals:
            return vals[x[1:-1]]  # whole-value placeholder keeps its type (numbers stay numbers)
        return x.format(**vals) if "{" in x else x
    if isinstance(x, list):
        return [_bind(v, vals) for v in x]
    if isinstance(x, dict):
        return {k: _bind(v, vals) for k, v in x.items()}
    return x
