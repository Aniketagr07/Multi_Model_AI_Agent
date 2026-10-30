import os
import tempfile
from pathlib import Path
import pytest

# Ensure all automated test runs use an isolated test database
_test_db_dir = Path(__file__).resolve().parent.parent / "data"
_test_db_dir.mkdir(parents=True, exist_ok=True)
_test_db_file = _test_db_dir / "test_runner.db"

os.environ["SQLITE_DB_PATH"] = str(_test_db_file)
os.environ["APP_ENV"] = "test"

from app.db import database
from app.core.config import get_settings

# Invalidate cached settings so new env is loaded
get_settings.cache_clear()
database._db_initialized = False
database.init_db()


@pytest.fixture(scope="session", autouse=True)
def cleanup_test_db():
    """Session fixture initializing test DB and cleaning it up after pytest finishes."""
    yield
    # Cleanup test db
    try:
        if _test_db_file.exists():
            _test_db_file.unlink(missing_ok=True)
    except Exception:
        pass
