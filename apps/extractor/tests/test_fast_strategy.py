import tempfile
from pathlib import Path

import pymupdf
import pytest

from src.parsing.strategies.fast import FastParsingStrategy
from src.schemas.parsing import ParseTier


@pytest.mark.asyncio
async def test_fast_strategy_extracts_markdown():
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        pdf_path = temp_path / "sample.pdf"

        # Create a real 2-page PDF
        doc = pymupdf.open()
        p1 = doc.new_page(width=600, height=800)
        p1.insert_text(pymupdf.Point(50, 50), "# Whimsync Document Header", fontsize=18)
        p1.insert_text(pymupdf.Point(50, 90), "This is section one of the document.")

        p2 = doc.new_page(width=600, height=800)
        p2.insert_text(pymupdf.Point(50, 50), "## Second Section", fontsize=14)
        p2.insert_text(pymupdf.Point(50, 90), "This is section two with more content.")
        doc.save(str(pdf_path))
        doc.close()

        strategy = FastParsingStrategy()
        open_doc = pymupdf.open(str(pdf_path))
        try:
            result = await strategy.parse(open_doc, pdf_path, temp_path)
        finally:
            open_doc.close()

        assert result.tier_used == ParseTier.FAST
        assert result.total_pages == 2
        assert len(result.markdown) > 0
        assert "Whimsync" in result.markdown
