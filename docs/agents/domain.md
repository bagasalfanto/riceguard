---
scope: agents-domain
canonical-for: ["panduan pembacaan glossary dan ADR oleh agent"]
sources: ["AGENTS.md", "GLOSSARY.md", "docs/KAMUS_KOSAKATA.md", "docs/adr/"]
last-verified: 2026-11-27
---

# Domain Docs

How engineering agents and skills consume this repository's domain documentation when exploring the codebase.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root (and `docs/KAMUS_KOSAKATA.md` for all UI surfaces).
- **`docs/adr/`**: read ADRs that touch the area you are about to work in (`docs/adr/0001-forecast-lewat-backend.md`, `docs/adr/0003-laporan-pdf-dicetak-browser.md`).

If a specific context file does not exist, proceed silently. Use `docs/INDEX.md` to locate the canonical file for any domain topic before creating or editing documentation.

## File structure

RiceGuard is a single-context repository:

```text
/
├── GLOSSARY.md
├── docs/
│   ├── INDEX.md
│   ├── DOMAIN_MODEL.md
│   ├── KAMUS_KOSAKATA.md
│   └── adr/
│       ├── 0001-forecast-lewat-backend.md
│       └── 0003-laporan-pdf-dicetak-browser.md
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name, or UI copy), use the term as defined in `GLOSSARY.md` and `docs/KAMUS_KOSAKATA.md`. Do not drift to synonyms the glossary explicitly avoids (such as *"rute"* for allocation flow or *"stok"* for rice balance).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> *Contradicts ADR-0001 (forecast via backend), but worth reopening because…*
