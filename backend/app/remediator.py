"""
PDF remediator: applies approved fixes to a PDF and writes a new file.
"""

import fitz
import pikepdf
from pathlib import Path

from .models import AccessibilityReport, FixType


def _apply_title(pdf: pikepdf.Pdf, title: str) -> str:
    pdf.docinfo["/Title"] = title
    try:
        with pdf.open_metadata() as meta:
            meta["dc:title"] = title
    except Exception:
        pass
    return f'Set document title to "{title}"'


def _apply_language(pdf: pikepdf.Pdf, language: str) -> str:
    pdf.Root["/Lang"] = language
    return f'Set document language to "{language}"'


def _apply_alt_texts(pdf: pikepdf.Pdf, fix_data: dict) -> str:
    """Add /Alt text to Figure elements that are missing it."""
    alt_map: dict[int, str] = {int(k): v for k, v in fix_data.get("alt_texts", {}).items()}
    if not alt_map:
        return "No alt texts to apply."

    if "/StructTreeRoot" not in pdf.Root:
        return "Skipped alt text — PDF has no structure tree."

    count = 0
    current_index = [0]

    def _visit(node, visited=None):
        if visited is None:
            visited = set()
        try:
            if hasattr(node, "get_object"):
                node = node.get_object()
            if not isinstance(node, pikepdf.Dictionary):
                return
            nid = id(node)
            if nid in visited:
                return
            visited.add(nid)

            s = node.get("/S")
            struct_type = str(s).lstrip("/") if s else None
            if struct_type in ("Figure", "Formula"):
                alt = node.get("/Alt")
                if not (alt and str(alt).strip()):
                    idx = current_index[0]
                    if idx in alt_map:
                        node["/Alt"] = alt_map[idx]
                        nonlocal count
                        count += 1
                    current_index[0] += 1

            kids = node.get("/K")
            if kids is None:
                return
            if isinstance(kids, pikepdf.Array):
                for kid in kids:
                    _visit(kid, visited)
            elif isinstance(kids, (pikepdf.Dictionary,)):
                _visit(kids, visited)
            elif hasattr(kids, "get_object"):
                _visit(kids.get_object(), visited)
        except Exception:
            return

    _visit(pdf.Root["/StructTreeRoot"])
    return f"Added placeholder alt text to {count} image(s). Open the PDF and replace placeholders with meaningful descriptions."


def _detect_headings_from_text(doc: fitz.Document) -> list[dict]:
    """Heuristic: find potential headings by comparing font sizes."""
    all_spans: list[dict] = []

    for page_num in range(doc.page_count):
        page = doc[page_num]
        try:
            blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]
            for block in blocks:
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        t = span["text"].strip()
                        if t:
                            all_spans.append({
                                "text": t,
                                "size": span["size"],
                                "flags": span.get("flags", 0),
                                "page": page_num + 1,
                            })
        except Exception:
            continue

    if not all_spans:
        return []

    sizes = sorted({s["size"] for s in all_spans})
    body_size = sizes[len(sizes) // 2] if sizes else 12.0

    headings: list[dict] = []
    seen: set[str] = set()

    for span in all_spans:
        ratio = span["size"] / body_size if body_size else 1
        bold = bool(span["flags"] & (1 << 4))
        text = span["text"][:120]

        if text in seen or len(text) > 200 or len(text) < 2:
            continue

        if ratio >= 1.6:
            level = 1
        elif ratio >= 1.3:
            level = 2
        elif ratio >= 1.1 and bold:
            level = 3
        elif bold and ratio >= 1.05:
            level = 3
        else:
            continue

        seen.add(text)
        headings.append({"level": level, "title": text, "page": span["page"]})

    return headings[:80]


def _apply_bookmarks(pdf: pikepdf.Pdf, input_path: str, output_path: str, fix_data: dict) -> tuple[str, str]:
    """
    Add bookmarks to the PDF. Returns (message, resolved_output_path).
    We use PyMuPDF for bookmark insertion because its API is simpler.
    """
    headings: list[dict] = fix_data.get("headings", [])

    # If no headings from struct tree, try heuristic detection
    if not headings:
        doc_tmp = fitz.open(input_path)
        headings = _detect_headings_from_text(doc_tmp)
        doc_tmp.close()

    if not headings:
        return "Could not detect headings — bookmarks not added.", output_path

    # First save what we have (pikepdf changes so far), then use PyMuPDF to add bookmarks
    interim_path = output_path + ".interim.pdf"
    pdf.save(interim_path)

    doc = fitz.open(interim_path)
    toc = [[h["level"], h["title"], h["page"]] for h in headings]
    doc.set_toc(toc)
    doc.save(output_path)
    doc.close()

    Path(interim_path).unlink(missing_ok=True)
    return f"Added {len(toc)} bookmark(s) to document.", output_path


def apply_fixes(
    report: AccessibilityReport,
    approved_fix_ids: list[str],
    input_path: str,
    output_path: str,
    custom_alt_texts: dict[str, str] | None = None,
) -> list[str]:
    """Apply all approved fixes and write the remediated PDF. Returns list of human-readable changes."""
    id_set = set(approved_fix_ids)
    fixes_by_type: dict[FixType, tuple] = {}

    for check in report.checks:
        if check.fix and check.fix.id in id_set:
            fixes_by_type[check.fix.fix_type] = (check.fix.fix_type, dict(check.fix.fix_data))

    if not fixes_by_type:
        import shutil
        shutil.copy2(input_path, output_path)
        return ["No fixes were approved — original PDF copied."]

    needs_bookmark_fix = FixType.BOOKMARKS in fixes_by_type
    bookmark_data = fixes_by_type.pop(FixType.BOOKMARKS, (None, {}))[1] if needs_bookmark_fix else {}

    changes: list[str] = []

    with pikepdf.open(input_path) as pdf:
        for fix_type, fix_data in fixes_by_type.values():
            if fix_type == FixType.METADATA_TITLE:
                changes.append(_apply_title(pdf, fix_data["title"]))
            elif fix_type == FixType.METADATA_LANGUAGE:
                changes.append(_apply_language(pdf, fix_data["language"]))
            elif fix_type == FixType.ALT_TEXT:
                # Merge custom_alt_texts over the placeholder alt_texts from fix_data
                if custom_alt_texts:
                    merged = dict(fix_data.get("alt_texts", {}))
                    # custom_alt_texts keys are string figure indices; merge directly
                    for k, v in custom_alt_texts.items():
                        merged[str(k)] = v
                    fix_data = dict(fix_data)
                    fix_data["alt_texts"] = merged
                changes.append(_apply_alt_texts(pdf, fix_data))

        if needs_bookmark_fix:
            msg, output_path = _apply_bookmarks(pdf, input_path, output_path, bookmark_data)
            changes.append(msg)
        else:
            pdf.save(output_path)

    return changes
