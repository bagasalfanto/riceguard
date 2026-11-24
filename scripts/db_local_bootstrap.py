"""Terapkan skema dan seed ke Postgres lokal.

Dipakai scripts/db-local.ps1 karena paket Postgres embedded tidak menyertakan psql.
Argumen: port, nama_database, path_file_sql.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import psycopg

NAMA_DATABASE_VALID = re.compile(r"^[a-z_][a-z0-9_]{0,62}$")


def main() -> int:
    port, database, sql_path = sys.argv[1], sys.argv[2], sys.argv[3]
    if not NAMA_DATABASE_VALID.match(database):
        print(f"nama database tidak valid: {database!r}")
        return 2
    if not port.isdigit():
        print(f"port tidak valid: {port!r}")
        return 2

    koneksi = f"host=127.0.0.1 port={port} user=postgres"
    sql = Path(sql_path).read_text(encoding="utf-8")

    with psycopg.connect(f"{koneksi} dbname=postgres", autocommit=True) as conn:
        ada = conn.execute("select 1 from pg_database where datname = %s", (database,)).fetchone()
        if ada is None:
            conn.execute(f'create database "{database}"')
            print(f"database {database} dibuat")

    with psycopg.connect(f"{koneksi} dbname={database}", autocommit=True) as conn:
        conn.execute(sql)

    with psycopg.connect(f"{koneksi} dbname={database}") as conn:
        provinsi = conn.execute("select count(*) from provinces").fetchone()[0]
        sumber = conn.execute("select count(*) from data_sources").fetchone()[0]
        konten = conn.execute("select count(*) from site_content").fetchone()[0]
    print(f"skema dan seed siap: {provinsi} provinsi, {sumber} sumber, {konten} blok konten")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
