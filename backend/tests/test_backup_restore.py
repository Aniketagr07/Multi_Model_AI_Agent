import os
import sqlite3
import pytest
from pathlib import Path
from scripts.backup_db import perform_backup
from scripts.restore_db import perform_restore
from app.db.database import get_db_path, init_db


def test_backup_and_restore_cycle(tmp_path):
    """Test full backup and restore lifecycle with data verification."""
    init_db()
    db_path = get_db_path()

    # Insert a sentinel test record into user_settings
    conn = sqlite3.connect(str(db_path))
    conn.execute("INSERT OR REPLACE INTO user_settings (key, value, updated_at) VALUES ('test_backup_key', 'val_123', '2026-10-30T00:00:00Z');")
    conn.commit()
    conn.close()

    # Perform backup to a temporary directory
    backup_dir = tmp_path / "backups"
    backup_file = perform_backup(backup_dir=backup_dir, retention_count=3)
    assert backup_file.exists()
    assert backup_file.stat().st_size > 0

    # Modify the original database (change sentinel value)
    conn = sqlite3.connect(str(db_path))
    conn.execute("UPDATE user_settings SET value = 'corrupted_or_changed' WHERE key = 'test_backup_key';")
    conn.commit()
    conn.close()

    # Verify that the value is changed
    conn = sqlite3.connect(str(db_path))
    curr_val = conn.execute("SELECT value FROM user_settings WHERE key = 'test_backup_key';").fetchone()[0]
    assert curr_val == "corrupted_or_changed"
    conn.close()

    # Now restore from the backup file
    restored_path = perform_restore(backup_file_path=backup_file)
    assert restored_path.exists()

    # Verify that the sentinel record has been restored to 'val_123'
    conn = sqlite3.connect(str(db_path))
    restored_val = conn.execute("SELECT value FROM user_settings WHERE key = 'test_backup_key';").fetchone()[0]
    assert restored_val == "val_123"
    conn.close()
