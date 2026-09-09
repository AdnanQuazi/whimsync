import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from src.parsing.image_replacer import enrich_markdown_images


@pytest.mark.asyncio
async def test_enrich_markdown_images_replaces_placeholder():
    with tempfile.TemporaryDirectory() as temp_dir:
        dir_path = Path(temp_dir)
        img_file = dir_path / "chart.png"
        img_file.write_bytes(b"dummy image bytes")

        raw_markdown = (
            "# Quarterly Financials\n\n"
            "Below is the revenue breakdown:\n\n"
            f"![Revenue Chart]({img_file.name})\n\n"
            "End of section."
        )

        mock_vlm_output = "| Quarter | Revenue |\n|---|---|\n| Q1 | $10M |\n| Q2 | $15M |"

        with patch("src.parsing.image_replacer.vlm_service") as mock_vlm:
            mock_vlm.is_available.return_value = True
            mock_vlm.process_image = AsyncMock(return_value=mock_vlm_output)

            result = await enrich_markdown_images(raw_markdown, dir_path)

            assert "![Revenue Chart]" not in result
            assert "Quarter | Revenue" in result
            assert "Q1 | $10M" in result
            assert "> **[Figure / Chart Analysis]**:" in result


@pytest.mark.asyncio
async def test_enrich_markdown_images_noop_when_no_images():
    raw_markdown = "# Plain text document without any images."
    result = await enrich_markdown_images(raw_markdown, Path("/tmp"))
    assert result == raw_markdown
