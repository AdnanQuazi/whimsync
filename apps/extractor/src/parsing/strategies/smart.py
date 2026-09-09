import asyncio
from pathlib import Path

import pymupdf
import pymupdf4llm

from ...schemas.parsing import PageComplexity, ParsedDocument, ParseTier
from ...services.vlm_service import vlm_service
from ...utils.logger import get_logger
from ..complexity import analyze_page_complexity
from ..image_replacer import enrich_markdown_images
from ..link_injector import inject_links_inline
from .base import BaseParsingStrategy

logger = get_logger("smart_strategy")


class SmartParsingStrategy(BaseParsingStrategy):
    """
    Smart Tier: Multi-signal complexity analysis dynamically routes clean digital pages
    to PyMuPDF4LLM and complex/scanned/table-heavy pages to Gemini VLM.
    """

    async def parse(
        self,
        doc: pymupdf.Document,
        pdf_path: Path,
        work_dir: Path,
    ) -> ParsedDocument:
        total_pages = len(doc)
        logger.info(
            f"[SmartTier] Analyzing complexity across {total_pages} pages for {pdf_path.name}"
        )

        # 1. Analyze complexity for each page
        complexities: list[PageComplexity] = [
            analyze_page_complexity(doc[i], page_number=i) for i in range(total_pages)
        ]

        # 2. Determine VLM routing
        can_use_vlm = vlm_service.is_available()
        pages_to_vlm: list[int] = []

        for c in complexities:
            # Route to VLM if scanned full page image, garbled text, or complex vector grid table
            should_vlm = c.needs_ocr and (
                c.full_page_image
                or c.is_garbled
                or "vector-table" in c.reasons
                or "sparse-text" in c.reasons
            )
            if should_vlm and can_use_vlm:
                pages_to_vlm.append(c.page_number)
                logger.info(
                    f"[SmartTier] Page {c.page_number + 1} routed to VLM (reasons: {c.reasons})"
                )
            else:
                logger.info(
                    f"[SmartTier] Page {c.page_number + 1} routed to digital extraction (reasons: {c.reasons or 'clean'})"
                )

        # 3. Global extraction for digital pages (extracts embedded images for VLM enrichment)
        images_dir = work_dir / "images"
        images_dir.mkdir(parents=True, exist_ok=True)

        def _extract_digital():
            return pymupdf4llm.to_markdown(
                str(pdf_path),
                page_chunks=True,
                write_images=True,
                image_path=str(images_dir),
                image_format="png",
                margins=(0, 50, 0, 50),
            )

        digital_chunks = await asyncio.to_thread(_extract_digital)

        # 4. Asynchronously process full-page VLM pages in parallel
        scans_dir = work_dir / "scans"
        scans_dir.mkdir(parents=True, exist_ok=True)

        async def _process_vlm_page(page_idx: int) -> tuple[int, str]:
            page = doc[page_idx]
            # Render at 2.5x resolution (~180 DPI, balanced speed & OCR fidelity)
            pix = await asyncio.to_thread(page.get_pixmap, matrix=pymupdf.Matrix(2.5, 2.5))
            scan_img = scans_dir / f"page_{page_idx + 1}.png"
            await asyncio.to_thread(pix.save, str(scan_img))

            md_text = await vlm_service.process_image(scan_img, prompt_type="full_page_scan")
            return page_idx, md_text

        vlm_tasks = [_process_vlm_page(idx) for idx in pages_to_vlm]
        vlm_results = dict(await asyncio.gather(*vlm_tasks)) if vlm_tasks else {}

        # 5. Assemble ordered markdown and enrich digital pages
        assembled_pages: list[str] = []
        for i in range(total_pages):
            c = complexities[i]
            # If the page was flagged as completely empty, emit nothing
            if c.is_empty:
                logger.info(f"[SmartTier] Page {i + 1} is empty. Skipping.")
                continue

            if i in vlm_results and vlm_results[i].strip():
                # Full page was already parsed through VLM in layout context.
                # Skip parsing any cropped images from this page separately.
                page_md = vlm_results[i].strip()
                final_page_md = inject_links_inline(doc[i], page_md)
                assembled_pages.append(final_page_md)
            else:
                # Digital page:
                digital_text = digital_chunks[i]["text"] if i < len(digital_chunks) else ""
                # 1. Enrich embedded chart/diagram images via VLM first
                enriched_text = await enrich_markdown_images(digital_text, images_dir)
                # 2. Link injection as the ABSOLUTE LAST STEP
                final_page_md = inject_links_inline(doc[i], enriched_text)
                assembled_pages.append(final_page_md.strip())

        full_markdown = "\n\n".join(part for part in assembled_pages if part)
        logger.info(
            f"[SmartTier] Completed {pdf_path.name}: {len(full_markdown)} chars "
            f"({len(pages_to_vlm)} VLM pages, {total_pages - len(pages_to_vlm)} digital pages)"
        )

        return ParsedDocument(
            markdown=full_markdown,
            total_pages=total_pages,
            tier_used=ParseTier.SMART,
            metadata={
                "strategy": "hybrid_smart",
                "vlm_page_count": len(pages_to_vlm),
                "vlm_pages": pages_to_vlm,
            },
        )
