"""Sensitive-data scan for agent tables (and any text FORGE stores for training).

Blocking findings (import refused): columns named like patient identifiers, and values that look like SSNs,
e-mail addresses, or phone numbers. Warnings (shown, not blocking): instruction-like text that could steer a
teacher model ("ignore previous instructions", "system prompt", ...).

This is a guard-rail, not a guarantee: it cannot recognise every identifier. FORGE still requires the explicit
"no patient or personal data" attestation, and only synthetic or non-sensitive data is permitted.
"""
from __future__ import annotations

import re
from typing import Any

BLOCK_COLUMNS = re.compile(
    r"(^|_)(patient|mrn|medical_record|ssn|social_security|dob|date_of_birth|birth_?date|first_name|last_name|full_name|"
    r"given_name|surname|home_address|street|email|e_mail|phone|mobile|member_id|subscriber_id|insurance_id|policy_number|"
    r"medicare_id|medicaid_id|nhs_number|passport|driver_license)(_|$)")
PATTERNS = {
    "SSN-like number": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    "e-mail address": re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b"),
    "phone number": re.compile(r"(?<!\d)(\+?1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}(?!\d)"),
    "medical record number": re.compile(r"(?i)\bMRN[:#\s]*\d+"),
}
INJECTION = re.compile(r"(?i)(ignore (all |any )?(previous|prior|above) (instructions|prompts)|system prompt|you are now|"
                       r"disregard (the|your) (instructions|rules)|developer mode)")


def scan_rows(columns: list[str], rows: list[dict[str, Any]], limit: int = 20) -> dict[str, list[str]]:
    block: list[str] = [f"column '{c}' looks like a personal identifier" for c in columns if BLOCK_COLUMNS.search(c)]
    warn: list[str] = []
    for i, r in enumerate(rows):
        for c, v in r.items():
            s = str(v)
            for label, rx in PATTERNS.items():
                if rx.search(s) and len(block) < limit:
                    block.append(f"row {i + 1}, column '{c}': {label}")
            if INJECTION.search(s) and len(warn) < limit:
                warn.append(f"row {i + 1}, column '{c}': instruction-like text (could steer the teacher)")
    return {"block": block, "warn": warn}


def scan_text(text: str) -> dict[str, list[str]]:
    block = [label for label, rx in PATTERNS.items() if rx.search(text)]
    warn = ["instruction-like text"] if INJECTION.search(text) else []
    return {"block": block, "warn": warn}
