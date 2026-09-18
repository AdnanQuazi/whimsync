import os
import shutil
import subprocess
from pathlib import Path

from ..config import settings
from ..utils.logger import get_logger

logger = get_logger("office_converter")


class OfficeConverterService:
    def __init__(self, executable_path: str | None = None):
        self.executable = self._resolve_executable(executable_path or settings.LIBREOFFICE_PATH)

    def _resolve_executable(self, requested: str) -> str | None:
        # Search PATH directly via shutil.which (cross-platform: works on Linux, macOS, Windows, Docker)
        found = shutil.which(requested)
        if found:
            return found

        # If user supplied a direct absolute/relative file path to the binary
        candidate = Path(requested)
        if candidate.is_file() and os.access(candidate, os.X_OK):
            return str(candidate)

        return None

    def is_available(self) -> bool:
        return self.executable is not None

    def convert_to_pdf(self, input_file: Path, out_dir: Path, timeout_seconds: int = 90) -> Path:
        """
        Converts an Office document (.docx, .pptx, .xlsx) to PDF using headless LibreOffice.
        Returns the Path to the converted PDF.
        """
        if not self.executable:
            raise RuntimeError(
                "LibreOffice executable ('soffice') not found. "
                "Please install LibreOffice and ensure 'soffice' is in PATH or set LIBREOFFICE_PATH."
            )

        if not input_file.exists():
            raise FileNotFoundError(f"Input office file not found: {input_file}")

        out_dir.mkdir(parents=True, exist_ok=True)

        cmd = [
            self.executable,
            "--headless",
            "--convert-to",
            "pdf",
            "--outdir",
            str(out_dir),
            str(input_file),
        ]

        logger.info(f"Converting office doc to PDF: {input_file.name}")
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
                check=False,
            )
        except subprocess.TimeoutExpired:
            raise TimeoutError(
                f"Office conversion timed out after {timeout_seconds}s for {input_file.name}"
            )

        if result.returncode != 0:
            logger.error(
                f"LibreOffice conversion failed (exit code {result.returncode}): {result.stderr}"
            )
            raise RuntimeError(f"Office conversion failed: {result.stderr.strip()}")

        expected_pdf_name = f"{input_file.stem}.pdf"
        output_pdf = out_dir / expected_pdf_name

        if not output_pdf.exists():
            # Sometimes LibreOffice sanitizes the output filename; find any newly created pdf
            generated_pdfs = list(out_dir.glob("*.pdf"))
            if generated_pdfs:
                output_pdf = generated_pdfs[0]
            else:
                raise FileNotFoundError(
                    f"LibreOffice exited cleanly but no PDF was generated in {out_dir}"
                )

        logger.info(
            f"Successfully converted {input_file.name} -> {output_pdf.name} ({output_pdf.stat().st_size} bytes)"
        )
        return output_pdf


office_converter = OfficeConverterService()
