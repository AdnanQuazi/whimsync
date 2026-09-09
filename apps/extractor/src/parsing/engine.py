from pathlib import Path

import pymupdf

from ..schemas.parsing import ParsedDocument, ParseTier
from ..utils.logger import get_logger
from .strategies.base import BaseParsingStrategy
from .strategies.fast import FastParsingStrategy
from .strategies.max import MaxParsingStrategy
from .strategies.smart import SmartParsingStrategy

logger = get_logger("parsing_engine")


class ParsingEngine:
    """
    Central orchestration engine for PDF document layout parsing.
    Dispatches to Fast, Smart, or Max tier strategies based on configuration.
    """

    def __init__(self):
        self._strategies: dict[ParseTier, BaseParsingStrategy] = {
            ParseTier.FAST: FastParsingStrategy(),
            ParseTier.SMART: SmartParsingStrategy(),
            ParseTier.MAX: MaxParsingStrategy(),
        }

    async def parse(
        self,
        pdf_path: Path,
        work_dir: Path,
        tier: ParseTier | str = ParseTier.SMART,
    ) -> ParsedDocument:
        if not pdf_path.exists():
            raise FileNotFoundError(f"Target PDF does not exist: {pdf_path}")

        # Normalize tier
        if isinstance(tier, str):
            try:
                tier = ParseTier(tier.lower())
            except ValueError:
                logger.warning(f"Unknown tier '{tier}'. Defaulting to SMART.")
                tier = ParseTier.SMART

        strategy = self._strategies.get(tier, self._strategies[ParseTier.SMART])
        logger.info(f"Dispatching {pdf_path.name} to {tier.value.upper()} parsing strategy")

        doc = pymupdf.open(str(pdf_path))
        try:
            return await strategy.parse(doc, pdf_path, work_dir)
        finally:
            doc.close()


parsing_engine = ParsingEngine()
