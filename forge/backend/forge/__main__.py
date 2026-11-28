"""`python -m forge` — launch FORGE (UI + API) on loopback.

Order matters:
1. Check and *bind* the port before building anything, so a conflict exits immediately with
   the owning PID instead of after DB migration / UI mounting.
2. Hand the bound socket to uvicorn; `forge.started` is logged from the lifespan, which runs
   only after the socket is already listening.
"""
from __future__ import annotations

import socket
import sys

import psutil


def port_owner(port: int) -> str:
    try:
        for c in psutil.net_connections(kind="tcp"):
            if c.laddr and c.laddr.port == port and c.status == psutil.CONN_LISTEN:
                try:
                    p = psutil.Process(c.pid) if c.pid else None
                    return f"PID {c.pid} ({p.name() if p else '?'}; {' '.join(p.cmdline()[:4]) if p else ''})"
                except (psutil.Error, OSError):
                    return f"PID {c.pid}"
    except (psutil.AccessDenied, OSError):
        return "unknown process (run as the same user or check: netstat -ano | findstr :%d)" % port
    return "unknown process"


def bind_socket(host: str, port: int) -> socket.socket:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    if sys.platform != "win32":
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    else:  # never share a port with another listener on Windows
        s.setsockopt(socket.SOL_SOCKET, getattr(socket, "SO_EXCLUSIVEADDRUSE", 0), 1)
    s.bind((host, port))
    s.listen(128)
    s.setblocking(False)
    return s


def main() -> int:
    from forge.config import Settings
    s = Settings()
    s.validate_bind()
    try:
        sock = bind_socket(s.host, s.port)
    except OSError:
        print(f"[forge] Port {s.port} on {s.host} is already in use by {port_owner(s.port)}.\n"
              f"        Stop that process or launch with -Port <n> (FORGE_PORT).", file=sys.stderr)
        return 3
    import uvicorn

    from forge.api.app import create_app
    print(f"[forge] interpreter: {sys.executable}")
    print(f"[forge] listening on http://{s.host}:{s.port}")
    config = uvicorn.Config(create_app(s), log_level="warning")
    uvicorn.Server(config).run(sockets=[sock])
    return 0


if __name__ == "__main__":
    sys.exit(main())
