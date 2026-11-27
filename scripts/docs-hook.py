"""Dispatcher hook dokumentasi RiceGuard.

Satu implementasi, empat kontrak: Antigravity, Claude Code, Codex, dan
OpenCode memanggil subcommand yang sama; bentuk masuk dan keluaran
disesuaikan otomatis dari ciri payload masing-masing.

Pemakaian:
  python scripts/docs-hook.py preflight [--agent=auto|antigravity|claude|codex|opencode]
  python scripts/docs-hook.py gate      [--agent=...]
  python scripts/docs-hook.py stop      [--agent=...]

Sumber keluaran:
  Antigravity : JSON di stdout (injectSteps / decision)
  Claude Code : JSON hookSpecificOutput di stdout, keluar 0
  Codex       : kontrak keluaran sama dengan Claude Code
  OpenCode    : teks di stdout; keluar 2 saat menolak (plugin melempar galat)
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

DOCS_HOOK_MAX_NAG = 3
DOCS_HOOK_STATE_PREFIX = "docs-hook-"


def _configure_stdio() -> None:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(encoding="utf-8", errors="replace")


def hook_input() -> dict[str, Any]:
    if sys.stdin is None or sys.stdin.isatty():
        return {}
    raw = sys.stdin.read()
    if not raw or not raw.strip():
        return {}
    try:
        decoded = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return decoded if isinstance(decoded, dict) else {}


def hook_agent(data: dict[str, Any], forced: str) -> str:
    if forced != "auto":
        return forced
    if "conversationId" in data or "workspacePaths" in data:
        return "antigravity"
    if "turn_id" in data:
        return "codex"
    if "hook_event_name" in data or "session_id" in data:
        return "claude"
    return "generic"


def hook_agent_is_json(agent: str) -> bool:
    return agent in ("claude", "codex")


def hook_event_name(data: dict[str, Any]) -> str | None:
    name = data.get("hook_event_name")
    return name if isinstance(name, str) and name != "" else None


def hook_options(argv: list[str]) -> dict[str, str]:
    options = {"agent": "auto"}
    for argument in argv[2:]:
        if argument.startswith("--agent="):
            options["agent"] = argument[8:]
    return options


def hook_json(payload: dict[str, Any]) -> None:
    sys.stdout.write(f"{json.dumps(payload, ensure_ascii=False)}\n")


def hook_text(text: str) -> None:
    sys.stdout.write(f"{text}\n")


def hook_preflight_message() -> str:
    return "\n".join(
        [
            "Dokumen RiceGuard — baca sebelum bertindak.",
            "",
            "Langkah wajib:",
            "1. Baca docs/INDEX.md bagian 1, tentukan berkas yang relevan dengan tugas ini.",
            "2. Baca berkas itu sebelum Write/Edit/run_command pertama.",
            "3. Setelah mengubah kode, selaraskan dokumen pendamping pada siklus yang sama.",
            "",
            "Peta kode -> dokumen (docs-map.json):",
            "- apps/api/app/{routers,schemas}/** -> docs/api/endpoints-*.md, docs/api/README.md",
            "- apps/api/app/db/**, supabase/migrations/** -> docs/DOMAIN_MODEL.md",
            "- apps/api/app/core/security.py, services/{audit,versions,ingest}.py -> docs/ROLES_WORKFLOW.md",
            "- packages/riceguard_calc/**, services/{compute,pdf,forecast,exports,trends,recommendations}.py, config, Dockerfile, .env.example -> docs/ARCHITECTURE.md",
            "- apps/web/src/{components,features,lib}/** -> docs/KAMUS_KOSAKATA.md",
            "- package.json, pyproject.toml, ruff.toml, .github/workflows/**, scripts/{docs-*,ci-check}.py -> docs/RULES.md",
            "- AGENTS.md, CLAUDE.md, llms.txt, opencode.json, docs-map.json, .{agents,claude,codex,opencode}/** -> docs/INDEX.md",
            "",
            "Akhiri balasan dengan:",
            "[Docs Consulted: <path>]",
            "[Docs Updated: <path> | None needed — <alasan>]",
        ]
    )


def hook_drift() -> dict[str, Any]:
    guard = Path(__file__).resolve().with_name("docs-guard.py")
    if not guard.is_file():
        return {"blocked": False, "reason": ""}

    proc = subprocess.run(
        [sys.executable, str(guard), "--drift", "--pending", "--json", "--quiet"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if proc.returncode == 0:
        return {"blocked": False, "reason": ""}

    try:
        decoded = json.loads(proc.stdout)
    except json.JSONDecodeError:
        # Menolak aksi karena galat tak terduga akan membekukan agen; biarkan CI menegakkan.
        return {"blocked": False, "reason": ""}

    if not isinstance(decoded, dict) or not decoded.get("findings"):
        return {"blocked": False, "reason": ""}

    parts: list[str] = []
    for finding in decoded["findings"]:
        if not isinstance(finding, dict):
            continue
        require = finding.get("require") if isinstance(finding.get("require"), list) else []
        code_files = finding.get("code") if isinstance(finding.get("code"), list) else []
        parts.append(
            f"kode {', '.join(str(c) for c in code_files[:3])} -> wajib perbarui {', '.join(str(r) for r in require)}"
        )

    if not parts:
        return {"blocked": False, "reason": ""}

    return {
        "blocked": True,
        "reason": f"Drift dokumen: {'; '.join(parts)}. Perbarui dokumen itu pada siklus ini, lalu ulangi aksi.",
    }


def hook_state_path(key: str) -> Path:
    safe = re.sub(r"[^A-Za-z0-9_-]", "", key) or "default"
    return Path(tempfile.gettempdir()) / f"{DOCS_HOOK_STATE_PREFIX}{safe}.json"


def hook_state_read(key: str) -> int:
    path = hook_state_path(key)
    if not path.is_file():
        return 0
    try:
        decoded = json.loads(path.read_text(encoding="utf-8", errors="replace"))
    except json.JSONDecodeError:
        return 0
    if isinstance(decoded, dict) and "nag" in decoded:
        try:
            return int(decoded["nag"])
        except (TypeError, ValueError):
            return 0
    return 0


def hook_state_write(key: str, nag: int) -> None:
    hook_state_path(key).write_text(json.dumps({"nag": nag}), encoding="utf-8")


def hook_state_clear(key: str) -> None:
    path = hook_state_path(key)
    if path.is_file():
        path.unlink()


def hook_conversation_key(data: dict[str, Any], agent: str) -> str:
    for candidate in ("conversationId", "session_id", "sessionID"):
        value = data.get(candidate)
        if isinstance(value, str) and value != "":
            return f"{agent}-{value}"
    return f"{agent}-default"


def hook_is_editing_doc(data: dict[str, Any]) -> bool:
    tool_input = data.get("tool_input") if isinstance(data.get("tool_input"), dict) else {}
    target = (
        tool_input.get("file_path")
        or tool_input.get("path")
        or tool_input.get("Path")
        or tool_input.get("TargetFile")
        or data.get("filePath")
        or data.get("path")
        or ""
    )
    if not isinstance(target, str) or target == "":
        return False
    normalized = target.replace("\\", "/")
    return (
        "docs/" in normalized
        or normalized.endswith(".md")
        or normalized.endswith("docs-map.json")
        or normalized.endswith("llms.txt")
    )


def hook_run(event: str, argv: list[str] | None = None) -> int:
    _configure_stdio()
    args = sys.argv if argv is None else argv
    options = hook_options(args)
    skip_stdin = options["agent"] == "opencode" or (
        event == "preflight" and options["agent"] in ("antigravity", "opencode", "generic")
    )
    data = {} if skip_stdin else hook_input()
    agent = hook_agent(data, options["agent"])
    key = hook_conversation_key(data, agent)
    hook_event = hook_event_name(data)

    if event == "preflight":
        message = hook_preflight_message()
        if agent == "antigravity":
            hook_json({"injectSteps": [{"ephemeralMessage": message}]})
            return 0
        if hook_agent_is_json(agent):
            hook_json(
                {
                    "hookSpecificOutput": {
                        "hookEventName": hook_event or "UserPromptSubmit",
                        "additionalContext": message,
                    }
                }
            )
            return 0
        hook_text(message)
        return 0

    if event == "gate":
        if hook_is_editing_doc(data):
            if agent == "antigravity":
                hook_json({"decision": "allow"})
            return 0

        drift = hook_drift()
        if not drift["blocked"]:
            hook_state_clear(key)
            if agent == "antigravity":
                hook_json({"decision": "allow"})
            return 0

        if agent == "antigravity":
            hook_json({"decision": "deny", "reason": drift["reason"]})
            return 0

        if hook_agent_is_json(agent):
            hook_json(
                {
                    "hookSpecificOutput": {
                        "hookEventName": hook_event or "PreToolUse",
                        "permissionDecision": "deny",
                        "permissionDecisionReason": drift["reason"],
                    }
                }
            )
            return 0

        # OpenCode: plugin memanggil skrip ini dan melempar galat saat kode 2.
        hook_text(drift["reason"])
        return 2

    if event == "stop":
        drift = hook_drift()
        if not drift["blocked"]:
            hook_state_clear(key)
            if agent == "antigravity":
                hook_json({})
            return 0

        nag = hook_state_read(key)
        if nag >= DOCS_HOOK_MAX_NAG:
            hook_state_clear(key)
            message = f"{drift['reason']} Anggaran penahanan habis; lanjutkan dan biarkan CI menegakkan."
            if agent == "antigravity":
                hook_json({"decision": "allow", "reason": message})
                return 0
            hook_text(message)
            return 0

        hook_state_write(key, nag + 1)
        message = f"{drift['reason']} (penahanan {nag + 1}/{DOCS_HOOK_MAX_NAG})"
        if agent == "antigravity":
            hook_json({"decision": "continue", "reason": message})
            return 0
        if hook_agent_is_json(agent):
            hook_json({"decision": "block", "reason": message})
            return 0
        hook_text(message)
        return 0

    sys.stderr.write(f"Subcommand tidak dikenal: {event}\n")
    return 2


def main(argv: list[str] | None = None) -> int:
    args = sys.argv if argv is None else argv
    event = args[1] if len(args) > 1 else ""
    if event not in ("preflight", "gate", "stop"):
        sys.stderr.write(
            "Pemakaian: python scripts/docs-hook.py <preflight|gate|stop> [--agent=auto|antigravity|claude|codex|opencode]\n"
        )
        return 2
    return hook_run(event, args)


if __name__ == "__main__":
    raise SystemExit(main())
