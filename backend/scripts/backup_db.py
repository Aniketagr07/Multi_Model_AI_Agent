#!/usr/bin/env python3
"""
OmniAI Database Backup Utility
Performs an online, non-blocking backup of the SQLite database using SQLite's native backup API.
Safe to run while OmniAI is processing concurrent read and write operations in WAL mode.
"""

import os
import sys
import sqlite3
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

# Ensure backend root is on Python sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.config import get_settings
from app.db.database import get_db_path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("db_backup")


def perform_backup(
    custom_dest_path: Optional[Path] = None,
    backup_dir: Optional[Path] = None,
    retention_count: int = 10,
) -> Path:
    """
    Executes an atomic online SQLite backup to a timestamped file.

    :param custom_dest_path: Explicit target file path (optional).
    :param backup_dir: Target folder for backups (defaults to data/backups).
    :param retention_count: Number of historical backup files to preserve.
    :return: Path to the generated backup file.
    """
    db_source_path = get_db_path()
    if not db_source_path.exists():
        raise FileNotFoundError(f"Database source file not found at: {db_source_path}")

    if custom_dest_path:
        dest_file = custom_dest_path
        dest_file.parent.mkdir(parents=True, exist_ok=True)
    else:
        if not backup_dir:
            backup_dir = db_source_path.parent / "backups"
        backup_dir.mkdir(parents=True, exist_ok=True)

        timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
        dest_file = backup_dir / f"omniai_backup_{timestamp_str}.db"

    logger.info("Initiating SQLite online backup: '%s' -> '%s'...", db_source_path, dest_file)

    # Perform online backup using SQLite backup API
    src_conn = sqlite3.connect(str(db_source_path), timeout=30.0)
    dest_conn = sqlite3.connect(str(dest_file), timeout=30.0)

    try:
        src_conn.backup(dest_conn, pages=250)
        logger.info("Backup data streaming completed successfully.")
    finally:
        dest_conn.close()
        src_conn.close()

    # Verify backup integrity
    verify_conn = sqlite3.connect(str(dest_file), timeout=10.0)
    try:
        cursor = verify_conn.execute("PRAGMA integrity_check;")
        result = cursor.fetchone()[0]
        if result != "ok":
            dest_file.unlink(missing_ok=True)
            raise RuntimeError(f"Backup verification failed with status: {result}")
        logger.info("Integrity check passed ('%s').", result)
    finally:
        verify_conn.close()

    # Enforce retention policy if writing to backup directory
    if not custom_dest_path and backup_dir and retention_count > 0:
        backups = sorted(
            [f for f in backup_dir.glob("omniai_backup_*.db") if f.is_file()],
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        if len(backups) > retention_count:
            for old_backup in backups[retention_count:]:
                logger.info("Pruning old backup: '%s'", old_backup.name)
                old_backup.unlink(missing_ok=True)

    logger.info("Backup successfully created at: %s", dest_file)
    return dest_file


if __name__ == "__main__":
    try:
        created_backup = perform_backup()
        print(f"SUCCESS: {created_backup}")
        sys.exit(0)
    except Exception as e:
        logger.error("Database backup failed: %s", e, exc_info=True)
        sys.exit(1)

