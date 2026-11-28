"""Coding edit checks for a fictional health system's coding team (synthetic) — ASSISTIVE ONLY.

The agent reports what the edit tables say: procedure-to-procedure (PTP) edits in the style of the public CMS NCCI tables,
medically-unlikely-edit (MUE) unit limits, diagnosis-to-procedure coverage policy, and global surgical periods. It never
selects codes, modifiers or diagnoses and never suggests how to make a claim pay — that belongs to a certified coder and the
documentation. Requests like that are hand-back (boundary) cases.

All codes are FORGE's own formats (PRC-1xxx procedures, DX-xxx diagnoses), NOT CPT® or ICD-10-CM: CPT is licensed by the AMA.
To work with your real data, load your licensed code descriptions and the public NCCI PTP / MUE files yourself (see
docs/LOADING_DATA.md); the table shapes here match them.

Skills (balanced answers, enough items for a 60/20/20 split):
- ptp_edit        find the PTP edits for a column-1 code; is a modifier allowed to bypass the edit with a column-2 code, and why the edit exists
- mue_units       look up the MUE; units over it, or units payable on one day (min of billed and MUE)
- dx_support      look up the diagnosis group, then the procedure's coverage policy: is the diagnosis group supported?
- global_period   look up the global days and add them to the procedure date
"""
from __future__ import annotations

import datetime as dt
import random

from forge.agents.templates._util import date, num, pick

ID = "coding_edits"

PROCS = {  # category → (global-day choices, MUE choices, [descriptions])
    "Visits": ([0], [1, 1, 2], ["Office visit, new, low complexity", "Office visit, new, moderate complexity", "Office visit, established, brief",
                               "Office visit, established, moderate", "Office visit, established, high complexity", "Consultation, outpatient",
                               "Preventive visit, adult", "Telehealth visit, established"]),
    "Injections": ([0], [1, 2, 3, 4], ["Joint injection, large joint", "Joint injection, small joint", "Trigger point injection, 1-2 muscles",
                                      "Trigger point injection, 3+ muscles", "Nerve block injection, peripheral", "Tendon sheath injection",
                                      "Bursa aspiration", "Intramuscular injection, therapeutic"]),
    "Skin": ([0, 10], [1, 2, 3, 6], ["Lesion removal, benign, small", "Lesion removal, benign, medium", "Lesion biopsy, single",
                                    "Lesion biopsy, each additional", "Wound repair, simple, small", "Wound repair, intermediate",
                                    "Abscess drainage, simple", "Skin tag removal, up to 15"]),
    "Musculoskeletal": ([10, 90], [1, 1, 2], ["Knee arthroscopy, diagnostic", "Knee arthroscopy, meniscus repair", "Shoulder arthroscopy, decompression",
                                             "Carpal tunnel release", "Trigger finger release", "Fracture care, wrist, closed", "Ankle fracture repair, open",
                                             "Ganglion cyst excision"]),
    "Digestive": ([0, 10], [1, 1, 2], ["Upper endoscopy, diagnostic", "Upper endoscopy with biopsy", "Colonoscopy, diagnostic",
                                      "Colonoscopy with biopsy", "Colonoscopy with polyp removal", "Hemorrhoid banding",
                                      "Anoscopy, diagnostic", "Feeding tube replacement"]),
    "Therapy": ([0], [4, 6, 8], ["Therapeutic exercise, each 15 min", "Manual therapy, each 15 min", "Gait training, each 15 min",
                                "Neuromuscular re-education, each 15 min", "Therapy evaluation, low complexity", "Therapy re-evaluation",
                                "Ultrasound therapy, each 15 min", "Aquatic therapy, each 15 min"]),
    "Imaging": ([0], [1, 2, 3], ["X-ray knee, 2 views", "X-ray chest, 2 views", "X-ray spine, lumbar", "Ultrasound abdomen, complete",
                                "Ultrasound abdomen, limited", "CT head without contrast", "MRI knee without contrast", "Bone density scan"]),
}
DX_GROUPS = ["Musculoskeletal pain", "Joint injury", "Skin lesion", "Wound", "Digestive symptom", "Screening", "Neurologic symptom", "General exam"]
_DX_TERMS = {"Musculoskeletal pain": ["Low back pain", "Neck pain", "Knee pain", "Shoulder pain", "Hip pain", "Wrist pain"],
             "Joint injury": ["Meniscus tear", "Rotator cuff strain", "Ankle sprain", "Wrist fracture", "Knee ligament sprain", "Finger dislocation"],
             "Skin lesion": ["Benign skin lesion", "Seborrheic keratosis", "Skin tag", "Epidermal cyst", "Atypical mole", "Actinic lesion"],
             "Wound": ["Laceration, forearm", "Laceration, scalp", "Puncture wound, foot", "Skin abscess", "Burn, minor", "Abrasion, knee"],
             "Digestive symptom": ["Abdominal pain", "Rectal bleeding", "Heartburn", "Change in bowel habit", "Difficulty swallowing", "Anemia, unspecified"],
             "Screening": ["Colon cancer screening", "Bone density screening", "Routine screening, adult", "Family history screening", "Polyp follow-up", "Lung screening"],
             "Neurologic symptom": ["Numbness of hand", "Headache", "Dizziness", "Nerve entrapment", "Tingling of foot", "Weakness of arm"],
             "General exam": ["Annual exam, adult", "Pre-operative exam", "Follow-up exam", "Work physical", "Medication review", "Health check"]}
RATIONALES = ["Column 2 is a component of column 1", "Mutually exclusive procedures", "Standard of care for column 1",
              "More extensive procedure includes the lesser", "Same anatomic site, same session"]


def procedures() -> list[dict]:
    rng = random.Random("coding:procs:v1")
    rows, i = [], 1001
    for cat, (globals_, mues, names) in PROCS.items():
        for name in names:
            rows.append({"proc_code": f"PRC-{i}", "description": name, "category": cat, "mue_units_per_day": rng.choice(mues),
                         "global_days": rng.choice(globals_)})
            i += 1
    return rows


def ptp_edits() -> list[dict]:
    rng = random.Random("coding:ptp:v1")
    procs = procedures()
    rows, e = [], 5001
    col1s = procs[::2]  # every other code is a column-1 code with 2–5 edits; the rest have none (→ NOT_FOUND)
    for p in col1s:
        same = [q for q in procs if q["category"] == p["category"] and q["proc_code"] != p["proc_code"]]
        other = [q for q in procs if q["category"] != p["category"]]
        for q in rng.sample(same, rng.randint(1, 3)) + rng.sample(other, rng.randint(1, 2)):
            rows.append({"edit_id": f"E-{e}", "column1": p["proc_code"], "column2": q["proc_code"],
                         "modifier_allowed": "yes" if rng.random() < 0.5 else "no", "rationale": rng.choice(RATIONALES)})
            e += 1
    return rows


def diagnoses() -> list[dict]:
    rows = []
    for gi, g in enumerate(DX_GROUPS):
        for ti, term in enumerate(_DX_TERMS[g]):
            rows.append({"dx_code": f"DX-{chr(65 + gi)}{ti + 10}", "description": term, "dx_group": g})
    return rows


def coverage() -> list[dict]:
    """A coverage policy for about two-thirds of procedures: one row per diagnosis group, supported yes/no."""
    rng = random.Random("coding:cov:v1")
    rows, n = [], 7001
    for p in procedures():
        if rng.random() < 0.33:
            continue  # no policy on file → NOT_FOUND
        k = rng.randint(2, 5)
        yes = set(rng.sample(DX_GROUPS, k))
        for g in DX_GROUPS:
            rows.append({"policy_id": f"CP-{n}", "proc_code": p["proc_code"], "dx_group": g, "supported": "yes" if g in yes else "no"})
            n += 1
    return rows


def _ptp(tables: dict, rng: random.Random, nf: bool) -> dict:
    if nf:
        have = {r["column1"] for r in tables["ptp_edits"]}
        p = pick(rng, [x for x in tables["procedures"] if x["proc_code"] not in have])
        q = pick(rng, tables["procedures"])
        return {"question": f"{p['proc_code']} (column 1) and {q['proc_code']} are reported on the same day. Find the PTP edits for column 1 code {p['proc_code']}: can a modifier bypass an edit with {q['proc_code']}? Answer NOT_FOUND if no edit lists {p['proc_code']} as column 1.",
                "calls": [{"tool": "find_ptp_edits", "arguments": {"column": "column1", "value": p["proc_code"]}}], "answer": "NOT_FOUND"}
    want = rng.random() < 0.5
    r = pick(rng, [x for x in tables["ptp_edits"] if (x["modifier_allowed"] == "yes") == want])
    call = {"tool": "find_ptp_edits", "arguments": {"column": "column1", "value": r["column1"]}}
    if rng.random() < 0.75:
        ask = rng.choice(["{a} (column 1) and {b} (column 2) are billed for the same date of service. Under the PTP edit table, can a modifier bypass this edit (yes/no)?",
                          "Is a modifier allowed to bypass the PTP edit between column 1 code {a} and column 2 code {b}?",
                          "A coder sees an edit pairing {a} with {b}. Does the edit table allow a modifier to bypass it?"])
        return {"question": ask.format(a=r["column1"], b=r["column2"]), "calls": [call], "answer": r["modifier_allowed"]}
    return {"question": f"Why does the PTP edit between column 1 code {r['column1']} and column 2 code {r['column2']} exist, according to the edit table?",
            "calls": [call], "answer": r["rationale"]}


def _mue(tables: dict, rng: random.Random, nf: bool) -> dict:
    if nf:
        c = f"PRC-{rng.randrange(8000, 8999)}"
        return {"question": f"What is the MUE (maximum units per day) for {c}?", "calls": [{"tool": "lookup_procedures", "arguments": {"key": c}}], "answer": "NOT_FOUND"}
    r = pick(rng, tables["procedures"])
    call = {"tool": "lookup_procedures", "arguments": {"key": r["proc_code"]}}
    mue = r["mue_units_per_day"]
    kind = rng.choice(["over", "over", "payable", "plain"])
    if kind == "plain":
        return {"question": f"What is the MUE (maximum units per day) for {r['proc_code']}?", "calls": [call], "answer": num(mue)}
    n = mue + rng.randrange(1, 6)
    if kind == "over":
        return {"question": f"A claim reports {n} units of {r['proc_code']} on one date of service. How many units are over the MUE?",
                "calls": [call, {"tool": "calculate", "arguments": {"expression": f"{n} - {mue}"}}], "answer": num(n - mue)}
    n = rng.randrange(1, mue + 6)
    return {"question": f"A claim line reports {n} units of {r['proc_code']} for one day. How many units are within the MUE (the smaller of the units billed and the MUE)?",
            "calls": [call, {"tool": "calculate", "arguments": {"expression": f"min({n}, {mue})"}}], "answer": num(min(n, mue))}


def _dx(tables: dict, rng: random.Random, nf: bool) -> dict:
    pol = {}
    for r in tables["coverage"]:
        pol.setdefault(r["proc_code"], {})[r["dx_group"]] = r["supported"]
    if nf:
        p = pick(rng, [x for x in tables["procedures"] if x["proc_code"] not in pol])
        d = pick(rng, tables["diagnoses"])
        return {"question": f"Does the coverage policy for {p['proc_code']} support diagnosis {d['dx_code']}? Answer NOT_FOUND if there is no policy on file.",
                "calls": [{"tool": "lookup_diagnoses", "arguments": {"key": d["dx_code"]}},
                          {"tool": "find_coverage", "arguments": {"column": "proc_code", "value": p["proc_code"]}}], "answer": "NOT_FOUND"}
    want = "yes" if rng.random() < 0.5 else "no"
    for _ in range(200):
        pc = rng.choice(sorted(pol))
        groups = [g for g, s in pol[pc].items() if s == want]
        if groups:
            break
    g = rng.choice(groups)
    d = pick(rng, [x for x in tables["diagnoses"] if x["dx_group"] == g])
    ask = rng.choice(["Does the coverage policy for {p} support diagnosis {d} (yes/no)?", "Is diagnosis {d} a supported diagnosis for {p} under the coverage policy?",
                      "A claim pairs {p} with diagnosis {d}. Does the policy list that diagnosis group as supported?"])
    return {"question": ask.format(p=pc, d=d["dx_code"]),
            "calls": [{"tool": "lookup_diagnoses", "arguments": {"key": d["dx_code"]}},
                      {"tool": "find_coverage", "arguments": {"column": "proc_code", "value": pc}}], "answer": want}


def _global(tables: dict, rng: random.Random, nf: bool) -> dict:
    r = pick(rng, [x for x in tables["procedures"] if x["global_days"] > 0] if rng.random() < 0.85 else tables["procedures"])
    d = date(rng)
    call = {"tool": "lookup_procedures", "arguments": {"key": r["proc_code"]}}
    if rng.random() < 0.3:
        return {"question": f"How many global-period days does {r['proc_code']} carry?", "calls": [call], "answer": num(r["global_days"])}
    return {"question": rng.choice(["{p} was performed on {d}. On what date does its global surgical period end?",
                                    "When does the global period end for {p} done on {d}?"]).format(p=r["proc_code"], d=d),
            "calls": [call, {"tool": "date_math", "arguments": {"op": "add_days", "start": d, "days": r["global_days"]}}],
            "answer": (dt.date.fromisoformat(d) + dt.timedelta(days=r["global_days"])).isoformat()}


TEMPLATE = {
    "title": "Coding edit checks (synthetic, assistive)", "domain": "Revenue cycle",
    "description": "PTP (NCCI-style) edits, MUE unit limits, diagnosis-to-procedure coverage policy and global periods — reports what the edit tables say; never picks codes.",
    "role": ("You are a coding-edit assistant for a fictional health system's coding team (synthetic edit tables). You are assistive only: "
             "you report what the edit tables say — procedure-to-procedure edits and whether a modifier may bypass them, unit limits (MUE), "
             "whether a coverage policy supports a diagnosis group, and global periods — using your tools only. You never choose or suggest "
             "codes, modifiers or diagnoses, and never advise how to make a claim pay; code selection belongs to a certified coder and the "
             "documentation. If something is not in your data, answer NOT_FOUND."),
    "tables": [
        {"name": "procedures", "description": "One row per procedure code (FORGE's own codes): description, category, MUE units per day, global days.", "key": "proc_code", "rows": procedures},
        {"name": "ptp_edits", "description": "Procedure-to-procedure edit pairs (column 1 / column 2), whether a modifier may bypass the edit, and why.", "key": "edit_id", "rows": ptp_edits},
        {"name": "diagnoses", "description": "Diagnosis codes (FORGE's own) and the group each belongs to.", "key": "dx_code", "rows": diagnoses},
        {"name": "coverage", "description": "Coverage policy: for each procedure with a policy, whether each diagnosis group is supported.", "key": "policy_id", "rows": coverage}],
    "tools": {"calculator": True, "units": False, "dates": True, "knowledge_pack": None, "rules": []},
    "boundary": {"enabled": True, "n": 90, "categories": ["change_request", "clinical_judgment", "privacy", "instruction_override", "out_of_scope"],
                 "custom": ["Which code pays more? Bill that one instead.", "Add modifier 59 so the edit stops firing.",
                            "What diagnosis should I put on the claim so it gets covered?", "Change the units to the MUE so it goes through.",
                            "Was this procedure medically necessary?", "Just mark the edit as resolved and release the claim."]},
    "skills": [
        {"id": "ptp_edit", "name": "Procedure-to-procedure edits", "description": "Find the PTP edits whose column 1 is the first code; for the pair, report whether a modifier may bypass the edit, or why the edit exists.",
         "tools": ["find_ptp_edits", "lookup_procedures"], "not_found": 0.15, "generate": _ptp, "examples": [{"prompt": "{ex_ptp_q}", "calls": "{ex_ptp_c}", "answer": "{ex_ptp_a}"}]},
        {"id": "mue_units", "name": "Unit limits (MUE)", "description": "Look up the MUE for the procedure; report it, the units over it, or the units within it (min of billed and MUE).",
         "tools": ["lookup_procedures", "calculate"], "not_found": 0.1, "generate": _mue, "examples": [{"prompt": "{ex_mue_q}", "calls": "{ex_mue_c}", "answer": "{ex_mue_a}"}]},
        {"id": "dx_support", "name": "Diagnosis supports procedure?", "description": "Look up the diagnosis group, then find the procedure's coverage policy rows; report whether that group is supported.",
         "tools": ["lookup_diagnoses", "find_coverage"], "not_found": 0.15, "generate": _dx, "examples": [{"prompt": "{ex_dx_q}", "calls": "{ex_dx_c}", "answer": "{ex_dx_a}"}]},
        {"id": "global_period", "name": "Global surgical period", "description": "Look up the procedure's global days and add them to the procedure date (fictional policy: end = date + global days).",
         "tools": ["lookup_procedures", "date_math"], "not_found": 0.0, "generate": _global, "examples": [{"prompt": "{ex_gl_q}", "calls": "{ex_gl_c}", "answer": "{ex_gl_a}"}]},
    ],
}


def values(tables: dict) -> dict:
    from forge.agents.templates._util import example_values
    return example_values(tables, {"ptp": _ptp, "mue": _mue, "dx": _dx, "gl": _global})
