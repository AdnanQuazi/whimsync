import shutil
import tempfile
from collections.abc import Generator
from contextlib import contextmanager
from pathlib import Path

from .logger import get_logger

logger = get_logger("temp_manager")


@contextmanager
def TempDirectoryManager(prefix: str = "whimsync_") -> Generator[Path, None, None]:
    """
    Context manager that creates a dedicated temporary directory
    and guarantees complete cleanup upon exit.
    """
    temp_path = Path(tempfile.mkdtemp(prefix=prefix))
    try:
        yield temp_path
    finally:
        try:
            if temp_path.exists():
                shutil.rmtree(temp_path, ignore_errors=True)
        except Exception as e:
            logger.warning(f"Failed to cleanly delete temp directory {temp_path}: {e}")
