#!/usr/bin/env python3
"""Sync infra/workspaces.json -> Postgres `workspaces` table (the registry mirror that
Chat / ad-hoc SQL read). Source of truth is the JSON; this just upserts it.

Two modes:
  1. Direct (default): connects to Postgres and upserts. Needs psycopg2 + a DSN.
     DSN resolution order: $SENTINEL_PG_DSN, then infra/.env (PG_HOST/PG_PORT/PG_DB/
     PG_USER/PG_PASSWORD), defaulting to host 127.0.0.1:5433 db/user `sentinel`.
  2. --emit-sql: prints idempotent SQL (TRUNCATE-free upserts) to stdout instead of
     connecting — paste into the `Sentinel · DB Test` PG node, or pipe to psql. Use this
     when running off-host (no direct Postgres reach).

Run after the schema DDL in infra/schema.sql has created the `workspaces` table.
"""
import json, os, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REG = ROOT / "workspaces.json"


def load_rows():
    reg = json.loads(REG.read_text())
    rows = []
    # ClickUp spaces
    for sp in reg.get("clickup", {}).get("spaces", []):
        rows.append({
            "id": str(sp["id"]),
            "kind": "clickup_space",
            "org": sp.get("org"),
            "name": sp.get("name"),
            "cadence": sp.get("cadence"),
            "depth": sp.get("depth"),
            "config": sp,
        })
    # Slack channels
    slack = reg.get("slack", {})
    default_tier = slack.get("default_tier", "daily")
    for ch in slack.get("channels", []):
        rows.append({
            "id": "slack:" + ch["name"],
            "kind": "slack_channel",
            "org": ch.get("org"),
            "name": ch["name"],
            "cadence": ch.get("tier", default_tier),
            "depth": "summary",
            "config": ch,
        })
    # Gmail rule (single config row; per-account tiering lives in `config`)
    gm = reg.get("gmail")
    if gm:
        rows.append({
            "id": "gmail:rules",
            "kind": "gmail_rule",
            "org": None,
            "name": "gmail-tiering",
            "cadence": gm.get("default_tier", "daily"),
            "depth": "summary",
            "config": gm,
        })
    return rows


UPSERT = """INSERT INTO workspaces (id, kind, org, name, cadence, depth, config, updated_at)
VALUES (%(id)s, %(kind)s, %(org)s, %(name)s, %(cadence)s, %(depth)s, %(config)s, now())
ON CONFLICT (id) DO UPDATE SET
  kind=EXCLUDED.kind, org=EXCLUDED.org, name=EXCLUDED.name,
  cadence=EXCLUDED.cadence, depth=EXCLUDED.depth, config=EXCLUDED.config, updated_at=now();"""


def sql_literal(v):
    if v is None:
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


def emit_sql(rows):
    out = []
    ids = ", ".join(sql_literal(r["id"]) for r in rows)
    # Drop registry rows that no longer exist in the JSON (e.g. removed Robust6G/WP6).
    out.append(f"DELETE FROM workspaces WHERE id NOT IN ({ids});")
    for r in rows:
        cfg = json.dumps(r["config"], ensure_ascii=False)
        out.append(
            "INSERT INTO workspaces (id, kind, org, name, cadence, depth, config, updated_at) VALUES ("
            + ", ".join([
                sql_literal(r["id"]), sql_literal(r["kind"]), sql_literal(r["org"]),
                sql_literal(r["name"]), sql_literal(r["cadence"]), sql_literal(r["depth"]),
                sql_literal(cfg) + "::jsonb", "now()",
            ])
            + ") ON CONFLICT (id) DO UPDATE SET kind=EXCLUDED.kind, org=EXCLUDED.org, "
            "name=EXCLUDED.name, cadence=EXCLUDED.cadence, depth=EXCLUDED.depth, "
            "config=EXCLUDED.config, updated_at=now();"
        )
    return "\n".join(out)


def read_env_dsn():
    if os.environ.get("SENTINEL_PG_DSN"):
        return os.environ["SENTINEL_PG_DSN"]
    env = {}
    envf = ROOT / ".env"
    if envf.exists():
        for line in envf.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    host = env.get("PG_HOST", "127.0.0.1")
    port = env.get("PG_PORT", "5433")
    db = env.get("PG_DB", "sentinel")
    user = env.get("PG_USER", "sentinel")
    pwd = env.get("PG_PASSWORD") or env.get("POSTGRES_PASSWORD") or ""
    return f"host={host} port={port} dbname={db} user={user} password={pwd}"


def main():
    rows = load_rows()
    if "--emit-sql" in sys.argv:
        print(emit_sql(rows))
        return
    try:
        import psycopg2
        from psycopg2.extras import Json
    except ImportError:
        sys.exit("psycopg2 not installed. Re-run with --emit-sql and pipe to psql / DB Test.")
    keep_ids = tuple(r["id"] for r in rows)
    with psycopg2.connect(read_env_dsn()) as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM workspaces WHERE NOT (id = ANY(%s))", (list(keep_ids),))
        for r in rows:
            r2 = dict(r, config=Json(r["config"]))
            cur.execute(UPSERT, r2)
    print(f"synced {len(rows)} workspace rows "
          f"({sum(r['kind']=='clickup_space' for r in rows)} clickup, "
          f"{sum(r['kind']=='slack_channel' for r in rows)} slack, "
          f"{sum(r['kind']=='gmail_rule' for r in rows)} gmail)")


if __name__ == "__main__":
    main()
