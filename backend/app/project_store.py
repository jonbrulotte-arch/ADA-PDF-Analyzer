"""
Persistence layer for Projects.
Storage: {STORAGE_DIR}/projects/{project_id}.json
"""

import os
from datetime import datetime, timezone
from pathlib import Path

from .models import Project, ProjectRevision, ProjectStatus, ProjectSummary

STORAGE_DIR = Path(os.getenv("STORAGE_DIR", "./storage"))
_PROJECTS_DIR = STORAGE_DIR / "projects"


def _ensure() -> None:
    _PROJECTS_DIR.mkdir(parents=True, exist_ok=True)


_ensure()


def _project_path(project_id: str) -> Path:
    return _PROJECTS_DIR / f"{project_id}.json"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _to_summary(p: Project) -> ProjectSummary:
    latest = p.revisions[0] if p.revisions else None
    return ProjectSummary(
        project_id=p.project_id,
        name=p.name,
        assignee=p.assignee,
        status=p.status,
        tags=p.tags,
        latest_score=latest.score if latest else None,
        latest_grade=latest.grade if latest else None,
        revision_count=len(p.revisions),
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


def create_project(project: Project) -> Project:
    _ensure()
    _project_path(project.project_id).write_text(project.model_dump_json(indent=2))
    return project


def load_project(project_id: str) -> Project | None:
    p = _project_path(project_id)
    try:
        if p.exists():
            return Project.model_validate_json(p.read_text())
    except Exception:
        pass
    return None


def save_project(project: Project) -> None:
    _ensure()
    project.updated_at = _now()
    _project_path(project.project_id).write_text(project.model_dump_json(indent=2))


def list_projects(
    search: str | None = None,
    status: ProjectStatus | None = None,
    assignee: str | None = None,
    sort: str = "updated_at",
    order: str = "desc",
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[ProjectSummary], int]:
    _ensure()
    projects: list[Project] = []
    for f in _PROJECTS_DIR.glob("*.json"):
        try:
            projects.append(Project.model_validate_json(f.read_text()))
        except Exception:
            continue

    # Filter
    if search:
        q = search.lower()
        projects = [p for p in projects if q in p.name.lower()]
    if status:
        projects = [p for p in projects if p.status == status]
    if assignee:
        projects = [p for p in projects if assignee.lower() in p.assignee.lower()]

    # Sort
    reverse = order == "desc"
    def sort_key(p: Project):
        if sort == "name":
            return p.name.lower()
        if sort == "created_at":
            return p.created_at
        if sort == "latest_score":
            return p.revisions[0].score if p.revisions else -1
        return p.updated_at  # default

    projects.sort(key=sort_key, reverse=reverse)

    total = len(projects)
    page = projects[offset: offset + limit]
    return [_to_summary(p) for p in page], total


def delete_project(project_id: str) -> bool:
    p = _project_path(project_id)
    if not p.exists():
        return False
    p.unlink()
    return True


def add_revision(project_id: str, revision: ProjectRevision) -> Project | None:
    project = load_project(project_id)
    if project is None:
        return None
    # Remove any existing entry for this session_id
    project.revisions = [r for r in project.revisions if r.session_id != revision.session_id]
    # Insert at front (newest first)
    project.revisions.insert(0, revision)
    save_project(project)
    return project


def update_revision(
    project_id: str, session_id: str,
    label: str | None, notes: str | None,
    score: int | None = None, grade: str | None = None,
) -> ProjectRevision | None:
    project = load_project(project_id)
    if project is None:
        return None
    for rev in project.revisions:
        if rev.session_id == session_id:
            if label is not None:
                rev.label = label
            if notes is not None:
                rev.notes = notes
            if score is not None:
                rev.score = score
            if grade is not None:
                rev.grade = grade
            save_project(project)
            return rev
    return None


def remove_revision(project_id: str, session_id: str) -> bool:
    project = load_project(project_id)
    if project is None:
        return False
    before = len(project.revisions)
    project.revisions = [r for r in project.revisions if r.session_id != session_id]
    if len(project.revisions) == before:
        return False
    save_project(project)
    return True
