from pathlib import Path

import pytest

from src.services.office_converter import OfficeConverterService


def test_office_converter_missing_file_raises_error():
    converter = OfficeConverterService(executable_path="soffice_non_existent")
    with pytest.raises(RuntimeError) as exc_info:
        converter.convert_to_pdf(Path("missing_file.docx"), Path("out_dir"))

    assert "soffice" in str(exc_info.value).lower()
