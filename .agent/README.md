# Skills

Skill untuk agent, ikut ter-commit supaya semua anggota tim dapat versi yang sama.

Dimuat lewat `opencode.json` → `skills.paths: [".agent/skills"]`.
Setelah menambah atau mengubah skill, **restart opencode** agar terbaca.

## Menambah skill

```
.agent/skills/<nama>/SKILL.md
```

- Folder `<nama>` harus sama dengan field `name:` di frontmatter `SKILL.md`.
- `description` wajib, dan harus menyebut kapan skill dipakai (kata kunci pemicu).
- File pendukung (`references/`, `scripts/`, `agents/`) taruh di dalam folder skill itu,
  dirujuk dengan path relatif.

## Yang tersedia

| Skill | Dipakai untuk |
| --- | --- |
| `ponytail`, `ponytail-review`, `ponytail-audit` | Diff sekecil mungkin, review perubahan, audit repo |
| `frontend-design`, `ui-design`, `anti-ui-slop`, `ui-slop-score` | Desain & review UI, menghindari tampilan generik |
| `accessibility` | Audit WCAG 2.2, keyboard, kontras |
| `tailwind-4-docs` | Tailwind CSS v4 (proyek ini memakai v4) |
| `vercel-react-best-practices` | Performa React/Vite |
| `tdd`, `diagnosing-bugs` | Tes lebih dulu, diagnosis bug |
| `grilling`, `domain-modeling`, `code-review` | Mempertajam rencana, glossary/ADR, review |
