import asyncio
import os
from pathlib import Path

from PIL import Image

from ..config import settings
from ..utils.logger import get_logger

logger = get_logger("vlm_service")

FULL_PAGE_SCAN_PROMPT = """
<role>You are an expert OCR and document layout parser.</role>
<task>Extract all text from this scanned document page and format it into clean, high-fidelity Markdown.</task>
<instructions>
    <step>Preserve the semantic structure: use appropriate Markdown headings (#, ##, ###).</step>
    <step>Do not include any introductory or conversational remarks (like "Here is the extracted markdown"). Only output the extracted markdown text.</step>
    <step>Maintain reading order accurately.</step>
</instructions>
<CRITICAL_TABLE_RULES>
    <rule>If you detect tabular data (such as financial tables, invoices, grids, or mark sheets), format it strictly as a GitHub-Flavored Markdown table.</rule>
    <rule>Every single table row MUST begin and end with a pipe symbol (|).</rule>
    <rule>The header row MUST be immediately followed by a separator row (e.g., |---|---|---).</rule>
    <rule>Never merge cells in a way that breaks table parsing. Fill empty cells with whitespace or dashes.</rule>
</CRITICAL_TABLE_RULES>
"""

DEFAULT_IMAGE_PROMPT = """
<role>You are an expert visual document and chart analyst.</role>
<task>Extract and describe all information from this image into clean, structured Markdown.</task>
<instructions>
    <step>If this is a chart, graph, or plot: extract all data points, axes, labels, values, and trends into a GitHub-Flavored Markdown table, followed by a concise bulleted summary.</step>
    <step>If this is a diagram or flowchart: describe the processes, nodes, steps, and relationships in clean hierarchical Markdown.</step>
    <step>If this image contains text or numbers: transcribe all visible content with high precision.</step>
    <step>Do not include conversational filler (e.g. "Here is the extracted information"). Output directly in Markdown.</step>
</instructions>
"""


class VLMService:
    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        concurrency: int | None = None,
        delay_seconds: float | None = None,
        max_retries: int | None = None,
    ):
        self.api_key = api_key or settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
        self.model = model or settings.GEMINI_MODEL
        self.delay_seconds = (
            delay_seconds if delay_seconds is not None else settings.VLM_DELAY_SECONDS
        )
        self.max_retries = max_retries if max_retries is not None else settings.VLM_MAX_RETRIES
        self._semaphore = asyncio.Semaphore(concurrency or settings.VLM_CONCURRENCY)
        self._client = None

    def _get_client(self):
        if self._client is None:
            if not self.api_key:
                raise ValueError("GEMINI_API_KEY is not configured. VLM processing is unavailable.")
            from google import genai

            self._client = genai.Client(api_key=self.api_key)
        return self._client

    def is_available(self) -> bool:
        return bool(self.api_key)

    async def process_image(self, image_path: Path, prompt_type: str = "full_page_scan") -> str:
        """
        Sends an image to Gemini VLM with concurrency control, pacing delay,
        and automatic exponential backoff on 429 rate limits.
        """
        if not self.is_available():
            logger.warning(
                "VLM is requested but GEMINI_API_KEY is not set. Skipping VLM extraction."
            )
            return ""

        prompt = FULL_PAGE_SCAN_PROMPT if prompt_type == "full_page_scan" else DEFAULT_IMAGE_PROMPT

        async with self._semaphore:

            def _sync_generate() -> str:
                client = self._get_client()
                with Image.open(image_path) as img:
                    response = client.models.generate_content(
                        model=self.model,
                        contents=[prompt, img],
                    )
                    text = response.text or ""
                    return text.strip()

            for attempt in range(self.max_retries + 1):
                try:
                    logger.info(
                        f"Submitting {image_path.name} to Gemini VLM ({self.model}) [attempt {attempt + 1}]..."
                    )
                    result = await asyncio.to_thread(_sync_generate)
                    logger.info(f"Gemini VLM finished {image_path.name} ({len(result)} chars)")

                    # Smooth pacing delay between calls to avoid burst rate limits
                    if self.delay_seconds > 0:
                        await asyncio.sleep(self.delay_seconds)

                    return result

                except Exception as e:
                    err_str = str(e).lower()
                    is_rate_limit = (
                        "429" in err_str
                        or "resource_exhausted" in err_str
                        or "rate limit" in err_str
                    )

                    if is_rate_limit and attempt < self.max_retries:
                        backoff = (2**attempt) * 1.5
                        logger.warning(
                            f"Gemini VLM rate limit hit on {image_path.name}. "
                            f"Backing off for {backoff:.1f}s before retry {attempt + 2}/{self.max_retries + 1}..."
                        )
                        await asyncio.sleep(backoff)
                    else:
                        logger.error(
                            f"Failed to process image {image_path} with VLM (attempt {attempt + 1}): {e}"
                        )
                        if attempt >= self.max_retries:
                            return ""


vlm_service = VLMService()
