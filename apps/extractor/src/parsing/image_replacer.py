import re
from pathlib import Path

from ..services.vlm_service import vlm_service
from ..utils.logger import get_logger

logger = get_logger("image_replacer")

IMAGE_REGEX = re.compile(r"!\[(.*?)\]\((.*?)\)")


async def enrich_markdown_images(
    md_text: str,
    images_dir: Path,
) -> str:
    """
    Finds cropped image placeholders ![alt](path) in markdown text extracted from
    digital pages, submits them to Gemini VLM for chart/diagram analysis,
    and replaces the placeholder with rich structured Markdown.
    """
    if not vlm_service.is_available():
        return md_text

    matches = list(IMAGE_REGEX.finditer(md_text))
    if not matches:
        return md_text

    # Collect valid images to process
    tasks_to_run: list[tuple[str, Path]] = []
    for m in matches:
        raw_target = m.group(2).strip()
        # Resolve path: might be relative filename or full path
        img_path = Path(raw_target)
        if not img_path.is_absolute():
            img_path = images_dir / img_path.name

        if img_path.exists() and img_path.is_file():
            tasks_to_run.append((m.group(0), img_path))

    if not tasks_to_run:
        return md_text

    logger.info(f"Enriching {len(tasks_to_run)} embedded images in digital page via VLM...")

    # Process all embedded images concurrently
    async def _process_single(placeholder: str, path: Path) -> tuple[str, str]:
        desc = await vlm_service.process_image(path, prompt_type="embedded_image")
        return placeholder, desc

    import asyncio

    results = await asyncio.gather(*[_process_single(ph, p) for ph, p in tasks_to_run])

    # Replace placeholders with VLM descriptions
    enriched_text = md_text
    for placeholder, description in results:
        if description and description.strip():
            # Format nicely as a blockquote or embedded section
            formatted_desc = f"\n\n> **[Figure / Chart Analysis]**:\n> {description.strip().replace(chr(10), chr(10) + '> ')}\n\n"
            enriched_text = enriched_text.replace(placeholder, formatted_desc, 1)
        else:
            # Leave placeholder if VLM failed or returned empty
            pass

    return enriched_text
