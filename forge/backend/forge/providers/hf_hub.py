"""Hugging Face Hub: search, pre-download inspection, verified download.

This is FORGE's only deliberate outbound network path. Every call returns an
`outbound` record (host + endpoint) so the UI can show exactly what left the machine.

Inspection never downloads weights: it reads config.json, tokenizer_config.json,
README.md, and the safetensors index, plus the remote safetensors *headers*
(exact parameter counts) through the Hub API.

Download uses snapshot_download(allow_patterns=…) and then verifies config.json and
every shard listed in the index. (The `hf download --include` CLI silently ignores
filters when filenames are passed — never rely on it.)
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable

from forge.registry.roles import classify_kind, license_check

HUB_HOST = "huggingface.co"
INSPECT_FILES = ("config.json", "tokenizer_config.json", "README.md", "model.safetensors.index.json")
DOWNLOAD_PATTERNS = ["*.json", "*.safetensors", "tokenizer*", "*.model", "*.tiktoken", "*.txt", "*.jinja",
                     "merges.txt", "vocab.*", "README.md", "LICENSE*"]


class HubError(RuntimeError):
    pass


def _api(api: Any | None) -> Any:
    if api is not None:
        return api
    from huggingface_hub import HfApi
    return HfApi()


def search(query: str, *, limit: int = 25, task: str | None = "text-generation", library: str | None = "safetensors",
           sort: str = "downloads", api: Any | None = None) -> dict[str, Any]:
    filters = [f for f in (task, library) if f]
    models = _api(api).list_models(search=query or None, filter=filters or None, sort=sort, limit=min(limit, 100),
                                   full=False, expand=["downloads", "likes", "pipeline_tag", "library_name",
                                                       "safetensors", "lastModified", "gated", "tags"])
    out = []
    for m in models:
        sf = getattr(m, "safetensors", None)
        total = getattr(sf, "total", None) if sf is not None else None
        out.append({"id": m.id, "downloads": getattr(m, "downloads", None), "likes": getattr(m, "likes", None),
                    "pipeline_tag": getattr(m, "pipeline_tag", None), "library": getattr(m, "library_name", None),
                    "parameters": total, "gated": getattr(m, "gated", None),
                    "last_modified": str(getattr(m, "last_modified", "") or getattr(m, "lastModified", "") or "") or None,
                    "tags": [t for t in (getattr(m, "tags", None) or []) if t.startswith(("license:", "base_model:"))][:6]})
    return {"results": out, "outbound": {"host": HUB_HOST, "endpoint": "GET /api/models", "query": query,
                                          "filters": filters, "limit": limit}}


def _readme_meta(text: str) -> dict[str, Any]:
    if not text.startswith("---"):
        return {}
    front = text.split("---", 2)[1] if text.count("---") >= 2 else ""
    meta: dict[str, Any] = {}
    for line in front.splitlines():
        if ":" in line and not line.startswith((" ", "-")):
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip().strip("'\"")
    return meta


def inspect(repo_id: str, *, revision: str | None = None, api: Any | None = None,
            fetch: Callable[[str], str | None] | None = None) -> dict[str, Any]:
    """Metadata-only inspection. `fetch(filename)` returns file text or None (injectable for tests)."""
    hub = _api(api)
    if fetch is None:
        from huggingface_hub import hf_hub_download
        from huggingface_hub.utils import EntryNotFoundError

        def fetch(fn: str) -> str | None:  # noqa: F811 — default fetcher
            try:
                return Path(hf_hub_download(repo_id, fn, revision=revision)).read_text(encoding="utf-8", errors="replace")
            except EntryNotFoundError:
                return None
    files = {fn: fetch(fn) for fn in INSPECT_FILES}
    if not files["config.json"]:
        raise HubError(f"{repo_id} has no config.json; not a transformers model")
    cfg = json.loads(files["config.json"])
    tok = json.loads(files["tokenizer_config.json"]) if files["tokenizer_config.json"] else {}
    template = tok.get("chat_template")
    if isinstance(template, list):
        template = " ".join(str(x.get("template", "")) for x in template if isinstance(x, dict))
    readme = _readme_meta(files["README.md"] or "")
    info = hub.model_info(repo_id, revision=revision, files_metadata=True)
    siblings = [{"name": s.rfilename, "size": getattr(s, "size", None)} for s in (info.siblings or [])]
    try:
        stm = hub.get_safetensors_metadata(repo_id, revision=revision)
        exact = {"total": sum(stm.parameter_count.values()), "by_dtype": dict(stm.parameter_count)}
    except Exception as e:  # repo without safetensors, or gated
        exact = {"total": None, "error": f"{type(e).__name__}"}
    t = cfg.get("text_config") or cfg
    kind, evidence = classify_kind(cfg.get("model_type"), cfg.get("architectures"), repo_id)
    weight_files = [s for s in siblings if s["name"].endswith(".safetensors")]
    pickle_only = not weight_files and any(s["name"].endswith(".bin") for s in siblings)
    license_ = readme.get("license") or getattr(getattr(info, "card_data", None), "license", None)
    checks = [
        {"check": "generative", "status": "pass" if kind == "generative" else "fail", "reason": evidence},
        {"check": "safetensors", "status": "fail" if pickle_only else ("pass" if weight_files else "warn"),
         "reason": "Pickle-only weights are refused." if pickle_only else f"{len(weight_files)} safetensors file(s)."},
        {"check": "no_remote_code", "status": "fail" if cfg.get("auto_map") else "pass",
         "reason": "Requires trust_remote_code." if cfg.get("auto_map") else "Standard transformers architecture."},
        {"check": "chat_template", "status": "pass" if template else "warn",
         "reason": "Chat template present." if template else "No chat template (base model?)."},
        {"check": "tool_template", "status": "pass" if template and "tools" in template else "warn",
         "reason": "Template declares tools." if template and "tools" in template else "No tool declaration."},
        {**license_check(license_), "check": "license"},
        {"check": "gated", "status": "warn" if getattr(info, "gated", False) else "pass",
         "reason": "Gated repo: accept terms on the Hub first." if getattr(info, "gated", False) else "Not gated."},
    ]
    return {
        "repo_id": repo_id, "revision": getattr(info, "sha", None), "kind": kind,
        "architecture": (cfg.get("architectures") or [None])[0], "model_type": cfg.get("model_type"),
        "parameters": exact, "hidden_size": t.get("hidden_size"), "num_hidden_layers": t.get("num_hidden_layers"),
        "intermediate_size": t.get("intermediate_size"), "vocab_size": t.get("vocab_size"),
        "num_attention_heads": t.get("num_attention_heads"), "num_key_value_heads": t.get("num_key_value_heads"),
        "head_dim": t.get("head_dim"), "tie_word_embeddings": t.get("tie_word_embeddings", cfg.get("tie_word_embeddings")),
        "context_length": t.get("max_position_embeddings"), "license": license_,
        "download_bytes": sum(s["size"] or 0 for s in siblings if any(Path(s["name"]).match(p) for p in DOWNLOAD_PATTERNS)),
        "weight_files": weight_files, "checks": checks,
        "verdict": "fail" if any(c["status"] == "fail" for c in checks) else "pass",
        "outbound": {"host": HUB_HOST, "endpoint": f"GET /{repo_id} (metadata files, safetensors headers)",
                     "files": list(INSPECT_FILES)},
    }


def verify_snapshot(path: Path) -> dict[str, Any]:
    """config.json present and every shard named in the index exists with non-zero size."""
    if not (path / "config.json").exists():
        raise HubError(f"{path}: config.json missing")
    idx = path / "model.safetensors.index.json"
    if idx.exists():
        shards = sorted(set(json.loads(idx.read_text(encoding="utf-8"))["weight_map"].values()))
    else:
        shards = [p.name for p in path.glob("*.safetensors")]
    if not shards:
        raise HubError(f"{path}: no safetensors weights")
    missing = [s for s in shards if not (path / s).exists() or (path / s).stat().st_size == 0]
    if missing:
        raise HubError(f"{path}: missing shards {missing}")
    return {"path": str(path), "shards": shards, "bytes": sum((path / s).stat().st_size for s in shards)}


def download_and_verify(repo_id: str, *, revision: str | None = None, cache_dir: Path | None = None,
                        emit: Callable[[dict], None] = lambda e: None, snapshot: Callable | None = None) -> dict[str, Any]:
    if snapshot is None:
        from huggingface_hub import snapshot_download as snapshot
    emit({"event": "download_start", "repo": repo_id, "patterns": DOWNLOAD_PATTERNS, "host": HUB_HOST})
    path = Path(snapshot(repo_id=repo_id, revision=revision, allow_patterns=DOWNLOAD_PATTERNS,
                         cache_dir=str(cache_dir) if cache_dir else None))
    return verify_snapshot(path)
