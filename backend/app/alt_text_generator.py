"""
AI-powered alt text generator using Claude Vision API (claude-haiku-4-5).
"""

import base64
import os


def generate_alt_texts(pdf_path: str, figures_missing: list[dict]) -> dict[str, str]:
    """
    Generate alt text for PDF images using Claude Vision API.

    Args:
        pdf_path: Path to the PDF file.
        figures_missing: list of {index: int, page: int|None} from fix_data.

    Returns:
        dict keyed by str(index) with generated alt text.
        Returns {} if ANTHROPIC_API_KEY is not set or anthropic import fails.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        return {}

    try:
        import anthropic
    except ImportError:
        return {}

    try:
        import fitz
    except ImportError:
        return {}

    results: dict[str, str] = {}
    client = anthropic.Anthropic(api_key=api_key)

    try:
        doc = fitz.open(pdf_path)
    except Exception:
        return {}

    try:
        for figure in figures_missing:
            index = figure.get("index")
            page_num = figure.get("page")  # 1-indexed from analyzer, may be None

            if index is None:
                continue

            # Convert 1-indexed page to 0-indexed; default to page 0 if unknown
            page_idx = (page_num - 1) if (page_num is not None and page_num > 0) else 0
            page_idx = min(page_idx, doc.page_count - 1)

            try:
                page = doc[page_idx]

                # Try to find the image bounding box for this figure
                image_rect = None
                try:
                    blocks = page.get_text("dict")["blocks"]
                    image_blocks = [b for b in blocks if b.get("type") == 1]
                    if image_blocks:
                        # Use the first image block found on this page as best-effort match
                        # (figures_missing already gives us the page, individual positioning
                        #  within page is a best-effort heuristic)
                        b = image_blocks[0]
                        bbox = b.get("bbox")
                        if bbox:
                            image_rect = fitz.Rect(bbox)
                except Exception:
                    pass

                # Fallback: try page.get_image_info()
                if image_rect is None:
                    try:
                        img_infos = page.get_image_info()
                        if img_infos:
                            info = img_infos[0]
                            bbox = info.get("bbox")
                            if bbox:
                                image_rect = fitz.Rect(bbox)
                    except Exception:
                        pass

                # Render the image region (or full page as fallback)
                matrix = fitz.Matrix(2.0, 2.0)
                if image_rect and not image_rect.is_empty:
                    try:
                        pixmap = page.get_pixmap(matrix=matrix, clip=image_rect)
                    except Exception:
                        pixmap = page.get_pixmap(matrix=matrix)
                else:
                    pixmap = page.get_pixmap(matrix=matrix)

                png_bytes = pixmap.tobytes("png")
                b64_image = base64.b64encode(png_bytes).decode("utf-8")

            except Exception:
                continue

            # Call Claude Vision
            try:
                response = client.messages.create(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=200,
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "image",
                                    "source": {
                                        "type": "base64",
                                        "media_type": "image/png",
                                        "data": b64_image,
                                    },
                                },
                                {
                                    "type": "text",
                                    "text": (
                                        "Write concise alt text for this image as it would appear in an accessible PDF. "
                                        "Describe content and purpose in 1-2 sentences. "
                                        "Do not start with 'Image of' or 'Picture of'. "
                                        "If it's a chart or graph, describe the key data shown. "
                                        "Keep it under 150 characters."
                                    ),
                                },
                            ],
                        }
                    ],
                )
                alt_text = response.content[0].text.strip()
                # Truncate to 150 characters as instructed
                if len(alt_text) > 150:
                    alt_text = alt_text[:147] + "..."
                results[str(index)] = alt_text
            except Exception:
                continue

    finally:
        try:
            doc.close()
        except Exception:
            pass

    return results
