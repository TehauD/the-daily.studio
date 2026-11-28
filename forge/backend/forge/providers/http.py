from __future__ import annotations

import httpx


def make_client(timeout: float, transport: httpx.AsyncBaseTransport | None = None, headers: dict | None = None) -> httpx.AsyncClient:
    # trust_env=False: never route local model traffic through a corporate proxy.
    return httpx.AsyncClient(timeout=httpx.Timeout(timeout, connect=min(timeout, 2.0)),
                             transport=transport, trust_env=False, headers=headers)
