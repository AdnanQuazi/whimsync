from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class ParseTier(StrEnum):
    FAST = "fast"
    SMART = "smart"
    MAX = "max"


class PageComplexity(BaseModel):
    page_number: int  # 0-indexed
    needs_ocr: bool
    reasons: list[str] = Field(default_factory=list)
    is_garbled: bool = False
    full_page_image: bool = False
    is_empty: bool = False
    text_coverage: float = 0.0
    image_coverage: float = 0.0
    vg_coverage: float = 0.0
    text_length: int = 0


class ParsedDocument(BaseModel):
    markdown: str
    total_pages: int
    tier_used: ParseTier
    metadata: dict[str, Any] = Field(default_factory=dict)
