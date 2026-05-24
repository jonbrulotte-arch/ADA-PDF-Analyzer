"""
HTML compliance report renderer. No external dependencies — pure Python string generation.
"""

from datetime import datetime, timezone

from .models import AccessibilityReport, CheckStatus, SessionState


_STATUS_ICON = {
    CheckStatus.PASS: "✅",
    CheckStatus.FAIL: "❌",
    CheckStatus.WARNING: "⚠️",
    CheckStatus.INFO: "ℹ️",
}

_STATUS_LABEL = {
    CheckStatus.PASS: "Pass",
    CheckStatus.FAIL: "Fail",
    CheckStatus.WARNING: "Warning",
    CheckStatus.INFO: "Info",
}


def _score_color(score: int) -> str:
    if score >= 75:
        return "#2e7d32"   # green
    if score >= 50:
        return "#e65100"   # amber
    return "#c62828"       # red


def _h(text: str) -> str:
    """HTML-escape a string."""
    return (
        text
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def render_html_report(report: AccessibilityReport, state: SessionState) -> str:
    score = report.summary.score
    grade = report.summary.grade
    color = _score_color(score)
    approved_ids = set(state.approved_fix_ids)
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    # Build check rows
    check_rows = []
    for check in report.checks:
        icon = _STATUS_ICON.get(check.status, "ℹ️")
        label = _STATUS_LABEL.get(check.status, str(check.status))

        wcag = _h(check.wcag_criterion or "—")
        severity = _h(check.severity.value.capitalize())

        # Fix status column
        if check.fix and check.fix.id in approved_ids:
            fix_status = '<span style="color:#2e7d32;font-weight:bold">Fix Applied</span>'
        elif check.fix:
            fix_status = '<span style="color:#1565c0">Fix Available</span>'
        else:
            fix_status = '<span style="color:#757575">Manual Review</span>'

        # Details list
        details_html = ""
        if check.details:
            items = "".join(f"<li>{_h(d)}</li>" for d in check.details)
            details_html = f"<ul style='margin:4px 0 0 16px;padding:0;font-size:12px;color:#555'>{items}</ul>"

        # Acknowledgment note
        ack_html = ""
        ack_note = state.acknowledgments.get(check.id)
        if ack_note:
            ack_html = (
                f'<div style="margin-top:4px;font-size:12px;color:#6a1b9a;">'
                f'<strong>Note:</strong> {_h(ack_note)}</div>'
            )

        # Row background
        if check.status == CheckStatus.FAIL:
            row_bg = "#fff8f8"
        elif check.status == CheckStatus.WARNING:
            row_bg = "#fffde7"
        elif check.status == CheckStatus.PASS:
            row_bg = "#f1f8e9"
        else:
            row_bg = "#f5f5f5"

        row = (
            f'<tr style="background:{row_bg};border-bottom:1px solid #e0e0e0;">'
            f'<td style="padding:8px 10px;font-weight:500;font-size:13px">{_h(check.name)}</td>'
            f'<td style="padding:8px 10px;text-align:center;font-size:16px" title="{label}">{icon}</td>'
            f'<td style="padding:8px 10px;font-size:12px;color:#444">{wcag}</td>'
            f'<td style="padding:8px 10px;font-size:12px">{severity}</td>'
            f'<td style="padding:8px 10px;font-size:12px">{fix_status}</td>'
            f'<td style="padding:8px 10px;font-size:12px">'
            f'{_h(check.description)}{details_html}{ack_html}'
            f'</td>'
            f'</tr>'
        )
        check_rows.append(row)

    check_table_rows = "\n".join(check_rows)

    # Applied fixes section
    applied_fixes: list[str] = []
    for check in report.checks:
        if check.fix and check.fix.id in approved_ids:
            applied_fixes.append(f"<li>{_h(check.fix.description)}</li>")

    if applied_fixes:
        applied_fixes_section = (
            '<section style="margin-bottom:32px;page-break-inside:avoid">'
            '<h2 style="font-size:16px;color:#1565c0;border-bottom:2px solid #1565c0;padding-bottom:6px;margin-bottom:12px">'
            'Applied Fixes</h2>'
            f'<ul style="margin:0;padding-left:20px;line-height:1.8;font-size:13px">{"".join(applied_fixes)}</ul>'
            '</section>'
        )
    else:
        applied_fixes_section = ""

    # Acknowledgments section
    ack_entries: list[str] = []
    if state.acknowledgments:
        for check_id, note in state.acknowledgments.items():
            # Find check name
            check_name = check_id
            for check in report.checks:
                if check.id == check_id:
                    check_name = check.name
                    break
            ack_entries.append(
                f'<li><strong>{_h(check_name)}:</strong> {_h(note)}</li>'
            )

    if ack_entries:
        ack_section = (
            '<section style="margin-bottom:32px;page-break-inside:avoid">'
            '<h2 style="font-size:16px;color:#6a1b9a;border-bottom:2px solid #6a1b9a;padding-bottom:6px;margin-bottom:12px">'
            'Acknowledgments &amp; Notes</h2>'
            f'<ul style="margin:0;padding-left:20px;line-height:1.8;font-size:13px">{"".join(ack_entries)}</ul>'
            '</section>'
        )
    else:
        ack_section = ""

    # Scanned document warning
    scanned_warning = ""
    if report.is_scanned:
        scanned_warning = (
            '<div style="background:#fff3e0;border-left:4px solid #e65100;padding:12px 16px;'
            'margin-bottom:24px;border-radius:0 4px 4px 0;font-size:13px;">'
            '<strong>⚠️ Scanned PDF Detected:</strong> This document appears to be a scanned image. '
            'Most accessibility checks cannot be applied without a text layer. '
            'Run OCR processing before attempting remediation.'
            '</div>'
        )

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Accessibility Report — {_h(report.filename)}</title>
<style>
  *, *::before, *::after {{ box-sizing: border-box; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    margin: 0;
    padding: 24px 32px;
    color: #212121;
    background: #ffffff;
    font-size: 14px;
    line-height: 1.5;
  }}
  @media print {{
    body {{ padding: 16px; }}
    .no-print {{ display: none !important; }}
    section {{ page-break-inside: avoid; }}
    table {{ page-break-inside: auto; }}
    tr {{ page-break-inside: avoid; page-break-after: auto; }}
  }}
  h1 {{ font-size: 22px; margin: 0 0 4px; }}
  h2 {{ font-size: 16px; margin: 0 0 12px; }}
  table {{ width: 100%; border-collapse: collapse; }}
  th {{
    background: #37474f;
    color: #fff;
    padding: 10px 10px;
    text-align: left;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.03em;
  }}
  td {{ vertical-align: top; }}
  .score-badge {{
    display: inline-block;
    font-size: 48px;
    font-weight: 900;
    color: {color};
    line-height: 1;
  }}
  .grade-badge {{
    display: inline-block;
    font-size: 28px;
    font-weight: 700;
    color: {color};
    margin-left: 12px;
    vertical-align: bottom;
  }}
  .stat-card {{
    display: inline-block;
    text-align: center;
    min-width: 110px;
    padding: 12px 16px;
    border-radius: 6px;
    margin-right: 12px;
    margin-bottom: 8px;
  }}
  .stat-num {{ font-size: 28px; font-weight: 700; }}
  .stat-label {{ font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }}
</style>
</head>
<body>

<!-- Header -->
<section style="margin-bottom:28px;">
  <h1>PDF Accessibility Report</h1>
  <p style="color:#555;margin:2px 0 0;">{_h(report.filename)} &nbsp;·&nbsp; {_h(now_str)}</p>
  <p style="color:#555;margin:2px 0 0;font-size:12px;">
    {report.page_count} page(s) &nbsp;·&nbsp; {report.file_size_kb} KB
    &nbsp;·&nbsp; Session: {_h(report.session_id[:8])}
  </p>
  <div style="margin-top:16px;">
    <span class="score-badge">{score}</span><span style="font-size:22px;color:#777">/100</span>
    <span class="grade-badge">Grade: {_h(grade)}</span>
  </div>
</section>

<!-- Summary Stats -->
<section style="margin-bottom:28px;">
  <div>
    <div class="stat-card" style="background:#e8f5e9;color:#2e7d32;">
      <div class="stat-num">{report.summary.passed}</div>
      <div class="stat-label">Passed</div>
    </div>
    <div class="stat-card" style="background:#ffebee;color:#c62828;">
      <div class="stat-num">{report.summary.failed}</div>
      <div class="stat-label">Failed</div>
    </div>
    <div class="stat-card" style="background:#fffde7;color:#f57f17;">
      <div class="stat-num">{report.summary.warnings}</div>
      <div class="stat-label">Warnings</div>
    </div>
    <div class="stat-card" style="background:#fce4ec;color:#880e4f;">
      <div class="stat-num">{report.summary.critical_failures}</div>
      <div class="stat-label">Critical</div>
    </div>
  </div>
</section>

{scanned_warning}

<!-- Check Results Table -->
<section style="margin-bottom:32px;">
  <h2 style="font-size:16px;color:#37474f;border-bottom:2px solid #37474f;padding-bottom:6px;margin-bottom:12px;">
    Check Results
  </h2>
  <table>
    <thead>
      <tr>
        <th style="width:18%">Check</th>
        <th style="width:6%;text-align:center">Status</th>
        <th style="width:8%">WCAG</th>
        <th style="width:8%">Severity</th>
        <th style="width:12%">Fix Status</th>
        <th>Description &amp; Details</th>
      </tr>
    </thead>
    <tbody>
{check_table_rows}
    </tbody>
  </table>
</section>

{applied_fixes_section}

{ack_section}

<!-- Footer -->
<footer style="margin-top:40px;padding-top:16px;border-top:1px solid #e0e0e0;font-size:11px;color:#9e9e9e;">
  <p style="margin:0;">
    Generated by ADA PDF Analyzer &nbsp;·&nbsp; {_h(now_str)}
  </p>
  <p style="margin:4px 0 0;">
    <strong>Disclaimer:</strong> This report is an automated assessment and may not capture all accessibility issues.
    A manual review by an accessibility specialist is recommended for full WCAG 2.1 AA and PDF/UA compliance.
  </p>
</footer>

</body>
</html>"""

    return html
