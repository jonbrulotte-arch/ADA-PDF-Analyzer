import json
import os
import uuid
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .analyzer import analyze_pdf
from .models import AccessibilityReport, RemediateRequest, RemediateResponse, UploadResponse
from .remediator import apply_fixes

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

STORAGE_DIR = Path(os.getenv("STORAGE_DIR", "./storage"))
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_MB", "50")) * 1024 * 1024

for _d in ("uploads", "reports", "remediated"):
    (STORAGE_DIR / _d).mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="ADA PDF Analyzer", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _session_dir(session_id: str) -> Path:
    d = STORAGE_DIR / "uploads" / session_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def _report_path(session_id: str) -> Path:
    return STORAGE_DIR / "reports" / f"{session_id}.json"


def _load_report(session_id: str) -> AccessibilityReport:
    p = _report_path(session_id)
    if not p.exists():
        raise HTTPException(404, f"Report not found for session {session_id}")
    return AccessibilityReport.model_validate_json(p.read_text())


def _save_report(report: AccessibilityReport) -> None:
    _report_path(report.session_id).write_text(report.model_dump_json(indent=2))


def _get_filename(session_id: str) -> str:
    meta = _session_dir(session_id) / "meta.json"
    if meta.exists():
        return json.loads(meta.read_text()).get("filename", "document.pdf")
    return "document.pdf"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/upload", response_model=UploadResponse)
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are accepted.")

    session_id = str(uuid.uuid4())
    sdir = _session_dir(session_id)
    dest = sdir / "original.pdf"

    size = 0
    with dest.open("wb") as f:
        chunk = await file.read(65536)
        while chunk:
            size += len(chunk)
            if size > MAX_UPLOAD_BYTES:
                dest.unlink(missing_ok=True)
                raise HTTPException(413, f"File exceeds {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.")
            f.write(chunk)
            chunk = await file.read(65536)

    try:
        import fitz
        doc = fitz.open(str(dest))
        page_count = doc.page_count
        doc.close()
    except Exception as e:
        dest.unlink(missing_ok=True)
        raise HTTPException(422, f"Could not open PDF: {e}")

    # Persist metadata so later endpoints know the original filename
    (sdir / "meta.json").write_text(json.dumps({"filename": file.filename, "size_kb": size // 1024}))

    return UploadResponse(
        session_id=session_id,
        filename=file.filename,
        page_count=page_count,
        file_size_kb=size // 1024,
    )


@app.get("/api/report/{session_id}", response_model=AccessibilityReport)
def get_report(session_id: str):
    """Analyze the uploaded PDF (cached after first run)."""
    if _report_path(session_id).exists():
        return _load_report(session_id)

    pdf_path = _session_dir(session_id) / "original.pdf"
    if not pdf_path.exists():
        raise HTTPException(404, "No uploaded PDF found for this session.")

    filename = _get_filename(session_id)

    try:
        report = analyze_pdf(str(pdf_path), session_id, filename)
    except Exception as e:
        raise HTTPException(500, f"Analysis failed: {e}")

    _save_report(report)
    return report


@app.post("/api/remediate/{session_id}", response_model=RemediateResponse)
def remediate_pdf(session_id: str, body: RemediateRequest):
    report = _load_report(session_id)
    input_path = str(_session_dir(session_id) / "original.pdf")
    output_path = str(STORAGE_DIR / "remediated" / f"{session_id}.pdf")

    try:
        changes = apply_fixes(report, body.approved_fix_ids, input_path, output_path)
    except Exception as e:
        raise HTTPException(500, f"Remediation failed: {e}")

    return RemediateResponse(
        session_id=session_id,
        changes_made=changes,
        download_url=f"/api/download/{session_id}",
    )


@app.get("/api/download/{session_id}")
def download_pdf(session_id: str):
    output_path = STORAGE_DIR / "remediated" / f"{session_id}.pdf"
    if not output_path.exists():
        raise HTTPException(404, "Remediated PDF not found. Apply fixes first.")

    filename = _get_filename(session_id)
    safe_name = filename.replace(".pdf", "-accessible.pdf")

    return FileResponse(
        str(output_path),
        media_type="application/pdf",
        filename=safe_name,
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )
