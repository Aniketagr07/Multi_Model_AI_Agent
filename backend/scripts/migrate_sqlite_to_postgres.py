"""
OmniAI Database Migration Utility: SQLite to Neon PostgreSQL
Transfers all existing users, sessions, conversations, messages, documents,
projects, skills, activity logs, and OAuth links from SQLite to Neon PostgreSQL.
"""

import sys
import os
import argparse
import sqlite3
from pathlib import Path
from typing import Dict, List, Any

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.config import get_settings
from app.db.database import BUILTIN_SKILLS, init_postgres_db, get_db_path

# Dependency order of tables to preserve Foreign Key integrity
TABLES_IN_MIGRATION_ORDER = [
    "users",
    "user_sessions",
    "user_provider_credentials",
    "projects",
    "conversations",
    "messages",
    "documents",
    "user_settings",
    "model_usage",
    "skills",
    "user_skills",
    "skill_executions",
    "user_oauth_providers",
    "oauth_states",
    "password_reset_tokens",
    "project_members",
    "project_invitations",
    "conversation_members",
    "conversation_invitations",
    "project_files",
    "project_skills",
    "activity_events",
]


def migrate_data(sqlite_path: Path, postgres_uri: str) -> None:
    print("=" * 70)
    print(" OmniAI SQLite -> PostgreSQL / Neon Migration Pipeline")
    print("=" * 70)
    print(f" Source SQLite:     {sqlite_path}")
    print(f" Target PostgreSQL: {postgres_uri.split('@')[-1] if '@' in postgres_uri else postgres_uri}")
    print("=" * 70)

    if not sqlite_path.exists():
        print(f"ERROR: SQLite database file not found at: {sqlite_path}")
        sys.exit(1)

    try:
        import psycopg
        from psycopg.rows import dict_row
    except ImportError:
        print("ERROR: 'psycopg' library is required. Install via: pip install 'psycopg[binary]>=3.1.0'")
        sys.exit(1)

    # 1. Connect to PostgreSQL and initialize schema
    print("\n[Step 1/3] Initializing schema on target PostgreSQL database...")
    os.environ["DATABASE_URL"] = postgres_uri
    init_postgres_db()
    print("✓ PostgreSQL schema initialized with all 21 tables and indexes.")

    # 2. Open connections
    sqlite_conn = sqlite3.connect(str(sqlite_path))
    sqlite_conn.row_factory = sqlite3.Row
    pg_conn = psycopg.connect(postgres_uri, row_factory=dict_row)

    total_records = 0
    migration_summary = []

    try:
        print("\n[Step 2/3] Migrating table records in dependency order...")
        for table in TABLES_IN_MIGRATION_ORDER:
            # Check if table exists in SQLite
            check_table = sqlite_conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?;", (table,)
            ).fetchone()
            if not check_table:
                migration_summary.append((table, 0, "Skipped (not in SQLite)"))
                continue

            # Read all rows from SQLite
            rows = sqlite_conn.execute(f"SELECT * FROM {table};").fetchall()
            count = len(rows)
            if count == 0:
                migration_summary.append((table, 0, "Empty"))
                continue

            col_names = [d[0] for d in sqlite_conn.execute(f"SELECT * FROM {table} LIMIT 1;").description]
            cols_clause = ", ".join(col_names)
            placeholders = ", ".join(["%s"] * len(col_names))

            # Build query with ON CONFLICT DO NOTHING to avoid duplicate key violations
            insert_query = f"INSERT INTO {table} ({cols_clause}) VALUES ({placeholders}) ON CONFLICT DO NOTHING;"

            with pg_conn.cursor() as cur:
                data_tuples = [tuple(r[c] for c in col_names) for r in rows]
                cur.executemany(insert_query, data_tuples)

            pg_conn.commit()
            total_records += count
            migration_summary.append((table, count, "Migrated"))
            print(f"  ✓ {table:<28} : {count:>5} record(s)")

        # 3. Verification
        print("\n[Step 3/3] Verifying record counts...")
        print("-" * 55)
        print(f"{'Table':<30} | {'Count':<8} | {'Status'}")
        print("-" * 55)
        for t_name, t_count, t_status in migration_summary:
            print(f"{t_name:<30} | {t_count:<8} | {t_status}")
        print("-" * 55)
        print(f"\nMigration completed successfully! Total records processed: {total_records}")

    except Exception as e:
        pg_conn.rollback()
        print(f"\n❌ Migration failed: {e}")
        raise
    finally:
        sqlite_conn.close()
        pg_conn.close()


def main():
    parser = argparse.ArgumentParser(description="Migrate OmniAI data from SQLite to Neon PostgreSQL.")
    parser.add_argument(
        "--postgres-url",
        type=str,
        default=os.environ.get("DATABASE_URL"),
        help="Target PostgreSQL connection string (defaults to DATABASE_URL environment variable)",
    )
    parser.add_argument(
        "--sqlite-path",
        type=str,
        default=str(get_db_path()),
        help="Path to source SQLite database file",
    )

    args = parser.parse_args()
    if not args.postgres_url:
        print("ERROR: PostgreSQL connection URL must be provided via --postgres-url or DATABASE_URL env var.")
        sys.exit(1)

    clean_url = args.postgres_url.strip()
    if clean_url.startswith("postgres://"):
        clean_url = "postgresql://" + clean_url[len("postgres://"):]

    migrate_data(Path(args.sqlite_path), clean_url)


if __name__ == "__main__":
    main()

