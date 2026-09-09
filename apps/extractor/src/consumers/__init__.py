"""Queue consumers package for apps/extractor."""

from .parser_consumer import create_parser_worker

__all__ = ["create_parser_worker"]
