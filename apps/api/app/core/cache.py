"""Cache respons publik in-memory, per (path, version_id, query).

Batas ukuran wajib: kunci memuat query string dari klien, jadi tanpa batas satu
klien bisa menumbuhkan memori tanpa henti. Saat penuh, entri paling lama dibuang.
"""
from __future__ import annotations

import threading
import time

TTL_DETIK = 300
MAKS_ENTRI = 512


class ResponseCache:
    def __init__(self, ttl: int = TTL_DETIK, maks_entri: int = MAKS_ENTRI):
        self._ttl = ttl
        self._maks = maks_entri
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
            if key not in self._data and len(self._data) >= self._maks:
                tertua = min(self._data, key=lambda k: self._data[k][0])
                del self._data[tertua]
            self._data[key] = (time.monotonic(), nilai)

    def clear_version(self, version_id) -> None:
        with self._lock:
            for k in [k for k in self._data if k[1] == version_id]:
                del self._data[k]

    def clear_all(self) -> None:
        with self._lock:
            self._data.clear()

    def __len__(self) -> int:
        return len(self._data)


cache = ResponseCache()
