from abc import ABC, abstractmethod
from pathlib import Path

import pymupdf

from ...schemas.parsing import ParsedDocument


class BaseParsingStrategy(ABC):
    """Abstract base class for all tier-based PDF parsing strategies."""

    @abstractmethod
    async def parse(
        self,
        doc: pymupdf.Document,
        pdf_path: Path,
        work_dir: Path,
    ) -> ParsedDocument:
        """Parses the PDF document and returns a structured ParsedDocument."""
        pass
