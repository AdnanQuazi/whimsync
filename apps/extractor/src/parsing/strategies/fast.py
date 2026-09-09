import asyncio
from pathlib import Path

import pymupdf
import pymupdf4llm

from ...schemas.parsing import ParsedDocument, ParseTier
from ...utils.logger import get_logger
from ..link_injector import inject_links_inline
from .base import BaseParsingStrategy

logger = get_logger("fast_strategy")


class FastParsingStrategy(BaseParsingStrategy):
    """
    Fast Tier: Purely deterministic, high-throughput extraction using
    PyMuPDF4LLM with native OCR and inline link injection.
    """

    async def parse(
        self,
        doc: pymupdf.Document,
        pdf_path: Path,
        work_dir: Path,
    ) -> ParsedDocument:
        total_pages = len(doc)
        logger.info(
            f"[FastTier] Starting global markdown extraction for {pdf_path.name} ({total_pages} pages)"
        )

        def _extract():
            return pymupdf4llm.to_markdown(
                str(pdf_path),
                page_chunks=True,
                write_images=False,
                margins=(0, 50, 0, 50),
            )

        page_chunks = await asyncio.to_thread(_extract)

        final_pages: list[str] = []
        for page_num in range(total_pages):
            page_text = page_chunks[page_num]["text"] if page_num < len(page_chunks) else ""
            # Inject hyperlinks
            page = doc[page_num]
            enriched_text = inject_links_inline(page, page_text)
            final_pages.append(enriched_text.strip())

        full_markdown = "\n\n".join(part for part in final_pages if part)
        logger.info(
            f"[FastTier] Completed extraction for {pdf_path.name}: {len(full_markdown)} characters"
        )

        return ParsedDocument(
            markdown=full_markdown,
            total_pages=total_pages,
            tier_used=ParseTier.FAST,
            metadata={"strategy": "pymupdf4llm_fast"},
        )
