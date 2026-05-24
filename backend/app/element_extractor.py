"""
Extract page elements (text blocks + images) for the structure tree tagging wizard.
"""
import uuid
import fitz
from pathlib import Path


ROLES = ["H1", "H2", "H3", "H4", "P", "Figure", "Table", "Caption", "List", "Artifact"]


def _suggested_role(font_size: float, bold: bool, body_size: float, text: str) -> str:
    """Heuristic role suggestion based on font metrics."""
    if font_size <= 0 or body_size <= 0:
        return "P"
    ratio = font_size / body_size
    t = text.strip()
    if ratio >= 1.6:
        return "H1"
    if ratio >= 1.35:
        return "H2"
    if ratio >= 1.15 or (bold and ratio >= 1.05):
        return "H3"
    # Short all-caps lines are often headings
    if len(t) < 60 and t == t.upper() and t.replace(" ", "").isalpha():
        return "H3"
    return "P"


def extract_elements(pdf_path: str) -> dict:
    """Return elements grouped by page with auto-suggested roles."""
    doc = fitz.open(pdf_path)
    pages_out = []

    # First pass: collect all font sizes to find body size
    all_sizes: list[float] = []
    for page_num in range(doc.page_count):
        try:
            blocks = doc[page_num].get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]
            for block in blocks:
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        if span.get("text", "").strip():
                            all_sizes.append(span["size"])
        except Exception:
            continue

    sorted_sizes = sorted(all_sizes)
    body_size = sorted_sizes[len(sorted_sizes) // 2] if sorted_sizes else 12.0

    total_elements = 0

    for page_num in range(doc.page_count):
        page = doc[page_num]
        elements = []
        elem_idx = 0

        # Text blocks
        try:
            blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]
            for block in blocks:
                if block.get("type") != 0:  # skip non-text
                    continue
                # Collect spans in this block
                block_text = ""
                block_size = 0.0
                block_bold = False
                bbox = block.get("bbox", [0, 0, 0, 0])

                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        t = span.get("text", "").strip()
                        if t:
                            block_text += t + " "
                            if span["size"] > block_size:
                                block_size = span["size"]
                            if span.get("flags", 0) & (1 << 4):
                                block_bold = True

                block_text = block_text.strip()
                if not block_text or len(block_text) < 2:
                    continue

                role = _suggested_role(block_size, block_bold, body_size, block_text)

                elements.append({
                    "id": f"p{page_num+1}_e{elem_idx}",
                    "page": page_num + 1,
                    "element_type": "text_block",
                    "text": block_text[:200],
                    "font_size": round(block_size, 1),
                    "bold": block_bold,
                    "suggested_role": role,
                    "bbox": [round(v, 1) for v in bbox],
                })
                elem_idx += 1
        except Exception:
            pass

        # Images
        try:
            for img in page.get_images(full=True):
                bbox_list = page.get_image_rects(img[0])
                bbox = [round(v, 1) for v in bbox_list[0]] if bbox_list else []
                elements.append({
                    "id": f"p{page_num+1}_img{elem_idx}",
                    "page": page_num + 1,
                    "element_type": "image",
                    "text": None,
                    "font_size": None,
                    "bold": False,
                    "suggested_role": "Figure",
                    "bbox": bbox,
                })
                elem_idx += 1
        except Exception:
            pass

        total_elements += len(elements)
        pages_out.append({"page_number": page_num + 1, "elements": elements})

    doc.close()
    return {"pages": pages_out, "total_elements": total_elements}
