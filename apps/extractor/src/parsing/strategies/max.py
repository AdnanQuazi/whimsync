import asyncio
from pathlib import Path

import pymupdf
import pymupdf4llm

from ...schemas.parsing import PageComplexity, ParsedDocument, ParseTier
from ...services.vlm_service import vlm_service
from ...utils.logger import get_logger
from ..complexity import analyze_page_complexity
from ..link_injector import inject_links_inline
from .base import BaseParsingStrategy

logger = get_logger("max_strategy")


class MaxParsingStrategy(BaseParsingStrategy):
    """
    Max Tier: Vision-dominant layout parsing. Dispatches all non-trivial pages to
    Gemini VLM. Only purely digital text pages (0 images, 0 drawings) or completely
    empty pages bypass VLM.
    """

    async def parse(
        self,
        doc: pymupdf.Document,
        pdf_path: Path,
        work_dir: Path,
    ) -> ParsedDocument:
        total_pages = len(doc)
        logger.info(
            f"[MaxTier] Executing vision-first extraction for {pdf_path.name} ({total_pages} pages)"
        )

        can_use_vlm = vlm_service.is_available()
        if not can_use_vlm:
            logger.warning(
                "[MaxTier] VLM is unavailable (no API key). Falling back to digital extraction."
            )

        pages_to_vlm: list[int] = []
        complexities: list[PageComplexity] = []

        for i in range(total_pages):
            page = doc[i]
            c = analyze_page_complexity(page, page_number=i)
            complexities.append(c)

            # Bypass criteria:
            # 1. Completely blank page
            if c.is_empty:
                logger.info(f"[MaxTier] Page {i + 1} is empty. Skipping VLM.")
                continue

            # 2. Purely digital text with ZERO images and ZERO vector graphics
            is_pure_digital = (
                c.image_coverage == 0
                and c.vg_coverage == 0
                and not c.is_garbled
                and c.text_length > 50
                and c.text_coverage > 0.10
            )

            if is_pure_digital or not can_use_vlm:
                logger.info(f"[MaxTier] Page {i + 1} is pure digital text. Extracting natively.")
            else:
                pages_to_vlm.append(i)
                logger.info(
                    f"[MaxTier] Page {i + 1} routed to VLM (img_cov={c.image_coverage}, vg_cov={c.vg_coverage})"
                )

        # Global extraction for fallback and pure digital pages
        def _extract_digital():
            return pymupdf4llm.to_markdown(
                str(pdf_path),
                page_chunks=True,
                write_images=False,
                margins=(0, 50, 0, 50),
            )

        digital_chunks = await asyncio.to_thread(_extract_digital)

        # Asynchronously process VLM pages in parallel
        scans_dir = work_dir / "max_scans"
        scans_dir.mkdir(parents=True, exist_ok=True)

        async def _process_vlm_page(page_idx: int) -> tuple[int, str]:
            page = doc[page_idx]
            pix = await asyncio.to_thread(page.get_pixmap, matrix=pymupdf.Matrix(2.5, 2.5))
            scan_img = scans_dir / f"page_{page_idx + 1}.png"
            await asyncio.to_thread(pix.save, str(scan_img))

            md_text = await vlm_service.process_image(scan_img, prompt_type="full_page_scan")
            return page_idx, md_text

        vlm_tasks = [_process_vlm_page(idx) for idx in pages_to_vlm]
        vlm_results = dict(await asyncio.gather(*vlm_tasks)) if vlm_tasks else {}

        # Assemble pages
        assembled_pages: list[str] = []
        for i in range(total_pages):
            if i in vlm_results and vlm_results[i].strip():
                page_md = vlm_results[i].strip()
                final_page_md = inject_links_inline(doc[i], page_md)
                assembled_pages.append(final_page_md)
            else:
                digital_text = digital_chunks[i]["text"] if i < len(digital_chunks) else ""
                final_page_md = inject_links_inline(doc[i], digital_text)
                assembled_pages.append(final_page_md.strip())

        full_markdown = "\n\n".join(part for part in assembled_pages if part)
        logger.info(
            f"[MaxTier] Completed {pdf_path.name}: {len(full_markdown)} chars "
            f"({len(pages_to_vlm)} VLM pages, {total_pages - len(pages_to_vlm)} digital pages)"
        )

        return ParsedDocument(
            markdown=full_markdown,
            total_pages=total_pages,
            tier_used=ParseTier.MAX,
            metadata={
                "strategy": "vision_dominant_max",
                "vlm_page_count": len(pages_to_vlm),
                "vlm_pages": pages_to_vlm,
            },
        )
