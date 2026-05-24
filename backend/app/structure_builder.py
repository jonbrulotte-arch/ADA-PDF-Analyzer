"""
Build and inject a PDF structure tree from user-provided element assignments.
"""
import pikepdf
from pathlib import Path


ROLE_MAP = {
    "H1": "H1", "H2": "H2", "H3": "H3", "H4": "H4",
    "P": "P", "Figure": "Figure", "Table": "Table",
    "Caption": "Caption", "List": "L", "Artifact": "Artifact",
}


def build_structure_tree(
    input_path: str,
    output_path: str,
    assignments: list[dict],  # [{"element_id": ..., "role": ..., "alt_text": ...}]
) -> int:
    """
    Inject a structure tree into the PDF based on user assignments.
    Returns number of elements tagged.
    Skips elements with role "Artifact".
    """
    role_lookup = {a["element_id"]: a for a in assignments}
    tagged_count = 0

    with pikepdf.open(input_path) as pdf:
        # Set MarkInfo
        pdf.Root["/MarkInfo"] = pikepdf.Dictionary(Marked=pikepdf.Boolean(True))

        # Build structure tree
        doc_elem = pikepdf.Dictionary(
            S=pikepdf.Name("/Document"),
            K=pikepdf.Array(),
        )

        # Group elements by page to associate /Pg references
        page_map: dict[int, pikepdf.Object] = {}
        for i, page in enumerate(pdf.pages):
            page_map[i + 1] = page.obj  # 1-indexed

        for assignment in assignments:
            elem_id = assignment["element_id"]
            role_str = assignment.get("role", "P")
            alt_text = assignment.get("alt_text", "")

            if role_str == "Artifact":
                continue

            pikepdf_role = ROLE_MAP.get(role_str, "P")

            # Parse page number from element_id (format: "p{page}_e{idx}" or "p{page}_img{idx}")
            try:
                page_num = int(elem_id.split("_")[0][1:])
            except (ValueError, IndexError):
                page_num = 1

            child = pikepdf.Dictionary(
                S=pikepdf.Name(f"/{pikepdf_role}"),
            )

            if page_num in page_map:
                child["/Pg"] = page_map[page_num]

            if alt_text and role_str == "Figure":
                child["/Alt"] = alt_text

            doc_elem["/K"].append(child)
            tagged_count += 1

        # Only add struct tree if we tagged something
        if tagged_count > 0:
            struct_root = pikepdf.Dictionary(
                Type=pikepdf.Name("/StructTreeRoot"),
                K=pikepdf.Array([doc_elem]),
            )
            pdf.Root["/StructTreeRoot"] = pdf.make_indirect(struct_root)

        pdf.save(output_path)

    return tagged_count
