"""Hardware guard: thermal pause/resume at safe points, cool start, energy integration, settings API → job env."""
import json

from forge.engine.guard import Guard


def reader_from(seq):
    it = iter(seq)
    last = [None]

    def read():
        try:
            last[0] = next(it)
        except StopIteration:
            pass
        return last[0]
    return read


def test_thermal_pause_resume_and_energy():
    events = []
    g = Guard({"enabled": True, "max_temp_c": 83, "resume_temp_c": 75, "cpu_reserve": 0, "low_priority": False, "sample_s": 0.01},
              events.append, reader_from([(60, 200), (85, 250), (84, 250), (80, 240), (74, 180), (70, 150)]))
    g.sample()                    # 60 °C
    g.check()                     # cool: no pause
    g.sample()                    # 85 °C
    g.check()                     # pauses, samples until ≤ 75 °C
    kinds = [e["event"] for e in events]
    assert kinds == ["thermal_pause", "thermal_resume"] and g.pauses == 1 and g.temp <= 75
    s = g.summary()
    assert s["peak_temp_c"] == 85 and s["energy_wh"] >= 0 and s["thermal_pauses"] == 1


def test_disabled_and_no_gpu_never_pause():
    events = []
    g = Guard({"enabled": False, "max_temp_c": 60, "resume_temp_c": 50, "cpu_reserve": 0, "low_priority": False, "sample_s": 0.01}, events.append, lambda: (95, 300))
    g.sample(); g.check()
    g2 = Guard({"enabled": True, "max_temp_c": 60, "resume_temp_c": 50, "cpu_reserve": 0, "low_priority": False, "sample_s": 0.01}, events.append, lambda: (None, None))
    g2.sample(); g2.check()
    assert events == [] and g2.summary()["gpu_measured"] is False


def test_suspend_stops_energy_accounting():
    g = Guard({"enabled": True, "max_temp_c": 90, "resume_temp_c": 80, "cpu_reserve": 0, "low_priority": False, "sample_s": 0.01}, lambda e: None, lambda: (50, 300))
    g.sample(); g.sample()
    with g.suspend():               # entering records energy up to this point, then stops counting
        before = g.energy_j
        g.sample(); g.sample()
        assert g.energy_j == before
    g.sample()                      # after resuming, the suspended interval is not counted either
    assert g.energy_j - before < 300 * 1.0


def test_guard_settings_reach_job_env(settings):
    from fastapi.testclient import TestClient

    from forge.api.app import create_app
    from forge.api.routes_settings import guard_env
    with TestClient(create_app(settings)) as c:
        c.headers["X-Forge-Token"] = c.get("/api/system/session").json()["token"]
        assert c.get("/api/settings/hardware-guard").json()["max_temp_c"] == 83
        assert c.put("/api/settings/hardware-guard", json={"max_temp_c": 80, "resume_temp_c": 82}).status_code == 422
        r = c.put("/api/settings/hardware-guard", json={"max_temp_c": 80, "resume_temp_c": 70, "cpu_reserve": 1, "enabled": True, "low_priority": True}).json()
        assert r["max_temp_c"] == 80
        env = guard_env(c.app.state.forge.db)
        assert json.loads(env["FORGE_GUARD"])["max_temp_c"] == 80 and int(env["OMP_NUM_THREADS"]) >= 1
