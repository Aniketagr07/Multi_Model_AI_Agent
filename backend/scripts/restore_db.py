#!/usr/bin/env python3
"""
OmniAI Database Restore Utility
Restores the active SQLite database from a specified backup snapshot or the latest available backup.
Performs pre-restore integrity verification and preserves a safety rollback snapshot.
"""

import os
import sys
import shutil
import sqlite3
import logging
from pathlib import Path
from typing import Optional

# Ensure backend root is on Python sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.config import get_settings
from app.db.database import get_db_path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("db_restore")


def perform_restore(backup_file_path: Optional[Path] = None) -> Path:
    """
    Restores the SQLite database from a validated backup file.

    :param backup_file_path: Explicit path to the backup file to restore.
    :return: Path to the restored database file.
    """
    target_db_path = get_db_path()
    backup_dir = target_db_path.parent / "backups"

    if backup_file_path is None:
        if not backup_dir.exists():
            raise FileNotFoundError(f"No backups directory found at: {backup_dir}")
        backups = sorted(
            [f for f in backup_dir.glob("omniai_backup_*.db") if f.is_file()],
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        if not backups:
            raise FileNotFoundError(f"No valid backup files found in: {backup_dir}")
        backup_file_path = backups[0]

    backup_file_path = Path(backup_file_path).resolve()
    if not backup_file_path.exists():
        raise FileNotFoundError(f"Specified backup file not found: {backup_file_path}")

    logger.info("Validating backup file integrity: '%s'...", backup_file_path)
    verify_conn = sqlite3.connect(str(backup_file_path), timeout=10.0)
    try:
        res = verify_conn.execute("PRAGMA integrity_check;").fetchone()[0]
        if res != "ok":
            raise RuntimeError(f"Backup file failed integrity check: {res}")
        logger.info("Backup integrity check passed.")
    finally:
        verify_conn.close()

    # Safety snapshot of current database if it exists
    if target_db_path.exists():
        safety_snapshot = target_db_path.parent / "omniai_pre_restore.bak"
        logger.info("Creating pre-restore safety snapshot at: '%s'...", safety_snapshot)
        shutil.copy2(target_db_path, safety_snapshot)

    # Use SQLite online backup API to copy from backup file into target database
    logger.info("Restoring data: '%s' -> '%s'...", backup_file_path, target_db_path)
    src_conn = sqlite3.connect(str(backup_file_path), timeout=30.0)
    dest_conn = sqlite3.connect(str(target_db_path), timeout=30.0)

    try:
        src_conn.backup(dest_conn, pages=250)
        logger.info("Restore stream completed.")
    finally:
        dest_conn.close()
        src_conn.close()

    # Verify restored target database
    target_conn = sqlite3.connect(str(target_db_path), timeout=10.0)
    try:
        check = target_conn.execute("PRAGMA integrity_check;").fetchone()[0]
        if check != "ok":
            raise RuntimeError(f"Restored database integrity check failed: {check}")
        logger.info("Restored database integrity verified ('%s').", check)
    finally:
        target_conn.close()

    logger.info("Database restoration completed successfully.")
    return target_db_path


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    try:
        restored = perform_restore(target)
        print(f"SUCCESS: {restored}")
        sys.exit(0)
    except Exception as e:
        logger.error("Database restore failed: %s", e, exc_info=True)
        sys.exit(1)

