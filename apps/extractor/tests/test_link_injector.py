import pymupdf

from src.parsing.link_injector import inject_links_inline


def test_link_injection_with_hyperlink():
    doc = pymupdf.open()
    page = doc.new_page(width=600, height=800)

    # Insert text and add a link annotation
    rect = pymupdf.Rect(45, 45, 300, 80)
    page.insert_text(pymupdf.Point(50, 65), "Visit Whimsync for details")
    page.insert_link(
        {
            "kind": pymupdf.LINK_URI,
            "from": rect,
            "uri": "https://whimsync.io",
        }
    )

    # Save to bytes and reload so PyMuPDF builds internal annotation and word structures
    pdf_bytes = doc.tobytes()
    doc.close()
    reloaded_doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    page = reloaded_doc[0]

    markdown_input = "Visit Whimsync for details and documentation."
    injected_md = inject_links_inline(page, markdown_input)

    assert (
        "[Visit Whimsync](https://whimsync.io)" in injected_md
        or "[Whimsync](https://whimsync.io)" in injected_md
        or "https://whimsync.io" in injected_md
    )
    reloaded_doc.close()


def test_link_injection_no_links():
    doc = pymupdf.open()
    page = doc.new_page(width=600, height=800)
    page.insert_text(pymupdf.Point(50, 65), "Plain digital text without links.")

    markdown_input = "Plain digital text without links."
    result = inject_links_inline(page, markdown_input)

    assert result == markdown_input
    doc.close()
