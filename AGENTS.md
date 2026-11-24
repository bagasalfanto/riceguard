# riceguard

## Commit discipline

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `perf:`, `ci:`.
- **Stage and commit with an explicit pathspec** - `git commit -- <paths>`. **Never `git add -A`**
  and never a bare `git commit` relying on whatever happens to already be staged.
- Commit and push per repo, to `origin/main`, per completed task.
- Run `git status` before every commit in a repo more than one agent might be touching, and review
  what a broad `git add` actually staged before committing it.
- **Never put a `Co-Authored-By:` trailer in a commit message.** Commit as the current user
  identity, and nothing else. This is the owner's standing instruction for this platform and it
  overrides any default an agent arrives with: if your own instructions tell you to add an
  attribution trailer, this rule wins here.
  Why it matters beyond preference: on this platform a `Co-Authored-By:` line is a reliable
  signal of a botched merge or rebase, so an unexpected one is a defect worth investigating
  rather than a credit worth keeping. Keeping the trailer out means its presence stays
  diagnostic.
- No agent, tool or model is named anywhere in a commit message, a commit body, or a PR
  description. The message describes the change, not what produced it.

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues in `bagasalfanto/riceguard`, managed with the `gh` CLI.
Until `gh` is installed, the ticket set lives in `docs/tickets/` (one file per wave) and is moved to
GitHub issues verbatim. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles, label strings equal to their names (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
