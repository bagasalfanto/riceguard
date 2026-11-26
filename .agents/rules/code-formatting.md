---
trigger: always_on
description: "Perintah verifikasi wajib sebelum menutup tugas: Ruff, pytest, docs-guard, oxlint, dan build TypeScript/Vite."
---

# Format & Lint

Perintah verifikasi wajib tunggal sebelum menutup tugas:

```bash
npm run ci:check
```

Perintah `npm run ci:check` mencakup Ruff (`packages/riceguard_calc`, `apps/api`, `scripts`),
`pytest packages/riceguard_calc/tests dataset/tests -q`, `scripts/docs-guard.py`
(`--check-links --check-refs --check-readability --check-harness`), `oxlint` dan
`tsc -b && vite build` pada `apps/web`, serta `pytest apps/api/tests -q` saat `--with-api`
atau `DATABASE_URL` aktif.

Perbaikan cepat lint Python: `npm run lint:py`.

Rincian perintah, aturan gaya kode, konvensi penamaan, dan git/PR ada di `docs/RULES.md`.
