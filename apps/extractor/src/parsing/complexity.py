import unicodedata

import pymupdf

from ..schemas.parsing import PageComplexity


def _garble_ratio(text: str) -> float:
    """Fraction of characters that are non-printable, replacement, or control characters."""
    if not text:
        return 0.0
    bad = sum(
        1
        for c in text
        if unicodedata.category(c) in ("Cc", "Cf", "Cs", "Co", "Cn") or c == "\ufffd"
    )
    return bad / len(text)


def analyze_page_complexity(page: pymupdf.Page, page_number: int = 0) -> PageComplexity:
    """
    Multi-signal complexity analysis per PDF page.
    Determines if a page is clean digital text or complex (scanned, garbled, vector grid tables).
    """
    page_area = page.rect.get_area()
    if page_area == 0:
        return PageComplexity(
            page_number=page_number,
            needs_ocr=False,
            reasons=[],
            is_garbled=False,
            full_page_image=False,
            text_coverage=0.0,
            image_coverage=0.0,
            vg_coverage=0.0,
            text_length=0,
        )

    reasons = []

    # --- 1. Text signals ---
    raw_text = page.get_text()
    usable_text = raw_text.strip()
    text_length = len(usable_text)

    # Text coverage: area of all text bboxes / page area
    blocks = page.get_text("dict", flags=pymupdf.TEXTFLAGS_TEXT).get("blocks", [])
    text_area = sum(pymupdf.Rect(b["bbox"]).get_area() for b in blocks if b.get("type") == 0)
    text_coverage = min(text_area / page_area, 1.0)

    is_garbled = _garble_ratio(usable_text) > 0.15 if usable_text else False
    if is_garbled:
        reasons.append("garbled")

    # --- 2. Image signals ---
    images = page.get_images(full=True)
    image_coverage = 0.0
    full_page_image = False
    largest_coverage = 0.0

    for img in images:
        try:
            rects = page.get_image_rects(img[0])
        except Exception:
            continue
        for rect in rects:
            cov = rect.get_area() / page_area
            image_coverage = min(image_coverage + cov, 1.0)
            if cov > largest_coverage:
                largest_coverage = cov

    if largest_coverage >= 0.90:
        full_page_image = True

    # --- 3. Vector Drawing signals (tables with gridlines, CAD, flowcharts) ---
    vg_coverage = 0.0
    drawings = page.get_drawings()
    if drawings:
        vg_rects = [pymupdf.Rect(d["rect"]) for d in drawings if d.get("rect")]
        merged_vg = []
        for r in vg_rects:
            if r.is_empty:
                continue
            r_inf = pymupdf.Rect(r.x0 - 2, r.y0 - 2, r.x1 + 2, r.y1 + 2)
            intersects = [
                m
                for m in merged_vg
                if r_inf.intersects(pymupdf.Rect(m.x0 - 2, m.y0 - 2, m.x1 + 2, m.y1 + 2))
            ]
            for m in intersects:
                merged_vg.remove(m)
                r = r | m
            merged_vg.append(r)

        vg_area = sum(m.get_area() for m in merged_vg)
        vg_coverage = min(vg_area / page_area, 1.0) if page_area > 0 else 0.0
        image_coverage = min(image_coverage + vg_coverage, 1.0)

    # --- 4. Classify reasons ---
    is_empty = text_length == 0 and image_coverage == 0.0 and vg_coverage == 0.0

    if is_empty:
        reasons.append("empty")
        needs_ocr = False
    else:
        if full_page_image and text_coverage < 0.05:
            reasons.append("scanned")
        elif text_length < 20 and not full_page_image:
            reasons.append("no-text")
        elif text_coverage < 0.05 and image_coverage > 0.30:
            reasons.append("sparse-text")

        if image_coverage > 0.15 and not full_page_image:
            if vg_coverage > 0.10:
                reasons.append("vector-table")
            else:
                reasons.append("embedded-images")

        needs_ocr = bool(reasons) or is_garbled

    return PageComplexity(
        page_number=page_number,
        needs_ocr=needs_ocr,
        reasons=reasons,
        is_garbled=is_garbled,
        full_page_image=full_page_image,
        is_empty=is_empty,
        text_coverage=round(text_coverage, 4),
        image_coverage=round(image_coverage, 4),
        vg_coverage=round(vg_coverage, 4),
        text_length=text_length,
    )
