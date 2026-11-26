"""Runner verifikasi lokal tunggal RiceGuard (lint, tes, docs-guard, build web).

Pemakaian:
  python scripts/ci-check.py
  python scripts/ci-check.py --with-api
  python scripts/ci-check.py --with-drift
  python scripts/ci-check.py --ruff-only
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

_RUFF_TARGETS = ["packages/riceguard_calc", "apps/api", "scripts"]


def _root() -> Path:
    return Path(__file__).resolve().parent.parent


def _resolve_ruff_command() -> list[str] | None:
    ruff_bin = shutil.which("ruff")
    if ruff_bin:
        return [ruff_bin, "check", *_RUFF_TARGETS]
    probe = subprocess.run(
        [sys.executable, "-m", "ruff", "--version"],
        capture_output=True,
        text=True,
        check=False,
    )
    if probe.returncode == 0:
        return [sys.executable, "-m", "ruff", "check", *_RUFF_TARGETS]
    uvx_bin = shutil.which("uvx")
    if uvx_bin:
        return [uvx_bin, "ruff", "check", *_RUFF_TARGETS]
    return None


def _resolve_npm_command() -> str | None:
    return shutil.which("npm.cmd") or shutil.which("npm")


def _run_step(label: str, cmd: list[str], env: dict[str, str] | None = None) -> int:
    sys.stdout.write(f"==> {label}\n")
    sys.stdout.flush()
    proc = subprocess.run(cmd, cwd=_root(), env=env, check=False)
    if proc.returncode != 0:
        sys.stderr.write(f"FAIL {label} (exit {proc.returncode})\n")
        return proc.returncode
    sys.stdout.write(f"OK   {label}\n")
    return 0


def main(argv: list[str] | None = None) -> int:
    args = set(sys.argv[1:] if argv is None else argv)

    ruff_cmd = _resolve_ruff_command()
    if ruff_cmd is None:
        sys.stderr.write("ruff maupun uvx tidak ditemukan di lingkungan ini.\n")
        return 1

    if "--ruff-only" in args:
        return _run_step("Ruff lint Python", ruff_cmd)

    npm_bin = _resolve_npm_command()
    if npm_bin is None:
        sys.stderr.write("npm tidak ditemukan di PATH.\n")
        return 1

    steps: list[tuple[str, list[str], dict[str, str] | None]] = [
        ("Ruff lint Python", ruff_cmd, None),
        (
            "Pytest calc & dataset",
            [sys.executable, "-m", "pytest", "packages/riceguard_calc/tests", "dataset/tests", "-q"],
            None,
        ),
        (
            "Docs guard (links, refs, readability, harness)",
            [
                sys.executable,
                "scripts/docs-guard.py",
                "--check-links",
                "--check-refs",
                "--check-readability",
                "--check-harness",
            ],
            None,
        ),
        ("Web lint (oxlint)", [npm_bin, "run", "lint", "--workspace", "apps/web"], None),
        ("Web build (tsc & vite)", [npm_bin, "run", "build", "--workspace", "apps/web"], None),
    ]

    if "--with-drift" in args:
        steps.append(("Docs drift (pending)", [sys.executable, "scripts/docs-guard.py", "--drift", "--pending"], None))

    database_url = os.environ.get("DATABASE_URL", "").strip()
    if "--with-api" in args or database_url != "":
        api_env = os.environ.copy()
        api_dir = str(_root() / "apps" / "api")
        existing_pythonpath = api_env.get("PYTHONPATH", "").strip()
        api_env["PYTHONPATH"] = f"{api_dir}{os.pathsep}{existing_pythonpath}" if existing_pythonpath else api_dir
        steps.append(("Pytest API", [sys.executable, "-m", "pytest", "apps/api/tests", "-q"], api_env))

    for label, cmd, env in steps:
        code = _run_step(label, cmd, env=env)
        if code != 0:
            return code

    sys.stdout.write("\nSemua pemeriksaan ci:check lulus.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
