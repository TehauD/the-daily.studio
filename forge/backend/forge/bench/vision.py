"""Vision Bench — reading synthetic administrative documents. FORGE draws every image (Pillow) with known contents, so
each answer is exact; nothing real is used. Administrative documents only — no medical images.

Documents: prior-authorization request forms, insurance-card style cards, service tables, bar charts.
Difficulty = image quality: 1 clean · 2 lower resolution · 3 slight rotation + blur · 4 fax-like (low resolution,
grey noise, rotation). The same question on worse images shows how robust a vision model is.
"""
from __future__ import annotations

import random
from pathlib import Path

from forge.bench.common import Item

CATEGORIES = {"form": "Prior-authorization form fields", "card": "Insurance-card fields", "table": "Table lookup", "chart": "Bar chart reading"}
FIRST = ["Avery", "Jordan", "Riley", "Casey", "Morgan", "Quinn", "Rowan", "Skyler", "Emerson", "Hayden"]
LAST = ["Sample", "Testcase", "Fictional", "Placeholder", "Demo", "Synthetic"]
SERVICES = ["MRI lumbar spine", "Physical therapy visit", "CPAP device", "Sleep study", "Home infusion day", "Knee arthroscopy", "Genetic panel", "Hearing aid fitting"]
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]


def _font(size: int):
    from PIL import ImageFont
    try:
        return ImageFont.load_default(size=size)
    except TypeError:  # very old Pillow
        return ImageFont.load_default()


def _canvas(w: int, h: int):
    from PIL import Image, ImageDraw
    im = Image.new("RGB", (w, h), "white")
    return im, ImageDraw.Draw(im)


def _degrade(im, lvl: int, rng: random.Random):
    """Every level stays readable by a person: the test is robustness, not illegibility."""
    from PIL import Image, ImageFilter
    if lvl >= 2:
        f = {2: 0.72, 3: 0.64, 4: 0.6}[lvl]
        im = im.resize((int(im.width * f), int(im.height * f)), Image.LANCZOS)
    if lvl >= 3:
        im = im.rotate(rng.uniform(-3.0, 3.0), expand=True, fillcolor="white", resample=Image.BICUBIC)
    if lvl == 3:
        im = im.filter(ImageFilter.GaussianBlur(0.45))
    if lvl == 4:  # fax-like: two-tone with light speckle
        g = im.convert("L")
        px = g.load()
        for _ in range(int(g.width * g.height * 0.004)):
            px[rng.randrange(g.width), rng.randrange(g.height)] = rng.choice([0, 120])
        im = g.point(lambda v: 0 if v < 170 else 255).convert("RGB")
    return im


def form(rng: random.Random):
    f = {"member_id": f"M-{rng.randrange(100000, 999999)}", "member": f"{rng.choice(FIRST)} {rng.choice(LAST)}", "code": f"PA-{rng.randrange(1001, 1064)}",
         "service": rng.choice(SERVICES), "units": str(rng.randrange(1, 30)), "date": f"2025-{rng.randrange(1, 12):02d}-{rng.randrange(1, 28):02d}",
         "urgency": rng.choice(["Expedited", "Standard"]), "provider": f"Dr. {rng.choice(LAST)} ({rng.randrange(1000, 9999)})"}
    im, d = _canvas(1000, 640)
    d.rectangle([20, 20, 980, 620], outline="black", width=2)
    d.text((40, 36), "PRIOR AUTHORIZATION REQUEST", fill="black", font=_font(30))
    d.text((40, 76), "Northwind Health Plan  -  SYNTHETIC SAMPLE, NOT A REAL FORM", fill="black", font=_font(16))
    rows = [("Member ID", f["member_id"]), ("Member name", f["member"]), ("Service code", f["code"]), ("Service", f["service"]),
            ("Units requested", f["units"]), ("Date received", f["date"]), ("Requesting provider", f["provider"])]
    y = 120
    for k, v in rows:
        d.text((40, y), k + ":", fill="black", font=_font(20))
        d.text((330, y), v, fill="black", font=_font(22))
        d.line([325, y + 28, 940, y + 28], fill="#999999")
        y += 54
    d.text((40, y + 6), "Urgency:", fill="black", font=_font(20))
    for i, opt in enumerate(["Expedited", "Standard"]):
        x = 330 + i * 230
        d.rectangle([x, y + 6, x + 22, y + 28], outline="black", width=2)
        if f["urgency"] == opt:
            d.line([x + 3, y + 9, x + 19, y + 25], fill="black", width=3)
            d.line([x + 19, y + 9, x + 3, y + 25], fill="black", width=3)
        d.text((x + 32, y + 6), opt, fill="black", font=_font(20))
    q = rng.choice([("What is the service code on this form?", f["code"], "text"), ("How many units are requested?", f["units"], "number"),
                    ("What is the date received? Answer as YYYY-MM-DD.", f["date"], "date"), ("Which urgency box is checked: Expedited or Standard?", f["urgency"], "text"),
                    ("What is the member ID?", f["member_id"], "text")])
    return im, q


def card(rng: random.Random):
    plan = rng.choice(["Northwind Choice PPO", "Lakeside Advantage", "Summit Care HMO"])
    f = {"plan": plan, "member_id": f"NW{rng.randrange(10000000, 99999999)}", "group": f"G-{rng.randrange(1000, 9999)}",
         "pcp": rng.choice([10, 20, 25, 30]), "spec": rng.choice([40, 50, 60, 75]), "er": rng.choice([150, 250, 350])}
    im, d = _canvas(860, 540)
    d.rounded_rectangle([10, 10, 850, 530], radius=28, outline="#1f4e79", width=4, fill="#f3f7fb")
    d.text((40, 36), plan, fill="#1f4e79", font=_font(34))
    d.text((40, 84), "MEMBER CARD  -  SYNTHETIC SAMPLE", fill="#333333", font=_font(16))
    d.text((40, 140), f"Member: {rng.choice(FIRST)} {rng.choice(LAST)}", fill="black", font=_font(24))
    d.text((40, 190), f"Member ID: {f['member_id']}", fill="black", font=_font(24))
    d.text((40, 240), f"Group: {f['group']}", fill="black", font=_font(24))
    d.text((480, 300), "Copays", fill="black", font=_font(22))
    for i, (k, v) in enumerate([("Primary care", f["pcp"]), ("Specialist", f["spec"]), ("Emergency", f["er"])]):
        d.text((480, 340 + i * 40), f"{k}: ${v}", fill="black", font=_font(22))
    q = rng.choice([("What is the specialist copay in dollars? Answer with the number.", str(f["spec"]), "number"),
                    ("What is the group number?", f["group"], "text"), ("What is the member ID?", f["member_id"], "text"),
                    ("What is the emergency copay in dollars? Answer with the number.", str(f["er"]), "number")])
    return im, q


def table(rng: random.Random):
    rows = [(s, rng.randrange(1, 40), rng.randrange(80, 4000)) for s in rng.sample(SERVICES, 6)]
    im, d = _canvas(900, 420)
    d.text((30, 20), "Authorized services - SYNTHETIC SAMPLE", fill="black", font=_font(24))
    cols = [30, 420, 600]
    for i, h in enumerate(["Service", "Units", "Unit cost ($)"]):
        d.text((cols[i], 70), h, fill="black", font=_font(20))
    d.line([25, 100, 875, 100], fill="black", width=2)
    for r, (s, u, c) in enumerate(rows):
        y = 112 + r * 46
        d.text((cols[0], y), s, fill="black", font=_font(20))
        d.text((cols[1], y), str(u), fill="black", font=_font(20))
        d.text((cols[2], y), str(c), fill="black", font=_font(20))
        d.line([25, y + 36, 875, y + 36], fill="#bbbbbb")
    s, u, c = rng.choice(rows)
    top = max(rows, key=lambda r: (r[1], r[0]))
    q = rng.choice([(f"How many units are authorized for {s}?", str(u), "number"), (f"What is the unit cost of {s}? Answer with the number.", str(c), "number"),
                    ("Which service has the most units?", top[0], "text")])
    return im, q


def chart(rng: random.Random):
    vals = {m: rng.randrange(20, 200) for m in MONTHS}
    while len(set(vals.values())) < len(vals):
        vals = {m: rng.randrange(20, 200) for m in MONTHS}
    im, d = _canvas(900, 560)
    d.text((30, 18), "Service-desk tickets per month - SYNTHETIC", fill="black", font=_font(24))
    x0, y0, h = 90, 500, 400
    d.line([x0, y0, 860, y0], fill="black", width=2)
    d.line([x0, y0, x0, y0 - h], fill="black", width=2)
    for v in range(0, 201, 50):
        y = y0 - v / 200 * h
        d.line([x0 - 6, y, 860, y], fill="#dddddd")
        d.text((40, y - 10), str(v), fill="black", font=_font(16))
    for i, (m, v) in enumerate(vals.items()):
        x = x0 + 30 + i * 125
        d.rectangle([x, y0 - v / 200 * h, x + 70, y0], fill="#2f5fd0")
        d.text((x + 18, y0 + 8), m, fill="black", font=_font(18))
        d.text((x + 14, y0 - v / 200 * h - 26), str(v), fill="black", font=_font(18))
    m = rng.choice(MONTHS)
    q = rng.choice([("Which month has the most tickets? Answer with the month as shown (e.g. Mar).", max(vals, key=vals.get), "text"),
                    (f"How many tickets were there in {m}? Answer with the number.", str(vals[m]), "number")])
    return im, q


GEN = {"form": form, "card": card, "table": table, "chart": chart}


def generate(n_per_cell: int, seed: int, out_dir: Path, categories: list[str] | None = None) -> list[Item]:
    rng = random.Random(f"vision:{seed}")
    out_dir.mkdir(parents=True, exist_ok=True)
    items = []
    for cat in categories or list(CATEGORIES):
        for lvl in (1, 2, 3, 4):
            for i in range(n_per_cell):
                im, (q, a, kind) = GEN[cat](rng)
                im = _degrade(im, lvl, rng)
                iid = f"vis-{cat}-{lvl}-{i:03d}"
                im.save(out_dir / f"{iid}.png", optimize=True)
                items.append(Item(iid, "vision", cat, lvl, q + '\nReply with ONE JSON object and nothing else: {"answer": "<your answer>"}.', a, kind, image=f"{iid}.png"))
    return items
