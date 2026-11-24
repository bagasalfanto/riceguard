"""Cache respons publik in-memory, per (path, version_id, query)."""
from __future__ import annotations

import threading
import time

TTL_DETIK = 300


class ResponseCache:
    def __init__(self, ttl: int = TTL_DETIK):
        self._ttl = ttl
        self._data: dict[tuple, tuple[float, object]] = {}
        self._lock = threading.Lock()

    def get(self, key: tuple):
        with self._lock:
            item = self._data.get(key)
            if item is None:
                return None
            dibuat, nilai = item
            if time.monotonic() - dibuat > self._ttl:
                del self._data[key]
                return None
            return nilai

    def set(self, key: tuple, nilai) -> None:
        with self._lock:
            self._data[key] = (time.monotonic(), nilai)

    def clear_version(self, version_id) -> None:
        with self._lock:
            for k in [k for k in self._data if k[1] == version_id]:
                del self._data[k]

    def clear_all(self) -> None:
        with self._lock:
            self._data.clear()


cache = ResponseCache()
