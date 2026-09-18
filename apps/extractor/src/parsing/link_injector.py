import re
from collections import defaultdict
from typing import Any

import pymupdf


def _extract_page_links(page: pymupdf.Page) -> list[dict[str, Any]]:
    """Extracts {text, uri, rect} for actionable links on the page."""
    links = []
    for link in page.get_links():
        rect = pymupdf.Rect(link["from"])
        kind = link.get("kind")
        target = None

        if kind == pymupdf.LINK_URI:
            target = link.get("uri")
        elif kind == pymupdf.LINK_GOTO:
            dest_page = link.get("page", -1)
            if dest_page >= 0:
                target = f"#page-{dest_page + 1}"
        elif kind == pymupdf.LINK_GOTOR:
            target = link.get("file") or link.get("uri")

        if not target:
            continue

        words = page.get_text("words")
        hits = []
        for w in words:
            wrect = pymupdf.Rect(w[:4])
            inter = wrect & rect
            if wrect.get_area() > 0 and inter.get_area() > 0.2 * wrect.get_area():
                hits.append(w)

        hits.sort(key=lambda w: (w[5], w[6], w[7]))
        text = re.sub(r"\s+", " ", " ".join(w[4] for w in hits)).strip()

        if text:
            links.append({"text": text, "uri": target, "rect": rect})

    links.sort(key=lambda item: (round(item["rect"].y0, 1), item["rect"].x0))
    return links


def inject_links_inline(page: pymupdf.Page, md_text: str) -> str:
    """
    Injects markdown links [anchor text](uri) into generated Markdown text.
    Uses positional zipping to avoid over-linking duplicate anchor texts and
    avoids nesting within existing markdown links.
    """
    links = _extract_page_links(page)
    if not links or not md_text.strip():
        return md_text

    grouped_uris = defaultdict(list)
    for link in links:
        grouped_uris[link["text"]].append(link["uri"])

    candidates = []
    for text, uris in grouped_uris.items():
        words = [re.escape(w) for w in text.split(" ") if w]
        if not words:
            continue

        pattern = r"[\s*_`]+".join(words)
        try:
            regex = re.compile(pattern)
        except re.error:
            continue

        matches = []
        for m in regex.finditer(md_text):
            start, end = m.span()
            before = md_text[:start]
            # Avoid wrapping if already inside a markdown link [ ... ]
            if before.count("[") > before.count("]"):
                continue
            matches.append((start, end))

        for (start, end), uri in zip(matches, uris):
            candidates.append((start, end, uri))

    candidates.sort(key=lambda c: (c[0], -(c[1] - c[0])))

    selected = []
    last_end = -1
    for start, end, uri in candidates:
        if start >= last_end:
            selected.append((start, end, uri))
            last_end = end

    if not selected:
        return md_text

    out = []
    cursor = 0
    for start, end, uri in selected:
        out.append(md_text[cursor:start])
        out.append(f"[{md_text[start:end]}]({uri})")
        cursor = end
    out.append(md_text[cursor:])

    return "".join(out)
