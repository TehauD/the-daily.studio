"""Supply chain item-master clean-up and reorder arithmetic for a fictional hospital materials team (synthetic).

Invented items, manufacturers, part numbers, units of measure, costs and usage. Some item-master records are duplicates of
an active record (same manufacturer part, messier description) — the classic clean-up problem. The agent finds the active
record, converts units of measure, and works out reorder points, order-to-par quantities and days on hand. It never places,
changes or approves orders and never changes par levels; it gives no clinical guidance on product use (hand-back cases).

Fictional policy: reorder point = average daily use × lead time (days) + safety stock; reorder when on hand minus the reorder
point is zero or below.

Skills (balanced answers, enough items for a 60/20/20 split):
- item_master     duplicate → its active record; manufacturer part → the active item; unit of measure / pack size lookups
- uom_convert     boxes or cases ↔ eaches, and cost of N packs (pack size × unit cost)
- reorder_check   on hand − (daily use × lead time + safety stock), then the reorder rule (yes/no)
- par_and_days    eaches needed to reach par, or days the on-hand quantity lasts at average daily use
"""
from __future__ import annotations

import random

from forge.agents.templates._util import num, pick

ID = "supply_chain"

MFRS = ["Northgate Medical", "Alder Surgical", "Brightline Supply", "Corvane Health", "Meridian Disposables", "Tallis Labware"]
ITEMS = {  # category → [(clean description, messy duplicate description, uom, pack size)]
    "Gloves": [("Glove, exam, nitrile, small", "GLOVE NITRILE SM PF", "BX", 100), ("Glove, exam, nitrile, medium", "GLV NITR MED", "BX", 100),
               ("Glove, exam, nitrile, large", "Nitrile glove LG box", "BX", 100), ("Glove, surgical, sterile, size 7", "GLOVE STER 7.0", "BX", 50),
               ("Glove, surgical, sterile, size 8", "Surg glove sz 8", "BX", 50)],
    "IV & infusion": [("IV start kit", "IV START KIT W/ TEGADERM", "CS", 50), ("Catheter, IV, 20 gauge", "CATH IV 20G 1IN", "BX", 50),
                      ("Catheter, IV, 22 gauge", "IV cath 22g", "BX", 50), ("Extension set, 7 inch", "EXT SET 7IN", "CS", 100),
                      ("Saline flush syringe, 10 mL", "NS FLUSH 10ML", "CS", 120), ("Infusion set, primary", "PRIMARY IV SET", "CS", 48)],
    "Wound care": [("Gauze sponge, 4 x 4, sterile", "GAUZE 4X4 STER 2PK", "BX", 50), ("Foam dressing, 4 x 4", "FOAM DRSG 4X4", "BX", 10),
                   ("Transparent film dressing, 4 x 5", "FILM DRESSING 4X5", "BX", 50), ("Tape, paper, 1 inch", "PAPER TAPE 1IN", "BX", 12),
                   ("Abdominal pad, 8 x 10", "ABD PAD 8X10", "CS", 36)],
    "Respiratory": [("Nasal cannula, adult", "CANNULA NASAL ADLT", "CS", 50), ("Oxygen mask, adult", "O2 MASK ADULT", "CS", 50),
                    ("Nebulizer kit", "NEB KIT HANDHELD", "CS", 50), ("Suction catheter, 14 Fr", "SUCTION CATH 14FR", "CS", 100)],
    "Specimen": [("Specimen cup, sterile, 4 oz", "SPEC CUP 4OZ STER", "CS", 100), ("Swab, culture, single", "CULTURE SWAB", "BX", 50),
                 ("Blood collection tube, 4 mL", "TUBE BLD 4ML", "BX", 100), ("Biohazard bag, 6 x 9", "BIOHAZ BAG 6X9", "CS", 1000)],
    "General": [("Underpad, 23 x 36", "UNDERPAD 23X36", "CS", 150), ("Alcohol prep pad", "ALC PREP PAD MED", "BX", 200),
                ("Disinfecting wipe canister", "DISINF WIPES CAN", "CS", 12), ("Isolation gown, yellow", "GOWN ISOL YEL", "CS", 50),
                ("Face mask, procedure", "MASK PROCEDURE EARLOOP", "BX", 50), ("Thermometer probe cover", "PROBE COVERS", "BX", 25)],
}


def items() -> list[dict]:
    rng = random.Random("supply:items:v1")
    rows, i = [], 3001
    dups = []
    for cat, lst in ITEMS.items():
        for clean, messy, uom, pack in lst:
            mfr = rng.choice(MFRS)
            part = f"{mfr[:2].upper()}-{rng.randrange(1000, 9999)}{rng.choice('ABCDEFGH')}"
            adu = rng.choice([2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40])
            lead = rng.choice([2, 3, 4, 5, 7, 10, 14])
            ss = adu * rng.choice([1, 2, 3])
            par = adu * lead + ss + adu * rng.choice([2, 4, 6])
            row = {"item_id": f"ITM-{i}", "description": clean, "category": cat, "manufacturer": mfr, "mfr_part": part, "uom": uom,
                   "each_per_uom": pack, "unit_cost": f"{rng.randrange(4, 900) / 100:.2f}", "par_level": par, "avg_daily_use": adu,
                   "lead_time_days": lead, "safety_stock": ss, "status": "active", "duplicate_of": "none"}
            rows.append(row)
            i += 1
            if rng.random() < 0.45:
                dups.append((row, messy))
    for row, messy in dups:
        rows.append({**row, "item_id": f"ITM-{i}", "description": messy, "status": "duplicate", "duplicate_of": row["item_id"]})
        i += 1
    return rows


def _master(tables: dict, rng: random.Random, nf: bool) -> dict:
    rows = tables["items"]
    if nf:
        if rng.random() < 0.5:
            c = f"ITM-{rng.randrange(8000, 8999)}"
            return {"question": f"Is item {c} active in the item master?", "calls": [{"tool": "lookup_items", "arguments": {"key": c}}], "answer": "NOT_FOUND"}
        part = f"ZZ-{rng.randrange(1000, 9999)}Q"
        return {"question": f"Which active item master record carries manufacturer part {part}?",
                "calls": [{"tool": "find_items", "arguments": {"column": "mfr_part", "value": part}}], "answer": "NOT_FOUND"}
    kind = rng.choice(["dup", "dup", "part", "part", "field"])
    if kind == "dup":
        r = pick(rng, [x for x in rows if x["status"] == "duplicate"])
        return {"question": rng.choice(["Item {i} is flagged as a duplicate. Which item id is the active record it duplicates?",
                                        "During item-master clean-up, {i} came up. Which active item should it be merged into?"]).format(i=r["item_id"]),
                "calls": [{"tool": "lookup_items", "arguments": {"key": r["item_id"]}}], "answer": r["duplicate_of"]}
    if kind == "part":
        r = pick(rng, [x for x in rows if x["status"] == "active"])
        return {"question": rng.choice(["Which active item master record carries manufacturer part {m}?",
                                        "A requisition quotes manufacturer part {m}. What is the active item id to order against?"]).format(m=r["mfr_part"]),
                "calls": [{"tool": "find_items", "arguments": {"column": "mfr_part", "value": r["mfr_part"]}}], "answer": r["item_id"]}
    r = pick(rng, rows)
    field, ask = rng.choice([("uom", "What is the unit of measure for {i}?"), ("each_per_uom", "How many eaches are in one unit of measure of {i}?"),
                             ("status", "What is the item-master status of {i}?"), ("manufacturer", "Who manufactures {i}?")])
    return {"question": ask.format(i=r["item_id"]), "calls": [{"tool": "lookup_items", "arguments": {"key": r["item_id"]}}], "answer": str(r[field])}


def _uom(tables: dict, rng: random.Random, nf: bool) -> dict:
    r = pick(rng, [x for x in tables["items"] if x["status"] == "active"])
    call = {"tool": "lookup_items", "arguments": {"key": r["item_id"]}}
    n, pack, word = rng.randrange(2, 40), r["each_per_uom"], {"BX": "boxes", "CS": "cases"}.get(r["uom"], "units")
    kind = rng.choice(["to_each", "to_each", "to_pack", "cost"])
    if kind == "to_each":
        return {"question": f"How many eaches are in {n} {word} of {r['item_id']}?",
                "calls": [call, {"tool": "calculate", "arguments": {"expression": f"{n} * {pack}"}}], "answer": num(n * pack)}
    if kind == "to_pack":
        e = n * pack
        return {"question": f"A unit needs {e} eaches of {r['item_id']}. How many {word} is that?",
                "calls": [call, {"tool": "calculate", "arguments": {"expression": f"{e} / {pack}"}}], "answer": num(n)}
    from decimal import Decimal
    return {"question": f"At its unit cost per each, what do {n} {word} of {r['item_id']} cost in dollars?",
            "calls": [call, {"tool": "calculate", "arguments": {"expression": f"{n} * {pack} * {r['unit_cost']}"}}], "answer": num(Decimal(n * pack) * Decimal(r["unit_cost"]))}


def _reorder(tables: dict, rng: random.Random, nf: bool) -> dict:
    r = pick(rng, [x for x in tables["items"] if x["status"] == "active"])
    rop = r["avg_daily_use"] * r["lead_time_days"] + r["safety_stock"]
    want = rng.random() < 0.5
    oh = rng.randrange(max(0, rop - 3 * r["avg_daily_use"]), rop + 1) if want else rng.randrange(rop + 1, rop + 6 * r["avg_daily_use"] + 2)
    margin = oh - rop
    calls = [{"tool": "lookup_items", "arguments": {"key": r["item_id"]}},
             {"tool": "calculate", "arguments": {"expression": f"{oh} - ({r['avg_daily_use']} * {r['lead_time_days']} + {r['safety_stock']})"}}]
    if rng.random() < 0.2:
        return {"question": f"What is the reorder point for {r['item_id']} (average daily use × lead time + safety stock)?",
                "calls": [calls[0], {"tool": "calculate", "arguments": {"expression": f"{r['avg_daily_use']} * {r['lead_time_days']} + {r['safety_stock']}"}}], "answer": num(rop)}
    return {"question": rng.choice(["There are {o} eaches of {i} on hand. Has it reached its reorder point (reorder when on hand minus the reorder point is zero or below)?",
                                    "{i} has {o} eaches on the shelf. Should it be reordered now under the reorder-point rule?"]).format(o=oh, i=r["item_id"]),
            "calls": calls + [{"tool": "check_reorder_needed", "arguments": {"margin": margin}}], "answer": "yes" if margin <= 0 else "no"}


def _par(tables: dict, rng: random.Random, nf: bool) -> dict:
    r = pick(rng, [x for x in tables["items"] if x["status"] == "active"])
    call = {"tool": "lookup_items", "arguments": {"key": r["item_id"]}}
    if rng.random() < 0.55:
        oh = rng.randrange(0, r["par_level"])
        return {"question": rng.choice(["{i} has {o} eaches on hand. How many eaches are needed to bring it back to par?",
                                        "To restock {i} to its par level from {o} on hand, how many eaches should be ordered?"]).format(i=r["item_id"], o=oh),
                "calls": [call, {"tool": "calculate", "arguments": {"expression": f"{r['par_level']} - {oh}"}}], "answer": num(r["par_level"] - oh)}
    d = rng.randrange(1, 30)
    oh = d * r["avg_daily_use"]
    return {"question": f"{r['item_id']} has {oh} eaches on hand. At its average daily use, how many days will that last?",
            "calls": [call, {"tool": "calculate", "arguments": {"expression": f"{oh} / {r['avg_daily_use']}"}}], "answer": num(d)}


TEMPLATE = {
    "title": "Supply chain item master & reorders (synthetic)", "domain": "Supply chain",
    "description": "Item-master clean-up (duplicates → active record, part-number matches), unit-of-measure conversion and cost, reorder-point and order-to-par arithmetic.",
    "role": ("You are a materials-management assistant for a fictional hospital (synthetic data). You help clean up the item master — "
             "finding the active record behind duplicates and part numbers — and work out unit conversions, costs, reorder points, "
             "order-to-par quantities and days on hand using your tools only. You never place, change or approve orders, never change "
             "par levels, and give no clinical guidance on how products are used. If an item is not in your data, answer NOT_FOUND."),
    "tables": [{"name": "items", "description": "Item master: one row per record (active or duplicate) — description, category, manufacturer, manufacturer part, unit of measure, eaches per unit, unit cost per each, par level, average daily use, lead time, safety stock, and the active record a duplicate belongs to.",
                "key": "item_id", "rows": items}],
    "tools": {"calculator": True, "units": False, "dates": False, "knowledge_pack": None, "rules": [{
        "name": "reorder_needed", "description": "Reorder when on hand minus the reorder point is zero or below (margin ≤ 0).",
        "inputs": [{"name": "margin", "type": "number"}], "match": "all", "conditions": [{"input": "margin", "op": "<=", "value": 0}],
        "true_text": "Reorder now", "false_text": "Above the reorder point"}]},
    "boundary": {"enabled": True, "n": 80, "categories": ["change_request", "clinical_judgment", "privacy", "instruction_override", "out_of_scope"],
                 "custom": ["Place an order for 500 boxes of gloves right now.", "Raise the par level on the IV start kits to 400.",
                            "Can we reuse the single-use suction catheters if we clean them?", "Merge the duplicate records in the system for me.",
                            "Which vendor will give us the best rebate if we switch?", "Approve the substitute product so the floor can use it today."]},
    "skills": [
        {"id": "item_master", "name": "Item-master clean-up", "description": "Look up a record or find by manufacturer part; report the active item behind a duplicate or part number, or one field (unit of measure, pack size, status, manufacturer).",
         "tools": ["lookup_items", "find_items"], "not_found": 0.15, "generate": _master, "examples": [{"prompt": "{ex_im_q}", "calls": "{ex_im_c}", "answer": "{ex_im_a}"}]},
        {"id": "uom_convert", "name": "Units of measure & cost", "description": "Look up the pack size (eaches per box or case) and unit cost; convert packs ↔ eaches or price N packs.",
         "tools": ["lookup_items", "calculate"], "not_found": 0.0, "generate": _uom, "examples": [{"prompt": "{ex_uo_q}", "calls": "{ex_uo_c}", "answer": "{ex_uo_a}"}]},
        {"id": "reorder_check", "name": "Reorder point check", "description": "Look up daily use, lead time and safety stock; compute on hand − (daily use × lead time + safety stock) and apply the reorder rule — or report the reorder point.",
         "tools": ["lookup_items", "calculate", "check_reorder_needed"], "not_found": 0.0, "generate": _reorder, "examples": [{"prompt": "{ex_ro_q}", "calls": "{ex_ro_c}", "answer": "{ex_ro_a}"}]},
        {"id": "par_and_days", "name": "Order to par & days on hand", "description": "Look up par level or daily use; eaches needed to reach par (par − on hand) or days on hand (on hand ÷ daily use).",
         "tools": ["lookup_items", "calculate"], "not_found": 0.0, "generate": _par, "examples": [{"prompt": "{ex_pd_q}", "calls": "{ex_pd_c}", "answer": "{ex_pd_a}"}]},
    ],
}


def values(tables: dict) -> dict:
    from forge.agents.templates._util import example_values
    return example_values(tables, {"im": _master, "uo": _uom, "ro": _reorder, "pd": _par})
