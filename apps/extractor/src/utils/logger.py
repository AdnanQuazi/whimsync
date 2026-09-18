import logging
import sys

_configured = False


def get_logger(name: str = "whimsync-extractor") -> logging.Logger:
    global _configured
    if not _configured:
        try:
            sys.stdout.reconfigure(line_buffering=True)
        except Exception:
            pass
        root_logger = logging.getLogger()
        root_logger.setLevel(logging.INFO)
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(logging.INFO)
        formatter = logging.Formatter(
            fmt="%(asctime)s [%(levelname)s] [%(name)s]: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        root_logger.handlers = [handler]
        _configured = True
    return logging.getLogger(name)
