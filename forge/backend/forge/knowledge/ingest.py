"""Document ingestion: extract plain text and split it into passages ("chunks").

A chunk is what retrieval returns and what the model reads, so chunking is shown to
users verbatim in the UI. Chunks follow paragraph boundaries where possible, with a
small overlap so a fact that straddles a boundary is still retrievable.

Safety: only regular files under the chosen folder (no symlink escape), size-capped,
known extensions only. Nothing is executed or fetched.
"""
from __future__ import annotations

import hashlib
import html
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterator

TEXT_EXT = {".txt", ".md", ".markdown", ".rst"}
HTML_EXT = {".html", ".htm"}
PDF_EXT = {".pdf"}
SUPPORTED = TEXT_EXT | HTML_EXT | PDF_EXT
MAX_FILE_BYTES = 25 * 2 ** 20
MAX_FILES = 2000


@dataclass
class Doc:
    doc_id: str
    path: str        # relative to the source folder
    title: str
    sha256: str
    chars: int
    kind: str


@dataclass
class Chunk:
    chunk_id: str
    doc_id: str
    order: int
    text: str
    start: int
    end: int

    def to_dict(self) -> dict:
        return asdict(self)


class IngestError(ValueError):
    pass


def _html_to_text(raw: str) -> str:
    raw = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", raw)
    raw = re.sub(r"(?i)<br\s*/?>|</(p|div|li|h[1-6]|tr|section|article)>", "\n", raw)
    return html.unescape(re.sub(r"<[^>]+>", " ", raw))


def _pdf_to_text(path: Path) -> str:
    try:
        from pypdf import PdfReader
    except ImportError as e:  # optional dependency
        raise IngestError("PDF support needs the 'pypdf' package (setup.ps1 installs it)") from e
    reader = PdfReader(str(path))
    if reader.is_encrypted:
        raise IngestError("encrypted PDF")
    return "\n\n".join((page.extract_text() or "") for page in reader.pages)


def extract_text(path: Path) -> tuple[str, str]:
    ext = path.suffix.lower()
    if ext in PDF_EXT:
        return _pdf_to_text(path), "pdf"
    raw = path.read_text(encoding="utf-8", errors="replace")
    if ext in HTML_EXT:
        return _html_to_text(raw), "html"
    return raw, "markdown" if ext in {".md", ".markdown"} else "text"


def normalize(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace(" ", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def title_of(text: str, path: Path) -> str:
    for line in text.splitlines():
        s = line.strip().lstrip("#").strip()
        if 3 <= len(s) <= 120:
            return s
    return path.stem


def iter_files(root: Path) -> Iterator[Path]:
    root = root.resolve()
    count = 0
    for p in sorted(root.rglob("*")):
        if count >= MAX_FILES:
            break
        if p.is_symlink() or not p.is_file() or p.suffix.lower() not in SUPPORTED:
            continue
        if any(part.startswith(".") for part in p.relative_to(root).parts):
            continue  # hidden folders (.git, .venv …)
        if root not in p.resolve().parents:
            continue
        count += 1
        yield p


def chunk_text(text: str, doc_id: str, size: int = 800, overlap: int = 120) -> list[Chunk]:
    """Greedy paragraph packing up to `size` characters; long paragraphs are split on sentence ends."""
    paras: list[tuple[int, str]] = []
    pos = 0
    for block in re.split(r"\n\s*\n", text):
        start = text.find(block, pos)
        pos = start + len(block)
        block = block.strip()
        if not block:
            continue
        if len(block) <= size:
            paras.append((start, block))
            continue
        for m in re.finditer(r".+?(?:[.!?](?=\s)|$)", block, re.S):  # sentence-ish pieces
            piece = m.group(0).strip()
            if piece:
                paras.append((start + m.start(), piece))
    chunks: list[Chunk] = []
    cur, cur_start = "", 0
    for start, p in paras:
        if cur and len(cur) + 2 + len(p) > size:
            chunks.append(cur_start_chunk(doc_id, len(chunks), cur, cur_start))
            tail = cur[-overlap:] if overlap else ""
            tail = tail[tail.find(" ") + 1:] if " " in tail else tail
            cur, cur_start = (tail + "\n\n" + p) if tail else p, start - len(tail)
        else:
            cur, cur_start = (cur + "\n\n" + p, cur_start) if cur else (p, start)
        while len(cur) > size * 1.5:  # a single huge "sentence" (tables, code): hard split
            chunks.append(cur_start_chunk(doc_id, len(chunks), cur[:size], cur_start))
            cur, cur_start = cur[size - overlap:], cur_start + size - overlap
    if cur.strip():
        chunks.append(cur_start_chunk(doc_id, len(chunks), cur, cur_start))
    return chunks


def cur_start_chunk(doc_id: str, order: int, text: str, start: int) -> Chunk:
    return Chunk(chunk_id=f"{doc_id}:{order:04d}", doc_id=doc_id, order=order, text=text.strip(),
                 start=max(0, start), end=max(0, start) + len(text))


def ingest_folder(root: Path, size: int = 800, overlap: int = 120) -> tuple[list[Doc], list[Chunk], list[dict]]:
    """Returns (docs, chunks, skipped). Doc ids are content-derived, so re-importing identical files is stable."""
    docs, chunks, skipped = [], [], []
    for path in iter_files(root):
        rel = path.relative_to(root.resolve()).as_posix()
        if path.stat().st_size > MAX_FILE_BYTES:
            skipped.append({"path": rel, "reason": f"larger than {MAX_FILE_BYTES // 2**20} MB"})
            continue
        try:
            raw, kind = extract_text(path)
        except Exception as e:  # unreadable file: reported, never fatal
            skipped.append({"path": rel, "reason": f"{type(e).__name__}: {str(e)[:160]}"})
            continue
        text = normalize(raw)
        if len(text) < 40:
            skipped.append({"path": rel, "reason": "no extractable text (scanned PDF or empty?)"})
            continue
        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
        doc_id = f"d{digest[:10]}"
        if any(d.doc_id == doc_id for d in docs):
            skipped.append({"path": rel, "reason": "duplicate of another file"})
            continue
        docs.append(Doc(doc_id, rel, title_of(text, path), digest, len(text), kind))
        chunks.extend(chunk_text(text, doc_id, size, overlap))
    return docs, chunks, skipped
