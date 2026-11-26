"""Guard dokumentasi RiceGuard.

Memeriksa tautan, rujukan antar-dokumen, keterbacaan agen, kelengkapan harness,
drift kode-vs-dokumen, ketebasan dokumen, dan atestasi PR. Dipakai oleh
hook agen (scripts/docs-hook.py), pre-commit, dan GitHub Actions.

Keluar dengan kode 0 bila bersih, 1 bila ada temuan, 2 bila salah pakai.
"""
from __future__ import annotations

import glob
import json
import os
import posixpath
import re
import subprocess
import sys
from datetime import date
from pathlib import Path
from typing import Any
from urllib.parse import unquote

DOCS_GUARD_MAX_LINES = 400
DOCS_GUARD_MAX_RULE_BYTES = 24000
_IGNORED_DIRS = {".git", ".venv", ".cache", "node_modules", "apps", "storage", "dist", "build", "__pycache__"}
_RULE_DIRECTORIES = (".agents/rules", ".claude/rules")
_VALID_ANTIGRAVITY_TRIGGERS = {"always_on", "model_decision", "glob", "manual"}


def _configure_stdio() -> None:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(encoding="utf-8", errors="replace")


def guard_out(line: str = "") -> None:
    sys.stdout.write(f"{line}\n")


def guard_err(line: str = "") -> None:
    sys.stderr.write(f"{line}\n")


def guard_root() -> Path:
    return Path(__file__).resolve().parent.parent


def guard_path(relative: str) -> Path:
    normalized = relative.replace("\\", "/")
    while normalized.startswith("./"):
        normalized = normalized[2:]
    if not normalized or normalized == ".":
        return guard_root()
    parts = [part for part in normalized.split("/") if part and part != "."]
    return guard_root().joinpath(*parts)


def guard_git(args: list[str]) -> tuple[int, list[str]]:
    proc = subprocess.run(
        ["git", "-c", "core.quotepath=false", "-C", str(guard_root()), *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if proc.returncode != 0:
        return proc.returncode, []
    lines = [line.replace("\\", "/").strip() for line in proc.stdout.splitlines() if line.strip()]
    return 0, lines


def guard_has_head() -> bool:
    code, _ = guard_git(["rev-parse", "--verify", "HEAD"])
    return code == 0


def guard_ref_exists(ref: str) -> bool:
    code, _ = guard_git(["rev-parse", "--verify", "--quiet", f"{ref}^{{commit}}"])
    return code == 0


def guard_git_changed(base: str | None) -> list[str]:
    if base is None:
        code, lines = guard_git(["diff", "--cached", "--name-only", "--diff-filter=ACMRT"])
        return lines if code == 0 else []
    code, lines = guard_git(["diff", "--name-only", "--diff-filter=ACMRT", f"{base}...HEAD"])
    return lines if code == 0 else []


def guard_git_changed_pending() -> list[str]:
    code, lines = guard_git(["diff", "--name-only", "--diff-filter=ACMRT", "HEAD"])
    if code == 0:
        return lines
    if not guard_has_head():
        code, lines = guard_git(["diff", "--cached", "--name-only", "--diff-filter=ACMRT"])
        if code == 0:
            return lines
    return []


def guard_git_untracked() -> list[str]:
    code, lines = guard_git(["ls-files", "--others", "--exclude-standard"])
    return lines if code == 0 else []


def guard_pending_files(rules: list[dict[str, Any]], pending: list[str]) -> list[str]:
    untracked = guard_git_untracked()
    if not untracked:
        return pending

    patterns: list[str] = []
    for rule in rules:
        if rule.get("untracked") is not True:
            continue
        for pattern in rule.get("when", []):
            if isinstance(pattern, str):
                patterns.append(pattern)

    if not patterns:
        return pending

    seen = set(pending)
    result = list(pending)
    for file in guard_filter(untracked, patterns):
        if file not in seen:
            seen.add(file)
            result.append(file)
    return result


def guard_glob_to_regex(pattern: str) -> re.Pattern[str]:
    """Terjemahkan glob ke regex secara per-karakter agar '**/' cocok 0+ segmen."""
    regex_parts: list[str] = []
    length = len(pattern)
    i = 0
    while i < length:
        char = pattern[i]
        if char == "*":
            if i + 1 < length and pattern[i + 1] == "*":
                if i + 2 < length and pattern[i + 2] == "/":
                    regex_parts.append("(?:.*/)?")
                    i += 3
                    continue
                regex_parts.append(".*")
                i += 2
                continue
            regex_parts.append("[^/]*")
            i += 1
            continue
        if char == "?":
            regex_parts.append("[^/]")
            i += 1
            continue
        regex_parts.append(re.escape(char))
        i += 1
    return re.compile(f"^{''.join(regex_parts)}$")


def guard_matches_any(path: str, patterns: list[str]) -> bool:
    normalized = path.replace("\\", "/")
    return any(guard_glob_to_regex(pattern).match(normalized) is not None for pattern in patterns)


def guard_filter(files: list[str], patterns: list[str]) -> list[str]:
    matched: list[str] = []
    seen: set[str] = set()
    for file in files:
        normalized = file.replace("\\", "/")
        if normalized not in seen and guard_matches_any(normalized, patterns):
            seen.add(normalized)
            matched.append(normalized)
    return matched


def guard_has_wildcard(value: str) -> bool:
    return "*" in value or "?" in value


def guard_expand_glob(pattern: str) -> list[str]:
    if not guard_has_wildcard(pattern):
        return [pattern]
    root = guard_root().resolve()
    raw_pattern = str(root / pattern.replace("/", os.sep))
    matches = glob.glob(raw_pattern, recursive=True)
    if not matches:
        return [pattern]
    resolved: list[str] = []
    for match in sorted(matches):
        try:
            rel = Path(match).resolve().relative_to(root).as_posix()
        except ValueError:
            continue
        resolved.append(rel)
    return resolved if resolved else [pattern]


def guard_normalize_text(content: str) -> str:
    if content.startswith("\ufeff"):
        content = content[1:]
    return content.replace("\r\n", "\n").replace("\r", "\n")


def guard_frontmatter(content: str) -> dict[str, str]:
    normalized = guard_normalize_text(content)
    if not normalized.startswith("---\n"):
        return {}
    match = re.match(r"^---\n(.*?)\n---(?:\n|$)", normalized, re.S)
    if not match:
        return {}
    block = match.group(1)
    values: dict[str, str] = {}
    current_list_key: str | None = None
    list_items: list[str] = []

    def _flush_list() -> None:
        nonlocal current_list_key, list_items
        if current_list_key is not None:
            values[current_list_key] = ", ".join(list_items)
        current_list_key = None
        list_items = []

    for line in block.splitlines():
        if current_list_key is not None:
            item_match = re.match(r"^\s+-\s*(.+?)\s*$", line)
            if item_match:
                item = item_match.group(1).strip().strip("\"'")
                if item:
                    list_items.append(item)
                continue
            _flush_list()

        kv_match = re.match(r"^([A-Za-z0-9_-]+):\s*(.*)$", line)
        if not kv_match:
            continue
        key = kv_match.group(1)
        raw_val = kv_match.group(2).strip()
        if raw_val == "":
            current_list_key = key
            list_items = []
        else:
            values[key] = raw_val.strip(" \t\"'")

    _flush_list()
    return values


def guard_strip_frontmatter(content: str) -> str:
    normalized = guard_normalize_text(content)
    return re.sub(r"^---\n.*?\n---(?:\n|$)", "", normalized, count=1, flags=re.S)


def guard_markdown_files(scope: str | None = None) -> list[str]:
    root = guard_root()
    directory = root if scope is None else guard_path(scope)
    if not directory.is_dir():
        return []
    files: list[str] = []
    for dirpath, dirnames, filenames in os.walk(directory):
        dirnames[:] = sorted(d for d in dirnames if d not in _IGNORED_DIRS)
        for filename in sorted(filenames):
            if not filename.endswith(".md"):
                continue
            full_path = Path(dirpath) / filename
            rel = full_path.relative_to(root).as_posix()
            if re.search(r"(^|/)(vendor|node_modules|\.venv|\.cache|storage|public/build)/", rel):
                continue
            files.append(rel)
    files.sort()
    return files


def guard_index_rows() -> list[str]:
    index_path = guard_path("docs/INDEX.md")
    if not index_path.is_file():
        return []
    content = guard_normalize_text(index_path.read_text(encoding="utf-8", errors="replace"))
    section = re.search(r"##\s*2\.(.*?)(?=\n##\s|\Z)", content, re.S)
    if not section:
        return []
    rows: list[str] = []
    seen: set[str] = set()
    for match in re.findall(r"^\|\s*`([^`]+)`\s*\|", section.group(1), re.M):
        item = match.strip()
        if item and item not in seen:
            seen.add(item)
            rows.append(item)
    return rows


def guard_doc_sources() -> list[str]:
    targets = guard_markdown_files("docs")
    targets.extend(["AGENTS.md", "README.md"])
    for optional in ("CLAUDE.md", "GLOSSARY.md", "llms.txt"):
        if guard_path(optional).is_file():
            targets.append(optional)
    return targets


def _clean_markdown_link_target(raw_target: str) -> str:
    target = raw_target.strip()
    if target.startswith("<") and ">" in target:
        return target[1 : target.index(">")].strip()
    return re.sub(r'\s+(?:"[^"]*"|\'[^\']*\')\s*$', "", target).strip()


def guard_collect_references(content: str) -> list[tuple[str, str]]:
    normalized = guard_normalize_text(content)
    without_fences = re.sub(r"```.*?```", "", normalized, flags=re.S)
    without_code = re.sub(r"`[^`\r\n]+`", "", without_fences)
    references: list[tuple[str, str]] = []

    for raw_target in re.findall(r"\]\(([^)\r\n]+)\)", without_code):
        target = _clean_markdown_link_target(raw_target)
        if not target or target.startswith("#"):
            continue
        if target.startswith("file://"):
            references.append(("tautan file:// dilarang", target))
            continue
        if re.match(r"^[a-z]+://", target, re.I) or target.startswith("mailto:"):
            continue
        if target.startswith("/"):
            references.append(("tautan absolut dilarang", target))
            continue
        cleaned = re.sub(r"[#?].*$", "", target)
        if not cleaned:
            continue
        references.append(("tautan mati", unquote(cleaned)))

    for raw_span in re.findall(r"`([^`\s]+\.md)`", normalized):
        target = raw_span.strip()
        if not target or target.startswith("#") or target.startswith("/"):
            continue
        if re.match(r"^[a-z]+://", target, re.I):
            continue
        if "<" in target and ">" in target:
            continue
        cleaned = re.sub(r"[#?].*$", "", target)
        if not cleaned:
            continue
        references.append(("rujukan dokumen mati", unquote(cleaned)))

    return references


def guard_resolve_reference(file: str, target: str) -> bool:
    if any(set(part) == {"."} and len(part) >= 3 for part in target.replace("\\", "/").split("/") if part):
        return False
    directory = posixpath.dirname(file)
    candidates: list[str] = []
    if directory and directory != ".":
        candidates.append(f"{directory}/{target}")
    candidates.append(target)

    for candidate in candidates:
        normalized = candidate.replace("\\", "/")
        normalized = re.sub(r"^\./", "", normalized)
        normalized = posixpath.normpath(normalized)
        if normalized == ".." or normalized.startswith("../"):
            continue
        for match in guard_expand_glob(normalized):
            if guard_path(match).exists():
                return True
    return False


def guard_check_links() -> dict[str, Any]:
    findings: list[str] = []
    seen_findings: set[str] = set()
    checked = 0

    for file in guard_doc_sources():
        absolute = guard_path(file)
        if not absolute.is_file():
            continue
        content = absolute.read_text(encoding="utf-8", errors="replace")
        references = guard_collect_references(content)
        checked += len(references)
        for kind, target in references:
            if kind in ("tautan file:// dilarang", "tautan absolut dilarang") or not guard_resolve_reference(
                file, target
            ):
                entry = f"{file}: {kind} -> {target}"
                if entry not in seen_findings:
                    seen_findings.add(entry)
                    findings.append(entry)

    return {"findings": findings, "checked": checked}


def guard_check_refs() -> dict[str, Any]:
    findings: list[str] = []
    rows = guard_index_rows()
    disk = guard_markdown_files("docs")

    for row in rows:
        exists = any(guard_path(candidate).exists() for candidate in guard_expand_glob(row))
        if not exists:
            findings.append(f"ghost: docs/INDEX.md mendaftarkan berkas yang tidak ada -> {row}")

    row_set = set(rows)
    for file in disk:
        if file not in row_set:
            findings.append(f"orphan: berkas docs tidak terdaftar di docs/INDEX.md bagian 2 -> {file}")

    return {"findings": findings, "checked": len(rows) + len(disk)}


def guard_rule_directories() -> tuple[str, ...]:
    return _RULE_DIRECTORIES


def guard_check_readability() -> dict[str, Any]:
    findings: list[str] = []
    checked = 0
    targets = guard_markdown_files("docs")
    rule_patterns = [f"{directory}/*.md" for directory in guard_rule_directories()]

    for directory in guard_rule_directories():
        dir_path = guard_path(directory)
        if dir_path.is_dir():
            for md_file in sorted(dir_path.glob("*.md")):
                targets.append(f"{directory}/{md_file.name}")

    index_rows: set[str] | None = None

    for file in targets:
        absolute = guard_path(file)
        if not absolute.is_file():
            continue
        checked += 1
        raw_bytes = absolute.read_bytes()
        byte_len = len(raw_bytes)
        content = guard_normalize_text(raw_bytes.decode("utf-8", errors="replace"))
        lines = len(content.splitlines())
        is_antigravity_rule = file.startswith(".agents/rules/")
        is_rule = guard_matches_any(file, rule_patterns)
        frontmatter = guard_frontmatter(content)

        if not is_rule:
            for key in ("scope", "canonical-for", "sources", "last-verified"):
                if key not in frontmatter:
                    findings.append(f"{file}: frontmatter wajib hilang -> {key}")
            if frontmatter.get("status") == "deprecated":
                if index_rows is None:
                    index_rows = set(guard_index_rows())
                if file in index_rows:
                    findings.append(f"{file}: berstatus deprecated tetapi masih terdaftar di docs/INDEX.md bagian 2")

        if is_antigravity_rule:
            trigger = frontmatter.get("trigger")
            if trigger is None:
                findings.append(f"{file}: rule Antigravity wajib punya frontmatter trigger")
            elif trigger not in _VALID_ANTIGRAVITY_TRIGGERS:
                findings.append(f"{file}: trigger Antigravity tidak dikenal -> {trigger}")
            elif trigger == "glob" and "globs" not in frontmatter and "glob" not in frontmatter:
                findings.append(f"{file}: trigger glob wajib menyertakan frontmatter globs")
            elif trigger == "model_decision" and "description" not in frontmatter:
                findings.append(f"{file}: trigger model_decision wajib menyertakan frontmatter description")

        body = guard_strip_frontmatter(content)
        without_fences = re.sub(r"```.*?```", "", body, flags=re.S)
        h1_count = len(re.findall(r"^#[ \t]+\S", without_fences, re.M))
        if h1_count != 1:
            findings.append(f"{file}: wajib tepat satu H1, ditemukan {h1_count}")

        if is_rule and byte_len > DOCS_GUARD_MAX_RULE_BYTES:
            findings.append(f"{file}: {byte_len} byte melebihi batas {DOCS_GUARD_MAX_RULE_BYTES} byte Antigravity")

        limit = DOCS_GUARD_MAX_LINES
        override = frontmatter.get("max-lines")
        if isinstance(override, str):
            limit_match = re.fullmatch(r"(\d+)(?:\s+#.*)?", override.strip())
            if limit_match:
                limit = int(limit_match.group(1))

        if lines > limit:
            findings.append(
                f"{file}: {lines} baris melebihi batas {limit}; pecah per domain atau tandai max-lines dengan alasan"
            )

    llms = guard_path("llms.txt")
    if llms.is_file():
        checked += 1
        llms_content = guard_normalize_text(llms.read_text(encoding="utf-8", errors="replace"))
        for target in re.findall(r"^\s*-\s+([A-Za-z0-9._/-]+\.md)\s*:", llms_content, re.M):
            if not guard_path(target).is_file():
                findings.append(f"llms.txt: menunjuk berkas yang tidak ada -> {target}")

    return {"findings": findings, "checked": checked}


def guard_map() -> dict[str, Any]:
    path = guard_path("docs-map.json")
    if not path.is_file():
        return {"rules": [], "escape": {}}
    try:
        decoded = json.loads(path.read_text(encoding="utf-8", errors="replace"))
    except json.JSONDecodeError:
        return {"rules": [], "escape": {}}
    return decoded if isinstance(decoded, dict) else {"rules": [], "escape": {}}


def guard_harness_files() -> list[str]:
    harness = guard_map().get("harness")
    if not isinstance(harness, list):
        return []
    return [item.strip() for item in harness if isinstance(item, str) and item.strip()]


def guard_check_harness() -> dict[str, Any]:
    findings: list[str] = []
    files = guard_harness_files()
    for file in files:
        absolute = guard_path(file)
        if not absolute.is_file():
            findings.append(f"{file}: berkas config harness tidak ditemukan")
            continue
        content = absolute.read_text(encoding="utf-8", errors="replace")
        if file.endswith(".json"):
            try:
                decoded = json.loads(content)
            except json.JSONDecodeError as exc:
                findings.append(f"{file}: JSON tidak valid -> {exc}")
                continue
            if not isinstance(decoded, dict):
                findings.append(f"{file}: JSON root wajib berupa objek")
                continue
        if "scripts/docs-hook.py" not in content:
            findings.append(f"{file}: tidak merujuk scripts/docs-hook.py, jadi tidak ada gate yang terpasang")
    return {"findings": findings, "checked": len(files)}


def guard_drift_findings(changed: list[str]) -> list[dict[str, Any]]:
    rules = guard_map().get("rules")
    if not isinstance(rules, list):
        return []
    findings: list[dict[str, Any]] = []
    for rule in rules:
        if not isinstance(rule, dict):
            continue
        when = [p for p in rule.get("when", []) if isinstance(p, str)]
        require = [p for p in rule.get("require", []) if isinstance(p, str)]
        touched_code = guard_filter(changed, when)
        if not touched_code:
            continue
        touched_docs = guard_filter(changed, require)
        if touched_docs:
            continue
        findings.append(
            {
                "type": "drift",
                "rule": str(rule.get("id") or "tanpa-nama"),
                "code": touched_code,
                "require": require,
            }
        )
    return findings


def _parse_sources_list(raw_sources: str) -> list[str]:
    cleaned = raw_sources.strip()
    if cleaned.startswith("[") and cleaned.endswith("]"):
        cleaned = cleaned[1:-1]
    items: list[str] = []
    for part in cleaned.split(","):
        item = part.strip().strip("\"'")
        if item:
            items.append(item)
    return items


def guard_last_commit_date(path: str) -> date | None:
    if "*" in path or "?" in path:
        newest: date | None = None
        for match in guard_expand_glob(path):
            if guard_has_wildcard(match):
                continue
            commit_date = guard_last_commit_date(match)
            if commit_date is not None and (newest is None or commit_date > newest):
                newest = commit_date
        return newest

    if not guard_path(path).exists():
        return None
    code, lines = guard_git(["log", "-1", "--format=%cs", "--", path])
    if code != 0 or not lines:
        return None
    try:
        return date.fromisoformat(lines[0])
    except ValueError:
        return None


def guard_stale_findings(max_age_days: int) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    for file in guard_markdown_files("docs"):
        content = guard_path(file).read_text(encoding="utf-8", errors="replace")
        frontmatter = guard_frontmatter(content)
        verified_raw = frontmatter.get("last-verified", "")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", verified_raw):
            continue
        try:
            verified_at = date.fromisoformat(verified_raw)
        except ValueError:
            continue
        sources_raw = frontmatter.get("sources", "")
        if not sources_raw:
            continue
        for source in _parse_sources_list(sources_raw):
            newest = guard_last_commit_date(source)
            if newest is None:
                continue
            age = (newest - verified_at).days
            if age > max_age_days:
                findings.append(
                    {
                        "type": "stale",
                        "doc": file,
                        "last_verified": verified_raw,
                        "source": source,
                        "source_changed": newest.isoformat(),
                        "age_days": age,
                    }
                )
                break
    return findings


def guard_attestation_body() -> str:
    body = os.environ.get("PR_BODY", "")
    sha = os.environ.get("PR_HEAD_SHA", "")
    if sha:
        proc = subprocess.run(
            ["git", "-c", "core.quotepath=false", "-C", str(guard_root()), "show", "-s", "--format=%B", sha],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            body = f"{body}\n{proc.stdout}".strip()
    if not body:
        proc = subprocess.run(
            ["git", "-c", "core.quotepath=false", "-C", str(guard_root()), "log", "-1", "--format=%B"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
        if proc.returncode == 0:
            body = proc.stdout
    return body


def guard_escape_reason() -> str | None:
    escape = guard_map().get("escape")
    if not isinstance(escape, dict):
        escape = {}
    label = str(escape.get("label") or "docs-exempt")
    trailer = str(escape.get("trailer") or "Docs-Exempt:")

    labels_raw = os.environ.get("PR_LABELS", "")
    if labels_raw:
        labels = [item.strip() for item in labels_raw.split(",")]
        if label in labels:
            return f"label {label} pada PR"

    body = guard_attestation_body()
    match = re.search(rf"{re.escape(trailer)}\s*(\S[^\n]*)", body)
    if match:
        return f'trailer "{trailer} {match.group(1).strip()}"'

    override = os.environ.get("DOCS_STRICT_OVERRIDE", "").strip()
    if override:
        return f"DOCS_STRICT_OVERRIDE={override}"

    return None


def guard_print_list(title: str, findings: list[str]) -> None:
    if not findings:
        guard_out(f"OK   {title}")
        return
    guard_out(f"FAIL {title}")
    for finding in findings:
        guard_out(f"     - {finding}")


def guard_print_drift(findings: list[dict[str, Any]]) -> None:
    if not findings:
        guard_out("OK   drift: kode dan dokumen selaras")
        return
    guard_out("FAIL drift: kode berubah tanpa dokumen pendamping")
    for finding in findings:
        guard_out(f"     - {finding['rule']} -> wajib perbarui: {', '.join(finding['require'])}")
        guard_out(f"       kode: {', '.join(finding['code'])}")


def guard_main(argv: list[str] | None = None) -> int:
    _configure_stdio()
    options = sys.argv[1:] if argv is None else argv
    flags: set[str] = set()
    base: str | None = None
    max_age = 90

    for option in options:
        if option.startswith("--base="):
            base = option[7:]
            continue
        if option.startswith("--max-age="):
            try:
                max_age = int(option[10:])
            except ValueError:
                guard_err(f"Nilai --max-age tidak valid: {option[10:]}")
                return 2
            continue
        flags.add(option)

    json_mode = "--json" in flags
    quiet = "--quiet" in flags or "--silent" in flags
    strict = "--strict" in flags or os.environ.get("DOCS_STRICT") == "1"
    summary = "--summary" in flags

    report: dict[str, Any] = {"ok": True, "mode": "", "findings": []}
    exit_code = 0

    run_links = "--check-links" in flags
    run_refs = "--check-refs" in flags
    run_readability = "--check-readability" in flags
    run_harness = "--check-harness" in flags
    run_drift = "--drift" in flags
    run_stale = "--stale" in flags
    run_attestation = "--check-attestation" in flags
    run_prompt = "--prompt" in flags
    run_staged = "--staged" in flags
    run_pending = "--pending" in flags

    drift_scope = "range"
    if run_staged:
        run_links = True
        run_refs = True
        run_drift = True
        base = None
        drift_scope = "staged"

    if run_pending:
        run_drift = True
        drift_scope = "pending"

    if run_drift and drift_scope == "range" and base is None:
        guard_err("--drift butuh --base=<ref>, --staged, atau --pending")
        return 2

    if base is not None and drift_scope == "range" and not guard_ref_exists(base):
        guard_err(f"Base ref tidak ditemukan: {base}")
        guard_err("Periksa ejaan ref, atau pastikan riwayat cabang sudah terambil (fetch-depth: 0).")
        return 2

    if not any(
        (run_links, run_refs, run_readability, run_harness, run_drift, run_stale, run_attestation, run_prompt)
    ):
        guard_err(
            "Tidak ada mode yang dipilih. Gunakan --check-links, --check-refs, --check-readability, "
            "--check-harness, --drift, --stale, --check-attestation, --prompt, --staged, atau --pending."
        )
        return 2

    if run_links:
        result = guard_check_links()
        report["mode"] = "check-links"
        if not quiet and not json_mode:
            guard_print_list(f"tautan ({result['checked']} diperiksa)", result["findings"])
        if result["findings"]:
            report["ok"] = False
            report["findings"].extend(result["findings"])
            exit_code = 1

    if run_refs:
        result = guard_check_refs()
        if not quiet and not json_mode:
            guard_print_list("rujukan docs/INDEX.md", result["findings"])
        if result["findings"]:
            report["ok"] = False
            report["findings"].extend(result["findings"])
            exit_code = 1

    if run_readability:
        result = guard_check_readability()
        if not quiet and not json_mode:
            guard_print_list(f"keterbacaan agen ({result['checked']} berkas)", result["findings"])
        if result["findings"]:
            report["ok"] = False
            report["findings"].extend(result["findings"])
            exit_code = 1

    if run_harness:
        result = guard_check_harness()
        if not quiet and not json_mode:
            guard_print_list(f"harness terpasang ({result['checked']} berkas)", result["findings"])
        if result["findings"]:
            report["ok"] = False
            report["findings"].extend(result["findings"])
            exit_code = 1

    if run_drift:
        changed = guard_git_changed_pending() if drift_scope == "pending" else guard_git_changed(base)
        if drift_scope == "pending":
            rules = [r for r in guard_map().get("rules", []) if isinstance(r, dict)]
            changed = guard_pending_files(rules, changed)

        findings = guard_drift_findings(changed)
        escaped: str | None = None
        if findings:
            escaped = guard_escape_reason()

        if findings and escaped is not None:
            if not quiet and not json_mode:
                guard_out(f"WARN drift dilepas oleh {escaped}")
                guard_out(f"     tersisa {len(findings)} aturan yang wajib diselaraskan segera")
            elif summary:
                guard_out(f"> Drift dilepas oleh {escaped} — {len(findings)} aturan tetap perlu diselaraskan.")
            findings = []

        report["mode"] = "drift"
        report["escaped_by"] = escaped

        if not quiet and not json_mode:
            guard_print_drift(findings)

        if findings:
            report["ok"] = False
            report["findings"] = findings
            exit_code = 1

    if run_stale:
        stale_findings = guard_stale_findings(max_age)
        report["mode"] = "stale"
        if not quiet and not json_mode:
            if not stale_findings:
                guard_out("OK   ketebasan: tidak ada dokumen basi")
            else:
                guard_out(f"FAIL ketebasan: {len(stale_findings)} dokumen basi")
                for finding in stale_findings:
                    guard_out(
                        f"     - {finding['doc']}: last-verified {finding['last_verified']}, "
                        f"tetapi {finding['source']} berubah {finding['source_changed']}"
                    )
        report["findings"] = stale_findings

    if run_attestation:
        body = guard_attestation_body()
        missing: list[str] = []
        if not re.search(r"\[Docs Consulted:[^\]]*\]", body):
            missing.append("blok [Docs Consulted: ...] tidak ditemukan di badan PR atau pesan commit")
        if not re.search(r"\[Docs Updated:[^\]]*\]", body):
            missing.append("blok [Docs Updated: ...] tidak ditemukan di badan PR atau pesan commit")
        if re.search(r"\[Docs Updated:\s*None needed\s*[—-]\s*\S+", body):
            missing = [item for item in missing if "Docs Updated" not in item]
        if not quiet and not json_mode:
            guard_print_list("atestasi konfirmasi agen", missing)
        if missing:
            report["ok"] = False
            report["findings"].extend(missing)
            exit_code = 1

    if run_prompt:
        changed = guard_git_changed(base)
        drift_findings = guard_drift_findings(changed)
        lines = [
            "# Tugas: selaraskan dokumentasi",
            "",
            "Perubahan kode berikut belum punya pendamping dokumen. Baca dokumen terkait,",
            "lalu perbarui hanya bagian yang faktanya berubah. Jangan menyalin isi dokumen.",
            "Perbarui `last-verified` berkas yang tersentuh. Jangan mengubah kode.",
            "",
        ]
        for finding in drift_findings:
            lines.append(f"## Aturan {finding['rule']}")
            lines.append(f"- Berkas kode berubah: {', '.join(finding['code'])}")
            lines.append(f"- Dokumen wajib diperbarui: {', '.join(finding['require'])}")
            lines.append("")
        if not drift_findings:
            lines.append("Tidak ada drift yang terdeteksi.")
        guard_out("\n".join(lines))

    if json_mode:
        guard_out(json.dumps(report, indent=4, ensure_ascii=False))

    if "--count" in flags:
        guard_out(str(len(report["findings"])))

    if summary:
        if not report["findings"]:
            guard_out("| Pemeriksaan | Hasil |")
            guard_out("| --- | --- |")
            guard_out("| Dokumentasi | bersih |")
        else:
            guard_out("### Temuan Dokumentasi")
            guard_out("")
            guard_out("| Jenis | Berkas / Aturan | Keterangan |")
            guard_out("| --- | --- | --- |")
            for finding in report["findings"]:
                if isinstance(finding, dict):
                    req = ", ".join(str(item) for item in finding.get("require", []))
                    guard_out(f"| drift | {finding.get('rule', '-')} | wajib perbarui: {req} |")
                else:
                    guard_out(f"| *. | - | {finding} |")

    if not json_mode and not quiet:
        guard_out("")
        if exit_code == 0:
            guard_out("Guard dokumentasi: bersih.")
        else:
            prefix = "STRICT " if strict else ""
            guard_out(f"{prefix}Guard dokumentasi: {len(report['findings'])} temuan.")

    return exit_code


if __name__ == "__main__":
    raise SystemExit(guard_main())
