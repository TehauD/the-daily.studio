"""Synthetic, deterministically checkable agent tasks.

The world is a seeded product catalog with two read-only tools:
  lookup(sku)          -> item record or NOT_FOUND error
  quote(sku, quantity) -> unit price × quantity, or an error
Families:
  catalog_lookup    one lookup, answer the unit price
  multi_step_quote  two quotes, answer the summed total
  missing_item      lookup of an absent SKU, answer NOT_FOUND
  extraction        no tools: extract the SKU from text (regression split only)
Splits are assigned per *group* (one scenario = one group; its paraphrases share
the group_id), so a paraphrase can never leak across train / dev / test. The OOD
split uses held-out wording templates on fresh groups.

Everything is a pure function of (seed, sizes): the same plan regenerates
byte-identical tasks, which is what makes a frozen study plan meaningful.
"""
from __future__ import annotations

import json
import random
import re
from dataclasses import asdict, dataclass, field
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Any

from forge.util import canonical_json, sha256_text

TASKSET_VERSION = "forge-catalog-v1"
SPLITS = ("train", "dev", "test", "ood", "regression")
FAMILIES = ("catalog_lookup", "multi_step_quote", "missing_item", "extraction")

_ADJ = ["Amber", "Basalt", "Cobalt", "Dune", "Ember", "Fjord", "Granite", "Harbor", "Iris", "Juniper", "Kelp",
        "Lumen", "Mesa", "Nimbus", "Onyx", "Pine", "Quartz", "Ridge", "Slate", "Tundra"]
_NOUN = ["Lantern", "Kettle", "Backpack", "Thermos", "Notebook", "Headlamp", "Tarp", "Compass", "Stove", "Hammock",
         "Bottle", "Trowel", "Blanket", "Satchel", "Whistle"]

TOOLS: list[dict[str, Any]] = [
    {"name": "lookup", "description": "Look up a catalog item by SKU. Returns name, unit_price, stock.",
     "parameters": {"type": "object", "properties": {"sku": {"type": "string"}}, "required": ["sku"]}},
    {"name": "quote", "description": "Price a quantity of one SKU. Returns unit_price and total.",
     "parameters": {"type": "object", "properties": {"sku": {"type": "string"}, "quantity": {"type": "integer"}},
                    "required": ["sku", "quantity"]}},
]
TOOL_NAMES = {t["name"] for t in TOOLS}

SYSTEM_PROMPT = (
    "You are a catalog assistant. You can call read-only tools.\n"
    "Tools (JSON schema):\n" + json.dumps(TOOLS, separators=(",", ":")) + "\n"
    "Protocol: reply with exactly ONE JSON object and nothing else.\n"
    'To call a tool: {"tool": "<name>", "arguments": {...}}\n'
    'To finish: {"answer": "<final answer>"}\n'
    "Prices are answered as plain decimals with two places (e.g. 12.50). "
    "If an item does not exist, answer NOT_FOUND."
)

# In-distribution wording (train/dev/test) and held-out wording (ood). Disjoint by construction.
TEMPLATES: dict[str, dict[str, list[str]]] = {
    "catalog_lookup": {
        "id": ["What is the unit price of {sku}?", "How much does one {sku} cost?",
               "Give me the price for SKU {sku}."],
        "ood": ["I'm budgeting — tell me what a single unit of item {sku} goes for.",
                "Price check please: {sku}, one piece."],
    },
    "multi_step_quote": {
        "id": ["What is the total for {q1} x {a} and {q2} x {b}?",
               "Quote {q1} units of {a} plus {q2} units of {b}; give the combined total.",
               "How much would {q1} of {a} and {q2} of {b} cost altogether?"],
        "ood": ["My order is {a} (qty {q1}) and {b} (qty {q2}). What's the grand total?",
                "Sum the cost of buying {q1} {a} along with {q2} {b}."],
    },
    "missing_item": {
        "id": ["What is the unit price of {sku}?", "How much does one {sku} cost?",
               "Give me the price for SKU {sku}."],
        "ood": ["I'm budgeting — tell me what a single unit of item {sku} goes for.",
                "Price check please: {sku}, one piece."],
    },
    "extraction": {
        "id": ["Extract the SKU from this note and answer with it only: \"{text}\""],
        "ood": ["Extract the SKU from this note and answer with it only: \"{text}\""],
    },
}


@dataclass(frozen=True)
class Item:
    sku: str
    name: str
    unit_price: str  # decimal string, two places
    stock: int


@dataclass
class Task:
    task_id: str
    group_id: str
    family: str
    split: str
    paraphrase: int
    prompt: str
    reference_calls: list[dict[str, Any]]  # exact expected tool sequence: [{"tool":..., "arguments":...}]
    reference_answer: str
    meta: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def money(x: Decimal | str | float) -> str:
    return str(Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def build_catalog(seed: int, n_items: int = 40) -> dict[str, Item]:
    rng = random.Random(f"catalog:{seed}")
    skus = rng.sample(range(1000, 9999), n_items)
    items = {}
    for i, s in enumerate(skus):
        sku = f"SKU-{s}"
        name = f"{_ADJ[i % len(_ADJ)]} {_NOUN[(i * 7) % len(_NOUN)]}"
        price = money(Decimal(rng.randint(150, 25000)) / 100)
        items[sku] = Item(sku, name, price, rng.randint(0, 500))
    return items


class ToolWorld:
    """Executes the allowlisted, read-only tools against the catalog. No side effects, no I/O."""

    def __init__(self, catalog: dict[str, Item]):
        self.catalog = catalog

    def call(self, tool: str, arguments: dict[str, Any]) -> tuple[dict[str, Any], str | None]:
        """Returns (result, error). Unknown tools / bad arguments are errors, never exceptions."""
        if tool not in TOOL_NAMES:
            return {"error": f"unknown tool '{tool}'"}, "unknown_tool"
        if not isinstance(arguments, dict):
            return {"error": "arguments must be an object"}, "bad_arguments"
        sku = arguments.get("sku")
        if not isinstance(sku, str):
            return {"error": "sku must be a string"}, "bad_arguments"
        item = self.catalog.get(sku.strip().upper())
        if tool == "lookup":
            if item is None:
                return {"error": "NOT_FOUND", "sku": sku}, None  # a correct, informative tool result
            return {"sku": item.sku, "name": item.name, "unit_price": item.unit_price, "stock": item.stock}, None
        qty = arguments.get("quantity")
        if isinstance(qty, bool) or not isinstance(qty, int) or qty <= 0:
            return {"error": "quantity must be a positive integer"}, "bad_arguments"
        if item is None:
            return {"error": "NOT_FOUND", "sku": sku}, None
        return {"sku": item.sku, "quantity": qty, "unit_price": item.unit_price,
                "total": money(Decimal(item.unit_price) * qty)}, None


@dataclass
class TaskSetSpec:
    seed: int = 1234
    groups_per_family: int = 24  # in-distribution scenario groups per tool family
    paraphrases: int = 2
    ood_groups_per_family: int = 6
    regression_groups: int = 12
    split_fractions: tuple[float, float, float] = (0.6, 0.2, 0.2)  # train / dev / test over groups


def _absent_sku(rng: random.Random, catalog: dict[str, Item]) -> str:
    while True:
        s = f"SKU-{rng.randint(1000, 9999)}"
        if s not in catalog:
            return s


def _scenario(family: str, rng: random.Random, catalog: dict[str, Item]) -> dict[str, Any]:
    skus = sorted(catalog)
    if family == "catalog_lookup":
        it = catalog[rng.choice(skus)]
        return {"slots": {"sku": it.sku}, "calls": [{"tool": "lookup", "arguments": {"sku": it.sku}}],
                "answer": it.unit_price}
    if family == "multi_step_quote":
        a, b = rng.sample(skus, 2)
        q1, q2 = rng.randint(2, 9), rng.randint(2, 9)
        total = Decimal(catalog[a].unit_price) * q1 + Decimal(catalog[b].unit_price) * q2
        return {"slots": {"a": a, "b": b, "q1": q1, "q2": q2},
                "calls": [{"tool": "quote", "arguments": {"sku": a, "quantity": q1}},
                          {"tool": "quote", "arguments": {"sku": b, "quantity": q2}}], "answer": money(total)}
    if family == "missing_item":
        sku = _absent_sku(rng, catalog)
        return {"slots": {"sku": sku}, "calls": [{"tool": "lookup", "arguments": {"sku": sku}}], "answer": "NOT_FOUND"}
    if family == "extraction":
        it = catalog[rng.choice(skus)]
        text = rng.choice(["Customer asked about {s} twice this week.", "Back-order note: {s} needs restock.",
                           "Ticket 4411 references {s} and a refund."]).format(s=it.sku)
        return {"slots": {"text": text}, "calls": [], "answer": it.sku}
    raise ValueError(family)


def generate_taskset(spec: TaskSetSpec, catalog: dict[str, Item] | None = None) -> list[Task]:
    catalog = catalog or build_catalog(spec.seed)
    rng = random.Random(f"tasks:{spec.seed}")
    tasks: list[Task] = []

    def emit(family: str, gidx: int, split: str, wording: str, scen: dict) -> None:
        gid = f"{family[:3]}-{split if split in ('ood', 'regression') else 'id'}-{gidx:03d}"
        templates = TEMPLATES[family][wording]
        n = 1 if family == "extraction" else min(spec.paraphrases, len(templates))
        for p in range(n):
            tasks.append(Task(task_id=f"{gid}.p{p}", group_id=gid, family=family, split=split, paraphrase=p,
                              prompt=templates[p].format(**scen["slots"]), reference_calls=scen["calls"],
                              reference_answer=scen["answer"], meta={"wording": wording}))

    for family in ("catalog_lookup", "multi_step_quote", "missing_item"):
        scenarios = [_scenario(family, rng, catalog) for _ in range(spec.groups_per_family)]
        order = list(range(len(scenarios)))
        random.Random(f"split:{spec.seed}:{family}").shuffle(order)
        n_tr = round(spec.split_fractions[0] * len(order))
        n_dev = round(spec.split_fractions[1] * len(order))
        for rank, gi in enumerate(order):
            split = "train" if rank < n_tr else ("dev" if rank < n_tr + n_dev else "test")
            emit(family, gi, split, "id", scenarios[gi])
        for gi in range(spec.ood_groups_per_family):
            emit(family, gi, "ood", "ood", _scenario(family, rng, catalog))
    for gi in range(spec.regression_groups):
        emit("extraction", gi, "regression", "id", _scenario("extraction", rng, catalog))
    _assert_group_integrity(tasks)
    return tasks


def _assert_group_integrity(tasks: list[Task]) -> None:
    seen: dict[str, str] = {}
    for t in tasks:
        if seen.setdefault(t.group_id, t.split) != t.split:
            raise AssertionError(f"group {t.group_id} crosses splits")


def taskset_hash(tasks: list[Task]) -> str:
    return sha256_text(canonical_json([t.to_dict() for t in tasks]))


# ---------------------------------------------------------------- scoring

def normalize_answer(a: Any) -> str:
    s = str(a).strip().strip('"').strip()
    if re.fullmatch(r"(?i)not[_ ]?found", s):
        return "NOT_FOUND"
    m = re.fullmatch(r"\$?\s*(-?[\d,]*\.?\d+)\s*(usd)?", s, re.I)
    if m:
        try:
            return money(Decimal(m.group(1).replace(",", "")))
        except InvalidOperation:
            pass
    return s.upper() if re.fullmatch(r"(?i)sku-\d+", s) else s


def _norm_args(args: Any) -> Any:
    if isinstance(args, dict):
        return {k: (v.strip().upper() if k == "sku" and isinstance(v, str) else v) for k, v in sorted(args.items())}
    return args


def score_episode(task: Task, calls: list[dict[str, Any]], answer: str | None, errors: list[str]) -> dict[str, Any]:
    """Strict success = correct answer AND exact reference tool sequence/arguments AND no errors."""
    ref = task.reference_calls
    got_tools = [c.get("tool") for c in calls]
    ref_tools = [c["tool"] for c in ref]
    answer_ok = answer is not None and normalize_answer(answer) == normalize_answer(task.reference_answer)
    tools_ok = got_tools == ref_tools
    args_matched = sum(1 for g, r in zip(calls, ref) if g.get("tool") == r["tool"]
                       and _norm_args(g.get("arguments")) == _norm_args(r["arguments"]))
    args_ok = tools_ok and args_matched == len(ref)
    invalid = sum(1 for e in errors if e in ("invalid_json", "invalid_action", "unknown_tool", "bad_arguments",
                                             "unclosed_reasoning"))
    # Unsupported answer: a final price/total given without any tool result that could support it.
    unsupported = bool(answer is not None and ref and not calls and normalize_answer(answer) != "NOT_FOUND")
    return {
        "strict_success": bool(answer_ok and args_ok and not errors),
        "answer_correct": answer_ok,
        "tool_selection_correct": tools_ok,
        "argument_accuracy": (args_matched / len(ref)) if ref else (1.0 if not calls else 0.0),
        "invalid_calls": invalid,
        "unsupported_answer": unsupported,
        "call_count": len(calls),
        "errors": errors,
    }
