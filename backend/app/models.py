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


class Finding(BaseModel):
    id: str
    page: Optional[int] = None          # 1-indexed page number
    element_type: str                   # "image","link","form_field","heading","table","font","document","text"
    element_label: str                  # "Image #3", "Link: 'click here'", "Document Title"
    infringing_text: Optional[str] = None  # the problematic content
    recommended_fix: str
    editor: str = "none"               # "none" | "text" | "textarea"
    field_key: Optional[str] = None    # key for storing user value in finding_values
    placeholder: Optional[str] = None  # editor placeholder/default


class ProjectStatus(str, Enum):
    ACTIVE     = "active"
    IN_REVIEW  = "in_review"
    REMEDIATED = "remediated"
    APPROVED   = "approved"
    ARCHIVED   = "archived"


class ProjectRevision(BaseModel):
    session_id:   str
    filename:     str
    score:        int
    grade:        str
    page_count:   int
    file_size_kb: int
    created_at:   str
    label:        str = ""   # e.g. "v1", "After OCR", "Client copy"
    notes:        str = ""


class Project(BaseModel):
    project_id:  str
    name:        str
    description: str = ""
    assignee:    str = ""
    status:      ProjectStatus = ProjectStatus.ACTIVE
    tags:        List[str] = []
    created_at:  str
    updated_at:  str
    revisions:   List[ProjectRevision] = []   # newest first


class ProjectSummary(BaseModel):
    project_id:     str
    name:           str
    assignee:       str
    status:         ProjectStatus
    tags:           List[str]
    latest_score:   Optional[int] = None
    latest_grade:   Optional[str] = None
    revision_count: int
    created_at:     str
    updated_at:     str


class CreateProjectRequest(BaseModel):
    name:        str
    description: str = ""
    assignee:    str = ""
    status:      ProjectStatus = ProjectStatus.ACTIVE
    tags:        List[str] = []


class PatchProjectRequest(BaseModel):
    name:        Optional[str] = None
    description: Optional[str] = None
    assignee:    Optional[str] = None
    status:      Optional[ProjectStatus] = None
    tags:        Optional[List[str]] = None


class PatchRevisionRequest(BaseModel):
    label: Optional[str] = None
    notes: Optional[str] = None


class LinkSessionRequest(BaseModel):
    session_id: str
    label:      str = ""
    notes:      str = ""


class ProjectListResponse(BaseModel):
    projects: List[ProjectSummary]
    total:    int


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
    findings: List[Finding] = []


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
    project_id: str = ""


class RemediateRequest(BaseModel):
    approved_fix_ids: List[str]
    custom_alt_texts: Dict[str, str] = {}   # figure_index_str → alt text (overrides placeholders)
    acknowledgments: Dict[str, str] = {}    # check_id → note (stored in session state)
    finding_values: Dict[str, str] = {}   # field_key → user value (overrides fix_data defaults)


class RemediateResponse(BaseModel):
    session_id: str
    changes_made: List[str]
    download_url: str


class SessionState(BaseModel):
    session_id: str
    approved_fix_ids: List[str] = []
    custom_alt_texts: Dict[str, str] = {}   # figure_index_str → alt text
    acknowledgments: Dict[str, str] = {}    # check_id → note
    reanalysis_done: bool = False
    score_before: Optional[int] = None
    score_after: Optional[int] = None
    updated_at: str = ""
    finding_values: Dict[str, str] = {}   # field_key → user-edited value


class AppSettings(BaseModel):
    ai_alt_text_enabled: bool = False


class AppSettingsResponse(AppSettings):
    has_api_key: bool


class BatchSessionSummary(BaseModel):
    session_id: str
    filename: str
    score: int
    grade: str
    page_count: int
    status: str   # "done" | "error"
    error: Optional[str] = None


class BatchManifest(BaseModel):
    batch_id: str
    created_at: str
    sessions: List[BatchSessionSummary]


class HistoryEntry(BaseModel):
    session_id: str
    filename: str
    score: int
    grade: str
    page_count: int
    file_size_kb: int
    created_at: str


class AltTextResponse(BaseModel):
    check_id: str
    alt_texts: Dict[str, str]   # figure_index → generated text


class ReanalyzeResponse(BaseModel):
    session_id: str
    score_before: int
    score_after: int
    new_report: AccessibilityReport


class BatchUploadResponse(BaseModel):
    batch_id: str
    sessions: List[BatchSessionSummary]


class PatchStateRequest(BaseModel):
    approved_fix_ids: Optional[List[str]] = None
    custom_alt_texts: Optional[Dict[str, str]] = None
    acknowledgments: Optional[Dict[str, str]] = None
    finding_values: Optional[Dict[str, str]] = None
