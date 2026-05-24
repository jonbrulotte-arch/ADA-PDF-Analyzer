from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from enum import Enum


class CheckStatus(str, Enum):
    PASS = "pass"
    FAIL = "fail"
    WARNING = "warning"
    INFO = "info"


class Severity(str, Enum):
    CRITICAL = "critical"
    MAJOR = "major"
    MINOR = "minor"


class FixType(str, Enum):
    METADATA_TITLE = "metadata_title"
    METADATA_LANGUAGE = "metadata_language"
    ALT_TEXT = "alt_text"
    BOOKMARKS = "bookmarks"
    FORM_TOOLTIP = "form_tooltip"
    PDFUA_IDENTIFIER = "pdfua_identifier"


class FixAction(BaseModel):
    id: str
    description: str
    auto_fixable: bool
    fix_type: FixType
    fix_data: Dict[str, Any] = {}


class AccessibilityCheck(BaseModel):
    id: str
    category: str
    name: str
    wcag_criterion: Optional[str] = None
    pdf_ua_criterion: Optional[str] = None
    status: CheckStatus
    severity: Severity
    description: str
    details: List[str] = []
    fix: Optional[FixAction] = None


class ScoreSummary(BaseModel):
    score: int
    grade: str
    total_checks: int
    passed: int
    failed: int
    warnings: int
    critical_failures: int


class AccessibilityReport(BaseModel):
    session_id: str
    filename: str
    page_count: int
    file_size_kb: int
    is_scanned: bool
    created_at: str
    checks: List[AccessibilityCheck]
    summary: ScoreSummary


class UploadResponse(BaseModel):
    session_id: str
    filename: str
    page_count: int
    file_size_kb: int


class RemediateRequest(BaseModel):
    approved_fix_ids: List[str]


class RemediateResponse(BaseModel):
    session_id: str
    changes_made: List[str]
    download_url: str
