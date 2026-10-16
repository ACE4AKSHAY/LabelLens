from __future__ import annotations

from contextvars import ContextVar


request_id_context: ContextVar[str] = ContextVar("labellens_request_id", default="-")
