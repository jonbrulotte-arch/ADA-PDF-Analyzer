"""
PDF accessibility analyzer. Runs a suite of checks covering WCAG 2.1 AA and PDF/UA-1.
"""

import uuid
import fitz  # PyMuPDF
import pikepdf
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from .models import (
    AccessibilityCheck,
    AccessibilityReport,
    CheckStatus,
    Finding,
    FixAction,
    FixType,
    ScoreSummary,
    Severity,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _check(
    name: str,
    category: str,
    status: CheckStatus,
    severity: Severity,
    description: str,
    details: list[str] | None = None,
    wcag: str | None = None,
    pdf_ua: str | None = None,
    fix: FixAction | None = None,
    findings: list[Finding] | None = None,
) -> AccessibilityCheck:
    return AccessibilityCheck(
        id=str(uuid.uuid4()),
        name=name,
        category=category,
        status=status,
        severity=severity,
        description=description,
        details=details or [],
        wcag_criterion=wcag,
        pdf_ua_criterion=pdf_ua,
        fix=fix,
        findings=findings or [],
    )


def _finding(
    element_type: str,
    element_label: str,
    recommended_fix: str,
    page: int | None = None,
    infringing_text: str | None = None,
    editor: str = "none",
    field_key: str | None = None,
    placeholder: str | None = None,
) -> Finding:
    return Finding(
        id=str(uuid.uuid4()),
        page=page,
        element_type=element_type,
        element_label=element_label,
        infringing_text=infringing_text,
        recommended_fix=recommended_fix,
        editor=editor,
        field_key=field_key,
        placeholder=placeholder,
    )


def _struct_elements(node, target_types: set[str], visited: set | None = None):
    """Yield pikepdf Dictionary nodes whose /S type is in target_types."""
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
        if s is not None and str(s).lstrip("/") in target_types:
            yield node

        kids = node.get("/K")
        if kids is None:
            return
        if isinstance(kids, pikepdf.Array):
            for kid in kids:
                yield from _struct_elements(kid, target_types, visited)
        elif isinstance(kids, (pikepdf.Dictionary,)):
            yield from _struct_elements(kids, target_types, visited)
        elif hasattr(kids, "get_object"):
            yield from _struct_elements(kids.get_object(), target_types, visited)
    except Exception:
        return


def _traverse_all(node, visited: set | None = None):
    """Yield every pikepdf Dictionary node in the structure tree."""
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

        yield node

        kids = node.get("/K")
        if kids is None:
            return
        if isinstance(kids, pikepdf.Array):
            for kid in kids:
                yield from _traverse_all(kid, visited)
        elif isinstance(kids, (pikepdf.Dictionary,)):
            yield from _traverse_all(kids, visited)
        elif hasattr(kids, "get_object"):
            yield from _traverse_all(kids.get_object(), visited)
    except Exception:
        return


# ---------------------------------------------------------------------------
# Individual checks
# ---------------------------------------------------------------------------

def _check_encryption(pdf: pikepdf.Pdf) -> AccessibilityCheck:
    if pdf.is_encrypted:
        findings = [_finding(
            "document",
            "PDF Encryption",
            "Remove encryption or set accessibility permissions to allow assistive technology access.",
            infringing_text="Document is encrypted",
        )]
        return _check(
            "Encryption / Security",
            "security",
            CheckStatus.FAIL,
            Severity.CRITICAL,
            "The PDF is encrypted. Encryption can block screen readers and other assistive technologies from accessing content.",
            ["Remove encryption or configure permissions to allow assistive technology access."],
            wcag="4.1.1",
            findings=findings,
        )
    return _check(
        "Encryption / Security",
        "security",
        CheckStatus.PASS,
        Severity.CRITICAL,
        "PDF is not encrypted — assistive technologies can access the content.",
    )


def _check_document_title(pdf: pikepdf.Pdf, doc: fitz.Document) -> AccessibilityCheck:
    title = ""
    try:
        raw = pdf.docinfo.get("/Title")
        if raw:
            title = str(raw).strip()
    except Exception:
        pass

    if not title:
        # Suggest a title from the first line of text
        suggested = ""
        try:
            page = doc[0]
            blocks = page.get_text("dict")["blocks"]
            for block in blocks:
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        t = span["text"].strip()
                        if t and len(t) > 3:
                            suggested = t[:120]
                            break
                    if suggested:
                        break
                if suggested:
                    break
        except Exception:
            pass

        findings = [_finding(
            "document",
            "Document Title",
            f'Set document title to "{suggested or "Untitled Document"}"',
            infringing_text="Not set",
            editor="text",
            field_key="doc_title",
            placeholder=suggested or "Untitled Document",
        )]
        return _check(
            "Document Title",
            "metadata",
            CheckStatus.FAIL,
            Severity.MAJOR,
            "The PDF has no document title in its metadata. Screen readers announce the title when a document opens.",
            [f'Suggested title from first text block: "{suggested}"'] if suggested else [],
            wcag="2.4.2",
            fix=FixAction(
                id=str(uuid.uuid4()),
                description=f'Set document title to: "{suggested or "Untitled Document"}"',
                auto_fixable=True,
                fix_type=FixType.METADATA_TITLE,
                fix_data={"title": suggested or "Untitled Document"},
            ),
            findings=findings,
        )

    return _check(
        "Document Title",
        "metadata",
        CheckStatus.PASS,
        Severity.MAJOR,
        f'Document title is set: "{title}"',
        wcag="2.4.2",
    )


def _check_language(pdf: pikepdf.Pdf) -> AccessibilityCheck:
    lang = ""
    try:
        raw = pdf.Root.get("/Lang")
        if raw:
            lang = str(raw).strip().strip("'\"")
    except Exception:
        pass

    if not lang:
        findings = [_finding(
            "document",
            "Document Language",
            'Set the language tag (e.g. "en-US") so screen readers use the correct voice.',
            infringing_text="Not set",
            editor="text",
            field_key="doc_language",
            placeholder="en-US",
        )]
        return _check(
            "Document Language",
            "metadata",
            CheckStatus.FAIL,
            Severity.CRITICAL,
            "No document language is specified. Screen readers need the language tag to use the correct voice and pronunciation rules.",
            [],
            wcag="3.1.1",
            pdf_ua="7.2",
            fix=FixAction(
                id=str(uuid.uuid4()),
                description='Set document language to English (en-US)',
                auto_fixable=True,
                fix_type=FixType.METADATA_LANGUAGE,
                fix_data={"language": "en-US"},
            ),
            findings=findings,
        )

    return _check(
        "Document Language",
        "metadata",
        CheckStatus.PASS,
        Severity.CRITICAL,
        f'Document language is set to "{lang}".',
        wcag="3.1.1",
    )


def _check_tagged_pdf(pdf: pikepdf.Pdf) -> AccessibilityCheck:
    has_struct = "/StructTreeRoot" in pdf.Root
    marked = False
    try:
        mi = pdf.Root.get("/MarkInfo")
        if mi and isinstance(mi, pikepdf.Dictionary):
            marked = bool(mi.get("/Marked", False))
    except Exception:
        pass

    if has_struct and marked:
        return _check(
            "Tagged PDF (Structure Tree)",
            "structure",
            CheckStatus.PASS,
            Severity.CRITICAL,
            "PDF is tagged with a logical structure tree. Screen readers can navigate the document structure.",
            pdf_ua="7.1",
        )

    details = []
    if not has_struct:
        details.append("No /StructTreeRoot found in the PDF catalog.")
    if not marked:
        details.append("The PDF is not marked (/MarkInfo missing or Marked=false).")

    findings = [
        _finding(
            "document",
            "PDF Structure Tree",
            "Use Adobe Acrobat Pro or an accessible PDF authoring tool to add tags.",
            infringing_text=detail,
        )
        for detail in details
    ]
    return _check(
        "Tagged PDF (Structure Tree)",
        "structure",
        CheckStatus.FAIL,
        Severity.CRITICAL,
        "PDF lacks a proper tagged structure. Without tags, screen readers cannot determine reading order, headings, or element roles.",
        details,
        pdf_ua="7.1",
        findings=findings,
    )


def _check_image_alt_text(pdf: pikepdf.Pdf, doc: fitz.Document) -> AccessibilityCheck:
    has_struct = "/StructTreeRoot" in pdf.Root
    if not has_struct:
        findings = [_finding(
            "image",
            "All Images",
            "Tag the PDF with a structure tree and add /Alt to all Figure elements.",
            infringing_text="PDF has no structure tree — images unverifiable",
        )]
        return _check(
            "Image Alternative Text",
            "images",
            CheckStatus.WARNING,
            Severity.CRITICAL,
            "Cannot verify image alt text because the PDF has no structure tree. All images are inaccessible to screen readers.",
            ["Tag the PDF with a structure tree and add /Alt attributes to all Figure elements."],
            wcag="1.1.1",
            findings=findings,
        )

    figures_missing: list[dict] = []
    figures_ok = 0

    try:
        struct_root = pdf.Root["/StructTreeRoot"]
        idx = 0
        for node in _struct_elements(struct_root, {"Figure", "Formula"}):
            alt = node.get("/Alt")
            actual = node.get("/ActualText")
            has_text = (alt and str(alt).strip()) or (actual and str(actual).strip())
            if has_text:
                figures_ok += 1
            else:
                # Try to get page number from /Pg
                page_num = None
                try:
                    pg = node.get("/Pg")
                    if pg:
                        pgo = pg.get_object() if hasattr(pg, "get_object") else pg
                        for p_idx, page in enumerate(pdf.pages):
                            if page.obj is pgo or page.obj == pgo:
                                page_num = p_idx + 1
                                break
                except Exception:
                    pass
                figures_missing.append({"index": idx, "page": page_num})
            idx += 1
    except Exception as e:
        return _check(
            "Image Alternative Text",
            "images",
            CheckStatus.WARNING,
            Severity.CRITICAL,
            f"Could not fully inspect image alt text: {e}",
            wcag="1.1.1",
        )

    total = len(figures_missing) + figures_ok
    if total == 0:
        return _check(
            "Image Alternative Text",
            "images",
            CheckStatus.INFO,
            Severity.CRITICAL,
            "No Figure or Formula elements found in the structure tree. If the document contains images, verify they are properly tagged.",
            wcag="1.1.1",
        )

    if not figures_missing:
        return _check(
            "Image Alternative Text",
            "images",
            CheckStatus.PASS,
            Severity.CRITICAL,
            f"All {total} image(s) have alternative text.",
            wcag="1.1.1",
        )

    pages_affected = sorted({f["page"] for f in figures_missing if f["page"]})
    details = [
        f"{len(figures_missing)} of {total} image(s) are missing alt text.",
        *(f"Page {p}" for p in pages_affected[:8]),
    ]

    alt_texts = {f["index"]: f"[Image on page {f['page'] or '?'} — description required]" for f in figures_missing}

    findings = [
        _finding(
            "image",
            f"Image #{f['index'] + 1}",
            "Add a concise description (≤150 chars) that conveys the image's meaning to screen reader users.",
            page=f["page"],
            infringing_text="Missing alt text",
            editor="textarea",
            field_key=str(f["index"]),
            placeholder=alt_texts[f["index"]],
        )
        for f in figures_missing
    ]

    return _check(
        "Image Alternative Text",
        "images",
        CheckStatus.FAIL,
        Severity.CRITICAL,
        f"{len(figures_missing)} image(s) are missing alternative text. Screen reader users will not know what these images convey.",
        details,
        wcag="1.1.1",
        fix=FixAction(
            id=str(uuid.uuid4()),
            description=f"Add placeholder alt text to {len(figures_missing)} image(s). Edit the generated PDF to replace placeholders with meaningful descriptions.",
            auto_fixable=True,
            fix_type=FixType.ALT_TEXT,
            fix_data={"alt_texts": alt_texts, "figures_missing": figures_missing},
        ),
        findings=findings,
    )


def _check_headings(pdf: pikepdf.Pdf) -> AccessibilityCheck:
    has_struct = "/StructTreeRoot" in pdf.Root
    if not has_struct:
        return _check(
            "Heading Structure",
            "structure",
            CheckStatus.WARNING,
            Severity.MAJOR,
            "Cannot verify heading structure — PDF has no structure tree.",
            wcag="1.3.1",
        )

    heading_tags = {"H", "H1", "H2", "H3", "H4", "H5", "H6"}
    headings: list[str] = []

    try:
        struct_root = pdf.Root["/StructTreeRoot"]
        for node in _struct_elements(struct_root, heading_tags):
            s = node.get("/S")
            if s:
                headings.append(str(s).lstrip("/"))
    except Exception:
        pass

    if not headings:
        findings = [_finding(
            "heading",
            "Heading Structure",
            "Add H1–H6 heading tags to section titles.",
            infringing_text="No heading elements found",
        )]
        return _check(
            "Heading Structure",
            "structure",
            CheckStatus.WARNING,
            Severity.MAJOR,
            "No heading elements (H1–H6) found in the structure tree. Documents should use headings to create a navigable outline.",
            ["Add heading tags to section titles so screen reader users can navigate by heading."],
            wcag="1.3.1",
            findings=findings,
        )

    issues: list[str] = []
    named = [h for h in headings if h != "H"]
    if named and "H1" not in named:
        issues.append("No H1 heading found — documents should start with an H1.")

    levels = [int(h[1]) for h in named if h[1:].isdigit()]
    for i in range(1, len(levels)):
        if levels[i] > levels[i - 1] + 1:
            issues.append(f"Heading level skipped: H{levels[i-1]} jumps to H{levels[i]}.")

    if issues:
        findings = [
            _finding(
                "heading",
                "Heading Hierarchy",
                "Fix heading levels so they increment by one and start with H1.",
                infringing_text=issue,
            )
            for issue in issues
        ]
        return _check(
            "Heading Structure",
            "structure",
            CheckStatus.FAIL,
            Severity.MAJOR,
            f"Heading hierarchy has {len(issues)} issue(s). Incorrect heading order confuses screen reader navigation.",
            issues,
            wcag="1.3.1",
            findings=findings,
        )

    return _check(
        "Heading Structure",
        "structure",
        CheckStatus.PASS,
        Severity.MAJOR,
        f"Heading structure looks correct ({len(headings)} heading(s) found).",
        wcag="1.3.1",
    )


def _check_tables(pdf: pikepdf.Pdf) -> AccessibilityCheck:
    has_struct = "/StructTreeRoot" in pdf.Root
    if not has_struct:
        return _check(
            "Table Headers",
            "structure",
            CheckStatus.WARNING,
            Severity.MAJOR,
            "Cannot verify table structure — PDF has no structure tree.",
            wcag="1.3.1",
        )

    tables_found = 0
    tables_without_headers = 0

    try:
        struct_root = pdf.Root["/StructTreeRoot"]
        for table_node in _struct_elements(struct_root, {"Table"}):
            tables_found += 1
            has_th = any(True for _ in _struct_elements(table_node, {"TH"}))
            if not has_th:
                tables_without_headers += 1
    except Exception:
        pass

    if tables_found == 0:
        return _check(
            "Table Headers",
            "structure",
            CheckStatus.INFO,
            Severity.MAJOR,
            "No tables detected in the document.",
            wcag="1.3.1",
        )

    if tables_without_headers:
        findings = []
        i = 0
        try:
            struct_root = pdf.Root["/StructTreeRoot"]
            for table_node in _struct_elements(struct_root, {"Table"}):
                has_th = any(True for _ in _struct_elements(table_node, {"TH"}))
                if not has_th:
                    findings.append(_finding(
                        "table",
                        f"Table #{i + 1}",
                        "Add TH elements with scope='col' or scope='row' to identify column/row headers.",
                        infringing_text="Missing header cells (TH)",
                    ))
                i += 1
        except Exception:
            pass
        return _check(
            "Table Headers",
            "structure",
            CheckStatus.FAIL,
            Severity.MAJOR,
            f"{tables_without_headers} of {tables_found} table(s) are missing header cells (TH elements). Screen readers cannot associate data cells with their headers.",
            ["Add TH elements with appropriate scope attributes (col/row) to all table headers."],
            wcag="1.3.1",
            findings=findings,
        )

    return _check(
        "Table Headers",
        "structure",
        CheckStatus.PASS,
        Severity.MAJOR,
        f"All {tables_found} table(s) have header cells.",
        wcag="1.3.1",
    )


def _check_form_fields(pdf: pikepdf.Pdf) -> AccessibilityCheck:
    try:
        acroform = pdf.Root.get("/AcroForm")
        if not acroform:
            return _check(
                "Form Field Labels",
                "forms",
                CheckStatus.INFO,
                Severity.MAJOR,
                "No interactive form fields detected.",
                wcag="1.3.1",
            )

        fields_ref = acroform.get("/Fields", [])
        fields = list(fields_ref) if isinstance(fields_ref, pikepdf.Array) else []
        unlabeled: list[str] = []

        for f_ref in fields:
            try:
                field = f_ref.get_object() if hasattr(f_ref, "get_object") else f_ref
                if not isinstance(field, pikepdf.Dictionary):
                    continue
                tooltip = field.get("/TU")
                name = field.get("/T")
                if not (tooltip and str(tooltip).strip()) and not (name and str(name).strip()):
                    unlabeled.append("unnamed field")
                elif not (tooltip and str(tooltip).strip()):
                    unlabeled.append(str(name))
            except Exception:
                continue

        if not unlabeled:
            return _check(
                "Form Field Labels",
                "forms",
                CheckStatus.PASS,
                Severity.MAJOR,
                f"All {len(fields)} form field(s) have accessible names.",
                wcag="1.3.1",
            )

        findings = [
            _finding(
                "form_field",
                f'Field: "{name}"',
                "Add a /TU tooltip attribute describing the field's purpose.",
                infringing_text="Missing accessible tooltip (/TU)",
            )
            for name in unlabeled
        ]
        return _check(
            "Form Field Labels",
            "forms",
            CheckStatus.FAIL,
            Severity.MAJOR,
            f"{len(unlabeled)} form field(s) lack accessible labels. Screen reader users cannot determine the purpose of these fields.",
            [f'Field missing tooltip: "{n}"' for n in unlabeled[:6]],
            wcag="1.3.1",
            findings=findings,
        )
    except Exception as e:
        return _check(
            "Form Field Labels",
            "forms",
            CheckStatus.INFO,
            Severity.MAJOR,
            f"Could not inspect form fields: {e}",
            wcag="1.3.1",
        )


def _check_bookmarks(pdf: pikepdf.Pdf, doc: fitz.Document) -> AccessibilityCheck:
    page_count = doc.page_count
    toc = doc.get_toc()

    if page_count < 9:
        status = CheckStatus.PASS if toc else CheckStatus.INFO
        msg = "Bookmarks are present." if toc else "Short document — bookmarks are optional but recommended."
        return _check("Bookmarks / Navigation Outline", "navigation", status, Severity.MINOR, msg, pdf_ua="6.7.3")

    if toc:
        return _check(
            "Bookmarks / Navigation Outline",
            "navigation",
            CheckStatus.PASS,
            Severity.MINOR,
            f"Document has {len(toc)} bookmark(s) to aid navigation.",
            pdf_ua="6.7.3",
        )

    # Try to generate bookmarks suggestion from headings
    headings: list[dict] = []
    try:
        has_struct = "/StructTreeRoot" in pdf.Root
        if has_struct:
            for node in _struct_elements(pdf.Root["/StructTreeRoot"], {"H1", "H2", "H3", "H4", "H5", "H6"}):
                s = node.get("/S")
                if not s:
                    continue
                level_str = str(s).lstrip("/H")
                level = int(level_str) if level_str.isdigit() else 1
                # Try to get text from ActualText or child MCIDs (best-effort)
                text_candidate = ""
                actual = node.get("/ActualText")
                if actual:
                    text_candidate = str(actual).strip()
                if not text_candidate:
                    alt = node.get("/Alt")
                    if alt:
                        text_candidate = str(alt).strip()
                if text_candidate:
                    headings.append({"level": level, "title": text_candidate[:100], "page": 1})
    except Exception:
        pass

    fix = None
    if headings:
        fix = FixAction(
            id=str(uuid.uuid4()),
            description=f"Generate {len(headings)} bookmark(s) from the document's heading structure.",
            auto_fixable=True,
            fix_type=FixType.BOOKMARKS,
            fix_data={"headings": headings},
        )

    findings = [_finding(
        "navigation",
        "Document Bookmarks",
        "Add a navigation outline with at least top-level section bookmarks.",
        infringing_text=f"No bookmarks in {page_count}-page document",
    )]
    return _check(
        "Bookmarks / Navigation Outline",
        "navigation",
        CheckStatus.FAIL,
        Severity.MINOR,
        f"This {page_count}-page document has no bookmarks. Bookmarks allow keyboard and screen reader users to jump to sections quickly.",
        ["Add a navigation outline with at least top-level section bookmarks."],
        pdf_ua="6.7.3",
        fix=fix,
        findings=findings,
    )


def _check_links(doc: fitz.Document) -> AccessibilityCheck:
    vague = {"click here", "here", "read more", "more", "link", "this", "url", "www"}
    findings: list[Finding] = []

    for page_num in range(doc.page_count):
        page = doc[page_num]
        for link in page.get_links():
            if link.get("kind") != fitz.LINK_URI:
                continue
            rect = link.get("from")
            if not rect:
                continue
            text = page.get_text("text", clip=rect).strip().lower()
            if not text or text in vague or (len(text) < 5 and text.replace(".", "").replace("/", "").isalpha()):
                uri = link.get("uri", "")[:80]
                findings.append(_finding(
                    "link",
                    f'Link: "{text or "(empty)"}"',
                    f'Replace "{text or "(empty)"}" with descriptive text that explains the link destination.',
                    page=page_num + 1,
                    infringing_text=f'"{text or "(empty)"}" → {uri}',
                ))

    if not findings:
        return _check(
            "Descriptive Link Text",
            "navigation",
            CheckStatus.PASS,
            Severity.MINOR,
            "All hyperlinks appear to have descriptive text.",
            wcag="2.4.4",
        )

    issues = [f.infringing_text for f in findings if f.infringing_text]
    return _check(
        "Descriptive Link Text",
        "navigation",
        CheckStatus.WARNING,
        Severity.MINOR,
        f"{len(findings)} link(s) use vague text like 'click here' or 'read more'. Screen reader users navigate links by text alone.",
        issues[:6],
        wcag="2.4.4",
        findings=findings,
    )


def _check_fonts(doc: fitz.Document) -> AccessibilityCheck:
    unembedded: set[str] = set()

    for page_num in range(doc.page_count):
        for font in doc[page_num].get_fonts():
            # font tuple: (xref, ext, type, basefont, name, encoding, referencer)
            ext = font[1]
            basefont = font[3] or font[4] or "unknown"
            if not ext:
                unembedded.add(basefont)

    if not unembedded:
        return _check(
            "Font Embedding",
            "text",
            CheckStatus.PASS,
            Severity.MINOR,
            "All fonts are embedded. Text will render correctly on any device.",
            pdf_ua="7.21.4",
        )

    findings = [
        _finding(
            "font",
            f"Font: {font_name}",
            "Embed the font in the PDF to ensure consistent text rendering on all devices.",
            infringing_text="Not embedded",
        )
        for font_name in sorted(unembedded)
    ]
    return _check(
        "Font Embedding",
        "text",
        CheckStatus.WARNING,
        Severity.MINOR,
        f"{len(unembedded)} font(s) are not embedded. Text may render incorrectly on other systems.",
        [f"Not embedded: {f}" for f in sorted(unembedded)[:6]],
        pdf_ua="7.21.4",
        findings=findings,
    )


def _check_color_contrast(doc: fitz.Document) -> AccessibilityCheck:
    """Heuristic: flag text that is very light (could be invisible or low-contrast)."""
    findings: list[Finding] = []
    seen: set[str] = set()

    for page_num in range(doc.page_count):
        page = doc[page_num]
        try:
            blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]
            for block in blocks:
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        color = span.get("color", 0)
                        text = span.get("text", "").strip()
                        if not text:
                            continue
                        r = (color >> 16) & 0xFF
                        g = (color >> 8) & 0xFF
                        b = color & 0xFF
                        luminance = 0.299 * r + 0.587 * g + 0.114 * b
                        if luminance > 210:
                            snippet = text[:60]
                            dedup_key = f"{page_num}:{r}{g}{b}:{snippet}"
                            if dedup_key in seen or len(findings) >= 20:
                                continue
                            seen.add(dedup_key)
                            hex_color = f"#{r:02X}{g:02X}{b:02X}"
                            label = f'"{snippet}"' if len(snippet) <= 40 else f'"{snippet[:40]}…"'
                            findings.append(_finding(
                                "text",
                                label,
                                "Check contrast against the background — minimum 4.5:1 for normal text, 3:1 for large text (WCAG 1.4.3).",
                                page=page_num + 1,
                                infringing_text=f"Color {hex_color} — luminance {luminance:.0f}/255 (high = light)",
                            ))
        except Exception:
            continue

    if findings:
        light_pages = sorted({f.page for f in findings if f.page})
        pages_str = ", ".join(str(p) for p in light_pages[:8])
        return _check(
            "Color Contrast",
            "visual",
            CheckStatus.WARNING,
            Severity.CRITICAL,
            f"Potentially light-colored text detected on page(s) {pages_str}. Insufficient contrast makes text hard to read for users with low vision.",
            ["Verify a 4.5:1 contrast ratio for normal text and 3:1 for large text (18pt+ or 14pt+ bold)."],
            wcag="1.4.3",
            findings=findings,
        )

    return _check(
        "Color Contrast",
        "visual",
        CheckStatus.PASS,
        Severity.CRITICAL,
        "No obviously light-colored text detected. Manual verification is still recommended for full WCAG 1.4.3 compliance.",
        wcag="1.4.3",
    )


def _check_reading_order(pdf: pikepdf.Pdf) -> AccessibilityCheck:
    has_struct = "/StructTreeRoot" in pdf.Root
    if has_struct:
        findings = [_finding(
            "document",
            "Reading Order",
            "Review tab order in Adobe Acrobat Pro or PAC 2024 to confirm content flows correctly.",
            infringing_text="Structure tree present but reading order requires visual verification",
        )]
        return _check(
            "Logical Reading Order",
            "structure",
            CheckStatus.WARNING,
            Severity.CRITICAL,
            "A structure tree exists but logical reading order requires visual verification. Automated tools cannot fully validate that content flows in the correct sequence.",
            ["Review the tab/reading order in Adobe Acrobat Pro or PAC 2024 to confirm it matches visual layout."],
            wcag="1.3.2",
            findings=findings,
        )
    findings = [_finding(
        "document",
        "Reading Order",
        "Tag the PDF with a structure tree using an accessible PDF authoring tool.",
        infringing_text="No structure tree — reading order undefined",
    )]
    return _check(
        "Logical Reading Order",
        "structure",
        CheckStatus.FAIL,
        Severity.CRITICAL,
        "Without a structure tree there is no defined reading order. Screen readers will read content in the order it appears in the content stream, which may differ from visual order.",
        wcag="1.3.2",
        findings=findings,
    )


def _check_scanned(doc: fitz.Document) -> tuple[bool, Optional[AccessibilityCheck]]:
    """Return (is_scanned, check). is_scanned=True means the PDF has no selectable text."""
    total_chars = sum(len(doc[i].get_text().strip()) for i in range(min(doc.page_count, 5)))
    avg = total_chars / min(doc.page_count, 5)

    if avg < 20:
        findings = [_finding(
            "document",
            "Text Layer",
            "Run OCR (Tesseract, Adobe Acrobat, ABBYY FineReader) to add a searchable text layer.",
            infringing_text="No selectable text (image-only PDF)",
        )]
        return True, _check(
            "Text Layer (Scanned Document)",
            "text",
            CheckStatus.FAIL,
            Severity.CRITICAL,
            "This PDF appears to be a scanned image with no text layer. Screen readers cannot read any content.",
            [
                "Run OCR (Optical Character Recognition) to add a searchable text layer.",
                "Use Adobe Acrobat Pro, ABBYY FineReader, or free tools like Tesseract.",
            ],
            wcag="1.1.1",
            findings=findings,
        )
    return False, None


# ---------------------------------------------------------------------------
# Score calculation
# ---------------------------------------------------------------------------

_WEIGHTS = {Severity.CRITICAL: 3, Severity.MAJOR: 2, Severity.MINOR: 1}


def _score(checks: list[AccessibilityCheck]) -> ScoreSummary:
    scorable = [c for c in checks if c.status != CheckStatus.INFO]
    earned = 0.0
    total = 0.0
    passed = failed = warnings = critical_failures = 0

    for c in scorable:
        w = _WEIGHTS[c.severity]
        total += w
        if c.status == CheckStatus.PASS:
            earned += w
            passed += 1
        elif c.status == CheckStatus.WARNING:
            earned += w * 0.5
            warnings += 1
        elif c.status == CheckStatus.FAIL:
            failed += 1
            if c.severity == Severity.CRITICAL:
                critical_failures += 1

    score = int((earned / total) * 100) if total > 0 else 100
    if score >= 90:
        grade = "A"
    elif score >= 75:
        grade = "B"
    elif score >= 55:
        grade = "C"
    elif score >= 35:
        grade = "D"
    else:
        grade = "F"

    return ScoreSummary(
        score=score,
        grade=grade,
        total_checks=len(checks),
        passed=passed,
        failed=failed,
        warnings=warnings,
        critical_failures=critical_failures,
    )


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def analyze_pdf(pdf_path: str, session_id: str, filename: str) -> AccessibilityReport:
    path = Path(pdf_path)
    file_size_kb = path.stat().st_size // 1024

    doc = fitz.open(pdf_path)
    page_count = doc.page_count

    is_scanned, scanned_check = _check_scanned(doc)

    with pikepdf.open(pdf_path) as pdf:
        checks: list[AccessibilityCheck] = []

        if scanned_check:
            checks.append(scanned_check)

        checks.append(_check_encryption(pdf))
        checks.append(_check_document_title(pdf, doc))
        checks.append(_check_language(pdf))
        checks.append(_check_tagged_pdf(pdf))
        checks.append(_check_reading_order(pdf))
        checks.append(_check_image_alt_text(pdf, doc))
        checks.append(_check_headings(pdf))
        checks.append(_check_tables(pdf))
        checks.append(_check_form_fields(pdf))
        checks.append(_check_bookmarks(pdf, doc))
        checks.append(_check_links(doc))
        checks.append(_check_fonts(doc))
        checks.append(_check_color_contrast(doc))

    doc.close()

    return AccessibilityReport(
        session_id=session_id,
        filename=filename,
        page_count=page_count,
        file_size_kb=file_size_kb,
        is_scanned=is_scanned,
        created_at=datetime.now(timezone.utc).isoformat(),
        checks=checks,
        summary=_score(checks),
    )
