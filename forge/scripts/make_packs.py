"""Build task packs from FORGE's built-in templates (synthetic), with template-generated, verified practice tasks.

    python scripts/make_packs.py --out packs                       # every template that has built-in task generators
    python scripts/make_packs.py --out packs --template itsm_servicenow --per-skill 60

Each pack is data only (agent spec, synthetic tables, verified tasks) — see docs/SHARING.md. Runs offline; no server needed.
"""
from __future__ import annotations

import argparse
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from forge.agents import packs, templates  # noqa: E402
from forge.agents.agent import Agent, AgentError  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default="packs")
    ap.add_argument("--template", action="append", help="template id (repeatable); default: all with generators")
    ap.add_argument("--per-skill", type=int, default=40)
    ap.add_argument("--version", default="1.0.0")
    a = ap.parse_args()
    ids = a.template or [k for k, t in templates.TEMPLATES.items() if any(s.get("generate") for s in t["skills"])]
    out = Path(a.out)
    with tempfile.TemporaryDirectory() as td:
        for tid in ids:
            t = templates.TEMPLATES[tid]
            ag = Agent.create(Path(td), t["title"], tid, True)
            try:
                s = ag.run_tasks(None, per_skill=a.per_skill, seed=7, source="template")
            except AgentError as e:
                print(f"skip {tid}: {e}")
                continue
            r = packs.export(ag, out, {"id": tid, "version": a.version, "name": t["title"], "domain": t["domain"], "description": t["description"],
                                       "author": "FORGE built-in template (synthetic)", "licence": "same as FORGE"})
            print(f"{r['path']}  {r['pack']['tasks']} tasks  {r['bytes'] // 1024} KB  (accepted {s.get('accepted')}, rejected {s.get('rejected')})")


if __name__ == "__main__":
    main()
