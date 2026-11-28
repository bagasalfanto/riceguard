---
scope: agents-issue-tracker
canonical-for: ["konvensi issue tracker GitHub & pelacakan tiket lokal"]
sources: ["AGENTS.md", "docs/tickets/README.md"]
last-verified: 2026-11-26
---

# Issue Tracker: GitHub & Local Tickets

Issues and specs for RiceGuard target GitHub issues in `bagasalfanto/riceguard`, managed with the `gh` CLI when installed. Until `gh` is configured in the active environment, the wave ticket set lives in `docs/tickets/` (`docs/tickets/README.md`) and serves as the local source of truth.

## Local vs GitHub Mode

- **Local ticket set (active when `gh` is absent):** read and update `docs/tickets/README.md` and the corresponding wave file (`docs/tickets/wave-*.md`).
- **GitHub Issues (when `gh` CLI is installed and authenticated):** move or sync tickets into `bagasalfanto/riceguard` and apply the canonical triage labels in `triage-labels.md`.

## `gh` CLI Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --json number,title,body,labels,comments`.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Sub-issues**: `gh issue create --parent <parent> ...` or `gh issue edit <parent> --add-sub-issue <child>`. Without sub-issues enabled, put `Part of #<parent>` at the top of the child body.
- **Blocking**: use native issue dependencies (`gh issue create --blocked-by <n>` or `gh issue edit <child> --add-blocked-by <blocker>`), or fall back to `Blocked by: #<n>` at the top of the child body.
- **Count open blockers**: `gh api repos/<owner>/<repo>/issues/<n> --jq .issue_dependencies_summary.blocked_by` or filter `--json blockedBy` for `OPEN` blockers.
- **Comment / labels / close**: `gh issue comment <number> --body "..."`, `gh issue edit <number> --add-label "..."` / `--remove-label "..."`, and `gh issue close <number>`.

Infer the repo from `git remote -v`; before the first `gh issue create` of a session, confirm the target repository (`bagasalfanto/riceguard`) with `gh repo view --json nameWithOwner`.

## Pull requests as a triage surface

**PRs as a request surface: no.** *(External PRs are not treated as feature requests unless explicitly toggled.)*

When reading or triaging PRs with `gh`:

- **Read a PR**: `gh pr view <number>`, `gh pr view <number> --comments`, and `gh pr diff <number>`.
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub shares one number space across issues and PRs, so resolve bare `#<n>` with `gh pr view <n>` and fall back to `gh issue view <n>`.
