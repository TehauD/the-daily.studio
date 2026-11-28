"""Evidence engine: verdicts from real study files (episodes written with the study's own writer, analysed by its own statistics)."""
import json

from forge.engine.evidence import evidence
from forge.engine.runtime import Completion, OracleBackend
from forge.engine.study import Study


class Wrong:
    """A student that always answers something wrong (never calls a tool)."""
    name = "wrong"

    def complete(self, messages):
        return Completion(json.dumps({"answer": "I do not know"}), latency_ms=1)


def _study(tmp_path, arms, ctl_backend):
    s = Study.init(tmp_path / "studies", name="ev", profile="smoke", device="cpu", seeds=[0, 1],
                   teacher={"provider": "lmstudio", "endpoint": "http://127.0.0.1:9/v1", "model": "t"},
                   student={"name": "s", "path": "/x"}, arms=arms, train_overrides={"min_free_vram_mb": 0})
    oracle = OracleBackend({t.prompt: t for t in s.tasks()})
    s.run_stage("collect", emit=lambda e: None, teacher_backend=oracle)
    tasks = s.tasks()
    s._evaluate(Wrong(), "base", "dev", 0, tasks, lambda e: None)
    for sd in (0, 1):
        s._evaluate(oracle, arms[0], "dev", sd, tasks, lambda e: None)
        if len(arms) > 1:
            s._evaluate(ctl_backend(oracle), arms[1], "dev", sd, tasks, lambda e: None)
    rep = s.analyze(("dev",))
    (s.root / "reports").mkdir(exist_ok=True)
    (s.root / "reports" / "analysis_dev.json").write_text(json.dumps(rep))
    return s


def test_learned_and_control_flat(tmp_path):
    e = evidence(_study(tmp_path, ["teacher_filtered", "shuffled_control"], lambda o: Wrong()))
    assert e["verdict"]["status"] == "learned_and_valid", e["verdict"]
    c = e["components"]["dev"]
    assert c["teacher_filtered"]["strict_success"]["rate"] == 1.0 and c["base"]["strict_success"]["rate"] == 0.0
    assert c["shuffled_control"]["strict_success"]["rate"] == 0.0 and c["base"]["invalid"]["rate"] is not None
    assert set(e["seeds"]["dev"]["teacher_filtered"]) == {"0", "1"}
    assert e["fixed_total"] == c["base"]["n"]                       # every task fixed by the perfect arm
    assert e["contrasts"]["dev"]["teacher_filtered"]["ci"][0] > 0


def test_control_that_also_gains_is_flagged(tmp_path):
    e = evidence(_study(tmp_path, ["teacher_filtered", "shuffled_control"], lambda o: o))   # broken "control": perfect too
    assert e["verdict"]["status"] == "control_failed"


def test_no_control_and_no_gain(tmp_path):
    s = _study(tmp_path, ["teacher_filtered"], None)
    e = evidence(s)
    assert e["verdict"]["status"] == "learned" and "shuffled_control" in e["verdict"]["text"]
