"""Declarative, read-only, deterministic tools for purpose-built agents.

No tool runs user code, touches the network (except the loopback embedding endpoint behind document search),
or writes anything. Every result is a pure function of the agent's frozen data, so FORGE can execute a task's
reference calls itself and verify the answer.

Tools
- lookup_<table>(key)            exact (case-insensitive) match on the table's key column → one row or found=false
- find_<table>(column, value)    rows whose column equals value (case-insensitive), at most 10
- calculate(expression)          exact decimal arithmetic: + − × ÷, parentheses, min/max/round/abs
- convert_units(value, from, to) mass, volume, length, temperature, time
- date_math(op, start, days|end) add_days → date, days_between → integer
- check_<rule>(inputs…)          a rule you define: all/any of simple conditions → true/false with the reason
- search_documents(query)        a linked Knowledge Studio pack (top 3 passages)
"""
from __future__ import annotations

import ast
import datetime as dt
import re
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation, getcontext
from typing import Any, Callable

getcontext().prec = 28
MAX_ROWS = 10
NAME = re.compile(r"^[a-z][a-z0-9_]{0,39}$")


class ToolError(ValueError):
    def __init__(self, code: str, msg: str):
        super().__init__(msg)
        self.code = code


def fmt_num(d: Decimal) -> str:
    """Canonical decimal text: no exponent, no trailing zeros ('12.50' → '12.5', '3.0' → '3')."""
    if d == d.to_integral_value():
        return str(d.quantize(Decimal(1)))
    s = format(d.normalize(), "f")
    return s.rstrip("0").rstrip(".") if "." in s else s


def to_dec(v: Any) -> Decimal:
    if isinstance(v, bool):
        raise ToolError("bad_arguments", "expected a number")
    try:
        return Decimal(str(v).replace(",", "").strip())
    except (InvalidOperation, ValueError):
        raise ToolError("bad_arguments", f"not a number: {v!r}") from None


# ------------------------------------------------------------------ calculator
_BIN = {ast.Add: lambda a, b: a + b, ast.Sub: lambda a, b: a - b, ast.Mult: lambda a, b: a * b,
        ast.Div: lambda a, b: a / b}
_FUN = {"min": min, "max": max, "abs": abs}


def calculate(expression: str) -> Decimal:
    if not isinstance(expression, str) or not expression.strip() or len(expression) > 200:
        raise ToolError("bad_arguments", "expression must be a non-empty string (≤ 200 chars)")
    expr = expression.replace("×", "*").replace("÷", "/").replace("−", "-")
    try:
        tree = ast.parse(expr, mode="eval")
    except SyntaxError:
        raise ToolError("bad_arguments", "could not parse the expression") from None

    def ev(n: ast.AST) -> Decimal:
        if isinstance(n, ast.Expression):
            return ev(n.body)
        if isinstance(n, ast.Constant) and isinstance(n.value, (int, float)) and not isinstance(n.value, bool):
            return Decimal(str(n.value))
        if isinstance(n, ast.BinOp) and type(n.op) in _BIN:
            a, b = ev(n.left), ev(n.right)
            if isinstance(n.op, ast.Div) and b == 0:
                raise ToolError("bad_arguments", "division by zero")
            return _BIN[type(n.op)](a, b)
        if isinstance(n, ast.UnaryOp) and isinstance(n.op, (ast.USub, ast.UAdd)):
            v = ev(n.operand)
            return -v if isinstance(n.op, ast.USub) else v
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and not n.keywords:
            args = [ev(a) for a in n.args]
            if n.func.id in _FUN and args:
                return _FUN[n.func.id](*args) if n.func.id != "abs" else abs(args[0])
            if n.func.id == "round" and 1 <= len(args) <= 2:
                places = int(args[1]) if len(args) == 2 else 0
                return args[0].quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP)
        raise ToolError("bad_arguments", "only numbers, + - * /, parentheses, min, max, abs and round are allowed")
    out = ev(tree)
    return out.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP) if out != out.to_integral_value() else out


def expression_numbers(expression: str) -> list[Decimal]:
    return [Decimal(m) for m in re.findall(r"\d+(?:\.\d+)?", expression.replace(",", ""))]


# ------------------------------------------------------------------ units
_UNITS: dict[str, tuple[str, Decimal]] = {
    # mass → grams
    "mcg": ("mass", Decimal("0.000001")), "ug": ("mass", Decimal("0.000001")), "mg": ("mass", Decimal("0.001")),
    "g": ("mass", Decimal(1)), "kg": ("mass", Decimal(1000)), "lb": ("mass", Decimal("453.59237")), "oz": ("mass", Decimal("28.349523125")),
    # volume → millilitres
    "ml": ("volume", Decimal(1)), "l": ("volume", Decimal(1000)), "tsp": ("volume", Decimal("4.92892159375")),
    "tbsp": ("volume", Decimal("14.78676478125")), "fl_oz": ("volume", Decimal("29.5735295625")),
    # length → metres
    "mm": ("length", Decimal("0.001")), "cm": ("length", Decimal("0.01")), "m": ("length", Decimal(1)), "km": ("length", Decimal(1000)),
    "in": ("length", Decimal("0.0254")), "ft": ("length", Decimal("0.3048")),
    # time → hours
    "min": ("time", Decimal(1) / Decimal(60)), "h": ("time", Decimal(1)), "day": ("time", Decimal(24)), "week": ("time", Decimal(168)),
}
_ALIAS = {"µg": "mcg", "milligram": "mg", "milligrams": "mg", "gram": "g", "grams": "g", "kilogram": "kg", "kilograms": "kg",
          "lbs": "lb", "pound": "lb", "pounds": "lb", "ounce": "oz", "ounces": "oz", "millilitre": "ml", "milliliter": "ml",
          "milliliters": "ml", "millilitres": "ml", "litre": "l", "liter": "l", "liters": "l", "litres": "l", "hour": "h", "hours": "h",
          "hr": "h", "hrs": "h", "minute": "min", "minutes": "min", "days": "day", "d": "day", "weeks": "week", "wk": "week",
          "inch": "in", "inches": "in", "foot": "ft", "feet": "ft", "°c": "c", "celsius": "c", "°f": "f", "fahrenheit": "f"}
UNIT_NAMES = sorted(set(_UNITS) | {"c", "f"})


def _unit(u: Any) -> str:
    if not isinstance(u, str):
        raise ToolError("bad_arguments", "units must be strings")
    k = u.strip().lower().replace(" ", "_")
    k = _ALIAS.get(k, k)
    if k not in _UNITS and k not in ("c", "f"):
        raise ToolError("bad_arguments", f"unknown unit '{u}'; known: {', '.join(UNIT_NAMES)}")
    return k


def convert_units(value: Any, frm: Any, to: Any) -> Decimal:
    v, a, b = to_dec(value), _unit(frm), _unit(to)
    if {a, b} <= {"c", "f"}:
        out = v if a == b else (v * 9 / 5 + 32 if a == "c" else (v - 32) * 5 / 9)
    elif a in ("c", "f") or b in ("c", "f") or _UNITS[a][0] != _UNITS[b][0]:
        raise ToolError("bad_arguments", f"cannot convert {frm} to {to} (different kinds of quantity)")
    else:
        out = v * _UNITS[a][1] / _UNITS[b][1]
    return out.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


# ------------------------------------------------------------------ dates
def _date(s: Any) -> dt.date:
    try:
        return dt.date.fromisoformat(str(s).strip())
    except ValueError:
        raise ToolError("bad_arguments", f"dates must be YYYY-MM-DD, got {s!r}") from None


def date_math(op: Any, start: Any, days: Any = None, end: Any = None) -> str | int:
    if op == "add_days":
        n = to_dec(days)
        if n != n.to_integral_value() or abs(n) > 36500:
            raise ToolError("bad_arguments", "days must be a whole number (|days| ≤ 36500)")
        return (_date(start) + dt.timedelta(days=int(n))).isoformat()
    if op == "days_between":
        return (_date(end) - _date(start)).days
    raise ToolError("bad_arguments", "op must be 'add_days' or 'days_between'")


# ------------------------------------------------------------------ tables
def norm_cell(v: Any) -> str:
    return re.sub(r"\s+", " ", str(v)).strip().lower()


class Table:
    def __init__(self, spec: dict[str, Any], rows: list[dict[str, Any]]):
        self.name, self.key, self.description = spec["name"], spec["key"], spec.get("description", "")
        self.columns = spec["columns"]
        self.rows = rows
        self.by_key: dict[str, dict] = {}
        for r in rows:
            self.by_key.setdefault(norm_cell(r.get(self.key, "")), r)

    def lookup(self, key: Any) -> dict[str, Any]:
        if not isinstance(key, (str, int, float)) or isinstance(key, bool) or not str(key).strip():
            raise ToolError("bad_arguments", "key must be a non-empty string")
        r = self.by_key.get(norm_cell(key))
        return {"found": True, "row": r} if r else {"found": False}

    def find(self, column: Any, value: Any) -> dict[str, Any]:
        if column not in self.columns:
            raise ToolError("bad_arguments", f"unknown column '{column}'; columns: {', '.join(self.columns)}")
        v = norm_cell(value)
        rows = [r for r in self.rows if norm_cell(r.get(column, "")) == v]
        return {"count": len(rows), "rows": rows[:MAX_ROWS], "truncated": len(rows) > MAX_ROWS}


# ------------------------------------------------------------------ rules
OPS: dict[str, Callable[[Any, Any], bool]] = {
    "<": lambda a, b: to_dec(a) < to_dec(b), "<=": lambda a, b: to_dec(a) <= to_dec(b), ">": lambda a, b: to_dec(a) > to_dec(b),
    ">=": lambda a, b: to_dec(a) >= to_dec(b), "==": lambda a, b: _eq(a, b), "!=": lambda a, b: not _eq(a, b),
    "in": lambda a, b: any(_eq(a, x) for x in (b if isinstance(b, list) else str(b).split(","))),
}


def _eq(a: Any, b: Any) -> bool:
    try:
        return to_dec(a) == to_dec(b)
    except ToolError:
        return norm_cell(a) == norm_cell(b)


def check_rule(rule: dict[str, Any], args: dict[str, Any]) -> dict[str, Any]:
    vals = {}
    for inp in rule["inputs"]:
        if inp["name"] not in args:
            raise ToolError("bad_arguments", f"missing input '{inp['name']}'")
        v = args[inp["name"]]
        if inp.get("type") == "number":
            to_dec(v)
        vals[inp["name"]] = v
    hits = []
    for c in rule["conditions"]:
        ok = OPS[c["op"]](vals[c["input"]], c["value"])
        hits.append((c, ok))
    res = all(ok for _, ok in hits) if rule.get("match", "all") == "all" else any(ok for _, ok in hits)
    met = [f"{c['input']} {c['op']} {c['value']}" for c, ok in hits if ok]
    return {"result": res, "explanation": rule.get("true_text" if res else "false_text") or ("true" if res else "false"),
            "conditions_met": met}


# ------------------------------------------------------------------ the tool set an agent exposes
def _obj(props: dict[str, Any], required: list[str]) -> dict[str, Any]:
    return {"type": "object", "properties": props, "required": required}


class ToolSet:
    """Builds tool schemas and executes calls for one agent spec (+ its tables, + optional document search)."""

    def __init__(self, spec: dict[str, Any], tables: dict[str, list[dict]], search: Callable[[str, int], list[dict]] | None = None):
        self.spec, self.search = spec, search
        t = spec["tools"]
        self.tables = {ts["name"]: Table(ts, tables[ts["name"]]) for ts in t.get("tables", [])}
        self.rules = {r["name"]: r for r in t.get("rules", [])}
        self.schemas: list[dict[str, Any]] = []
        self.runners: dict[str, Callable[[dict], Any]] = {}
        for name, tb in self.tables.items():
            desc = (tb.description + " " if tb.description else "")
            self._add(f"lookup_{name}", f"{desc}Look up one row of the {name} table by its {tb.key}. Columns: {', '.join(tb.columns)}.",
                      _obj({"key": {"type": "string"}}, ["key"]), lambda a, tb=tb: tb.lookup(a.get("key")))
            self._add(f"find_{name}", f"Find up to {MAX_ROWS} rows of the {name} table where a column equals a value.",
                      _obj({"column": {"type": "string", "enum": tb.columns}, "value": {"type": "string"}}, ["column", "value"]),
                      lambda a, tb=tb: tb.find(a.get("column"), a.get("value")))
        if t.get("calculator"):
            self._add("calculate", "Exact arithmetic. Numbers, + - * /, parentheses, min, max, abs, round(x, places).",
                      _obj({"expression": {"type": "string"}}, ["expression"]),
                      lambda a: {"result": fmt_num(calculate(a.get("expression")))})
        if t.get("units"):
            self._add("convert_units", f"Convert a quantity between units. Units: {', '.join(UNIT_NAMES)}.",
                      _obj({"value": {"type": "number"}, "from": {"type": "string"}, "to": {"type": "string"}}, ["value", "from", "to"]),
                      lambda a: {"result": fmt_num(convert_units(a.get("value"), a.get("from"), a.get("to")))})
        if t.get("dates"):
            self._add("date_math", "Date arithmetic on YYYY-MM-DD dates: op 'add_days' (start, days) or 'days_between' (start, end).",
                      _obj({"op": {"type": "string", "enum": ["add_days", "days_between"]}, "start": {"type": "string"},
                            "days": {"type": "integer"}, "end": {"type": "string"}}, ["op", "start"]),
                      lambda a: {"result": date_math(a.get("op"), a.get("start"), a.get("days"), a.get("end"))})
        for name, r in self.rules.items():
            props = {i["name"]: {"type": "number" if i.get("type") == "number" else "string"} for i in r["inputs"]}
            self._add(f"check_{name}", r.get("description") or f"Apply the {name} rule.", _obj(props, [i["name"] for i in r["inputs"]]),
                      lambda a, r=r: check_rule(r, a))
        if search is not None:
            self._add("search_documents", "Search the document collection; returns the most relevant passages with ids.",
                      _obj({"query": {"type": "string"}}, ["query"]),
                      lambda a: {"results": [{"id": h["chunk_id"], "text": h["text"][:900]} for h in self._search(a.get("query"))]})

    def _search(self, q: Any) -> list[dict]:
        if not isinstance(q, str) or not q.strip() or len(q) > 400:
            raise ToolError("bad_arguments", "query must be a non-empty string (≤ 400 chars)")
        return self.search(q.strip(), 3)  # type: ignore[misc]

    def _add(self, name: str, description: str, params: dict[str, Any], fn: Callable[[dict], Any]) -> None:
        self.schemas.append({"name": name, "description": description, "parameters": params})
        self.runners[name] = fn

    @property
    def names(self) -> list[str]:
        return [s["name"] for s in self.schemas]

    def call(self, tool: str, arguments: dict[str, Any]) -> tuple[dict[str, Any], str | None]:
        fn = self.runners.get(tool)
        if fn is None:
            return {"error": f"unknown tool '{tool}'"}, "unknown_tool"
        if not isinstance(arguments, dict):
            return {"error": "arguments must be an object"}, "bad_arguments"
        try:
            return fn(arguments), None
        except ToolError as e:
            return {"error": str(e)}, e.code
        except (InvalidOperation, ArithmeticError, OverflowError) as e:
            return {"error": f"arithmetic error: {type(e).__name__}"}, "bad_arguments"
