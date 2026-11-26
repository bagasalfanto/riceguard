---
scope: agents-triage-labels
canonical-for: ["pemetaan lima peran label triase kanonik"]
sources: ["AGENTS.md", "docs/agents/issue-tracker.md"]
last-verified: 2026-11-26
---

# Triage Labels

The repository uses five canonical triage roles. This table maps each role to the exact label string used in `bagasalfanto/riceguard`.

| Canonical Role | Label in our tracker | Meaning |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | Maintainer needs to evaluate this issue |
| `needs-info` | `needs-info` | Waiting on reporter for more information |
| `ready-for-agent` | `ready-for-agent` | Fully specified, ready for autonomous implementation |
| `ready-for-human` | `ready-for-human` | Requires human decision or manual action |
| `wontfix` | `wontfix` | Will not be actioned |

When workflows or agents mention a triage role (for example, marking an issue ready for autonomous execution), apply the corresponding label string from the second column.
