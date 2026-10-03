import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.encoders import jsonable_encoder
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.auth import require_officer
from app.db.database import get_db
from app.db.models import (
    Inspection,
    InspectionComment,
    InspectionFinding,
    InspectionObservation,
    InspectionReport,
    User,
)
from app.reports.service import (
    build_initial_assessment,
    build_officer_verified_report,
    render_docx,
    render_pdf,
)
from app.schemas.inspection import (
    CommentCreate,
    FindingCreate,
    FindingVerification,
    InspectionCreate,
    ObservationCreate,
    VerificationCreate,
)


router = APIRouter()


# ============================================================
# HELPERS
# ============================================================

def _get(db: Session, inspection_id: int) -> Inspection:
    """
    Get an inspection by ID.
    """
    inspection = db.get(Inspection, inspection_id)

    if inspection is None:
        raise HTTPException(
            status_code=404,
            detail="Inspection not found",
        )

    return inspection


def _finding_dict(
    finding: InspectionFinding,
    finding_number: int | None = None,
) -> dict[str, Any]:
    """
    Convert an InspectionFinding database object into
    the JSON structure consumed by the frontend.
    """

    return {
        "finding_id": finding.id,
        "finding_number": finding_number,

        "source": finding.source,
        "category": finding.category,
        "title": finding.title,
        "description": finding.description,
        "applicable_rule": finding.applicable_rule,

        # Preserve original AI assessment.
        "original_ai_status": finding.original_ai_status,
        "ai_confidence": finding.ai_confidence,

        "ai_description": (
            finding.description
            if finding.source == "AI"
            else None
        ),

        "ai_rule": (
            finding.applicable_rule
            if finding.source == "AI"
            else None
        ),

        "ai_evidence": finding.ai_evidence,

        # Current status.
        "status": finding.status,

        # Human verification data.
        "officer_decision": finding.officer_decision,
        "officer_comment": finding.officer_comment,
        "verified_by": finding.verified_by,
        "verified_at": finding.verified_at,

        # Evidence.
        "evidence": finding.evidence_data,
    }


def _inspection_dict(
    inspection: Inspection,
) -> dict[str, Any]:
    """
    Convert an Inspection database object into
    the JSON structure used by the frontend and reports.
    """

    return {
        "id": inspection.id,

        "status": inspection.status,
        "final_outcome": inspection.final_outcome,

        "verified_by": inspection.verified_by,
        "verified_at": inspection.verified_at,

        "product": inspection.product_data,
        "assessment": inspection.assessment_data,

        "findings": [
            _finding_dict(item)
            for item in inspection.findings
        ],

        "observations": [
            {
                "observation_id": item.id,
                "description": item.description,
                "rule": item.rule,
                "status": item.status,
                "evidence": item.evidence_data,
                "officer": item.officer_id,
                "timestamp": item.created_at,
            }
            for item in inspection.observations
        ],

        "comments": [
            {
                "comment_id": item.id,
                "finding_id": item.finding_id,
                "comment": item.comment,
                "officer": item.officer_id,
                "timestamp": item.created_at,
            }
            for item in inspection.comments
        ],

        "evidence": inspection.evidence_data,

        "reports": [
            {
                "report_id": item.id,
                "report_type": item.report_type,
                "status": item.status,
                "generated_at": item.generated_at,
                "file_path": item.file_path,
                "version": item.version,
            }
            for item in inspection.reports
        ],
    }


def _require_verified(
    inspection: Inspection,
) -> None:
    """
    Check whether an inspection is ready for the
    officer-verified final report.

    IMPORTANT:

    Only AI findings whose current/original status is
    NEEDS_VERIFICATION require an officer decision.

    COMPLIANT findings do not need human verification.

    POTENTIAL_VIOLATION findings do not need human
    verification unless the AI explicitly classified
    them as NEEDS_VERIFICATION.
    """

    pending_findings = [
        finding
        for finding in inspection.findings
        if (
            finding.source == "AI"
            and str(
                finding.status
                or finding.original_ai_status
                or ""
            ).upper()
            == "NEEDS_VERIFICATION"
            and finding.officer_decision is None
        )
    ]

    if pending_findings:
        raise HTTPException(
            status_code=409,
            detail=(
                "Human verification is still required for "
                f"{len(pending_findings)} finding(s)."
            ),
        )

    # All required findings have been reviewed.
    inspection.status = "VERIFIED"


def _persist_report(
    db: Session,
    inspection: Inspection,
    officer: User,
    report: dict[str, Any],
    report_type: str,
    payload: bytes,
    mime_type: str,
    suffix: str,
) -> InspectionReport:
    """
    Save a generated report to disk and register it
    in the database.
    """

    report_data = jsonable_encoder(report)

    directory = Path("generated_reports")
    directory.mkdir(exist_ok=True)

    path = (
        directory
        / f"inspection-{inspection.id}-{report_type.lower()}.{suffix}"
    )

    path.write_bytes(payload)

    record = InspectionReport(
        inspection_id=inspection.id,
        report_type=report_type,
        status="GENERATED",
        generated_by=officer.id,
        file_path=str(path),
        mime_type=mime_type,
        report_data=report_data,
    )

    db.add(record)
    db.commit()
    db.refresh(record)

    return record


# ============================================================
# CREATE INSPECTION
# ============================================================

@router.post(
    "/inspections",
    status_code=status.HTTP_201_CREATED,
)
def create_inspection(
    payload: InspectionCreate,
    db: Session = Depends(get_db),
    officer: User = Depends(require_officer),
) -> dict[str, Any]:

    # Build the initial AI assessment.
    assessment = build_initial_assessment(
        payload.product
    )

    # Create inspection.
    inspection = Inspection(
        user_id=officer.id,
        product_data=payload.product,
        assessment_data=assessment,
        evidence_data=payload.evidence,
    )

    db.add(inspection)
    db.flush()

    # Convert AI rule results into inspection findings.
    for result in assessment["rule_results"]:

        finding = InspectionFinding(
            inspection_id=inspection.id,

            source="AI",

            category=result.get(
                "category",
                "Other",
            ),

            title=(
                result["rule_title"]
                or "AI assessment finding"
            ),

            description=(
                result["explanation"]
                or "AI assessment result."
            ),

            applicable_rule=result[
                "rule_number"
            ],

            original_ai_status=result[
                "status"
            ],

            ai_confidence=result[
                "confidence"
            ],

            ai_evidence=result[
                "evidence"
            ],

            status=result[
                "status"
            ],

            evidence_data=[],
        )

        db.add(finding)

    db.commit()
    db.refresh(inspection)

    return _inspection_dict(inspection)


# ============================================================
# INSPECTION HISTORY
# ============================================================

@router.get(
    "/inspections/history",
)
def inspection_history(
    db: Session = Depends(get_db),
    officer: User = Depends(require_officer),
) -> list[dict[str, Any]]:

    inspections = db.scalars(
        select(Inspection).order_by(
            Inspection.created_at.desc()
        )
    ).all()

    return [
        {
            "id": item.id,
            "status": item.status,
            "final_outcome": item.final_outcome,
            "created_at": item.created_at,

            "reports": [
                {
                    "report_id": report.id,
                    "report_type": report.report_type,
                    "status": report.status,
                    "generated_at": report.generated_at,
                }
                for report in item.reports
            ],
        }
        for item in inspections
    ]


# ============================================================
# READ SINGLE INSPECTION
# ============================================================

@router.get(
    "/inspections/{inspection_id}",
)
def read_inspection(
    inspection_id: int,
    db: Session = Depends(get_db),
    officer: User = Depends(require_officer),
) -> dict[str, Any]:

    inspection = _get(
        db,
        inspection_id,
    )

    return _inspection_dict(inspection)


# ============================================================
# READ INITIAL ASSESSMENT
# ============================================================

@router.get(
    "/inspections/{inspection_id}/assessment",
)
def read_assessment(
    inspection_id: int,
    db: Session = Depends(get_db),
    officer: User = Depends(require_officer),
) -> dict[str, Any]:

    inspection = _get(
        db,
        inspection_id,
    )

    return inspection.assessment_data


# ============================================================
# READ FINDINGS
# ============================================================

@router.get(
    "/inspections/{inspection_id}/findings",
)
def read_findings(
    inspection_id: int,
    db: Session = Depends(get_db),
    officer: User = Depends(require_officer),
) -> list[dict[str, Any]]:

    inspection = _get(
        db,
        inspection_id,
    )

    findings = inspection.findings

    return [
        _finding_dict(
            item,
            finding_number=index,
        )
        for index, item in enumerate(
            findings,
            start=1,
        )
    ]


# ============================================================
# ADD OFFICER FINDING
# ============================================================

@router.post(
    "/inspections/{inspection_id}/findings",
    status_code=status.HTTP_201_CREATED,
)
def add_finding(
    inspection_id: int,
    payload: FindingCreate,
    db: Session = Depends(get_db),
    officer: User = Depends(require_officer),
) -> dict[str, Any]:

    _get(
        db,
        inspection_id,
    )

    finding = InspectionFinding(
        inspection_id=inspection_id,

        source="OFFICER",

        category=payload.category,
        title=payload.title,
        description=payload.description,
        applicable_rule=payload.applicable_rule,

        status=payload.status,

        officer_comment=payload.officer_comment,

        verified_by=officer.id,
        verified_at=datetime.now(timezone.utc),

        evidence_data=payload.evidence,
    )

    db.add(finding)
    db.commit()
    db.refresh(finding)

    # Save officer comment in inspection history.
    if payload.officer_comment:

        db.add(
            InspectionComment(
                inspection_id=inspection_id,
                finding_id=finding.id,
                comment=payload.officer_comment,
                officer_id=officer.id,
            )
        )

        db.commit()

    return _finding_dict(finding)


# ============================================================
# VERIFY ONE AI FINDING
# ============================================================

@router.patch(
    "/inspections/{inspection_id}/findings/{finding_id}/verify",
)
def verify_finding(
    inspection_id: int,
    finding_id: int,
    payload: FindingVerification,
    db: Session = Depends(get_db),
    officer: User = Depends(require_officer),
) -> dict[str, Any]:

    # --------------------------------------------------------
    # GET INSPECTION
    # --------------------------------------------------------

    inspection = _get(
        db,
        inspection_id,
    )

    # --------------------------------------------------------
    # GET FINDING
    # --------------------------------------------------------

    finding = db.scalar(
        select(InspectionFinding).where(
            InspectionFinding.id == finding_id,
            InspectionFinding.inspection_id == inspection_id,
        )
    )

    if finding is None:
        raise HTTPException(
            status_code=404,
            detail="Finding not found",
        )

    # --------------------------------------------------------
    # ONLY AI FINDINGS CAN BE VERIFIED
    # --------------------------------------------------------

    if finding.source != "AI":
        raise HTTPException(
            status_code=400,
            detail="Only AI findings can be verified.",
        )

    # --------------------------------------------------------
    # ONLY NEEDS_VERIFICATION FINDINGS NEED REVIEW
    # --------------------------------------------------------

    current_status = str(
        finding.status
        or finding.original_ai_status
        or ""
    ).upper()

    if current_status != "NEEDS_VERIFICATION":
        raise HTTPException(
            status_code=400,
            detail=(
                "This finding does not require human "
                "verification. Only NEEDS_VERIFICATION "
                "findings can be reviewed."
            ),
        )

    # --------------------------------------------------------
    # VALIDATE OFFICER DECISION
    # --------------------------------------------------------

    allowed_decisions = {
        "CONFIRM_VIOLATION",
        "KEEP_COMPLIANT",
        "NEEDS_FURTHER_INSPECTION",
    }

    if payload.officer_decision not in allowed_decisions:
        raise HTTPException(
            status_code=422,
            detail=(
                "Invalid officer decision. Use "
                "CONFIRM_VIOLATION, KEEP_COMPLIANT, "
                "or NEEDS_FURTHER_INSPECTION."
            ),
        )

    # --------------------------------------------------------
    # OPTIONAL OFFICER COMMENT
    # --------------------------------------------------------

    comment = None

    if payload.officer_comment:
        comment = payload.officer_comment.strip()

    # --------------------------------------------------------
    # SAVE OFFICER DECISION
    # --------------------------------------------------------

    finding.officer_decision = (
        payload.officer_decision
    )

    finding.officer_comment = comment

    finding.verified_by = officer.id

    finding.verified_at = datetime.now(
        timezone.utc
    )

    # --------------------------------------------------------
    # UPDATE CURRENT FINDING STATUS
    # --------------------------------------------------------

    if payload.officer_decision == "CONFIRM_VIOLATION":

        finding.status = "POTENTIAL_VIOLATION"

    elif payload.officer_decision == "KEEP_COMPLIANT":

        finding.status = "COMPLIANT"

    elif payload.officer_decision == "NEEDS_FURTHER_INSPECTION":

        # It remains unresolved.
        finding.status = "NEEDS_VERIFICATION"

    # --------------------------------------------------------
    # SAVE COMMENT TO INSPECTION HISTORY
    # --------------------------------------------------------

    if comment:

        db.add(
            InspectionComment(
                inspection_id=inspection_id,
                finding_id=finding.id,
                comment=comment,
                officer_id=officer.id,
            )
        )

    # --------------------------------------------------------
    # COMMIT
    # --------------------------------------------------------

    try:

        db.commit()

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Failed to save officer verification.",
        )

    db.refresh(finding)

    return _finding_dict(finding)


# ============================================================
# ADD OBSERVATION
# ============================================================

@router.post(
    "/inspections/{inspection_id}/observations",
    status_code=status.HTTP_201_CREATED,
)
def add_observation(
    inspection_id: int,
    payload: ObservationCreate,
    db: Session = Depends(get_db),
    officer: User = Depends(require_officer),
) -> dict[str, Any]:

    _get(
        db,
        inspection_id,
    )

    observation = InspectionObservation(
        inspection_id=inspection_id,

        description=payload.description,
        rule=payload.rule,
        status=payload.status,

        evidence_data=payload.evidence,

        officer_id=officer.id,
    )

    db.add(observation)
    db.commit()
    db.refresh(observation)

    return {
        "observation_id": observation.id,
        "description": observation.description,
        "rule": observation.rule,
        "status": observation.status,
        "evidence": observation.evidence_data,
        "officer": observation.officer_id,
        "timestamp": observation.created_at,
    }


# ============================================================
# ADD COMMENT
# ============================================================

@router.post(
    "/inspections/{inspection_id}/comments",
    status_code=status.HTTP_201_CREATED,
)
def add_comment(
    inspection_id: int,
    payload: CommentCreate,
    db: Session = Depends(get_db),
    officer: User = Depends(require_officer),
) -> dict[str, Any]:

    inspection = _get(
        db,
        inspection_id,
    )

    # If comment is attached to a finding,
    # make sure that finding belongs to this inspection.
    if payload.finding_id is not None:

        finding_exists = any(
            item.id == payload.finding_id
            for item in inspection.findings
        )

        if not finding_exists:
            raise HTTPException(
                status_code=404,
                detail="Finding not found",
            )

    comment = InspectionComment(
        inspection_id=inspection_id,
        finding_id=payload.finding_id,
        comment=payload.comment,
        officer_id=officer.id,
    )

    db.add(comment)
    db.commit()
    db.refresh(comment)

    return {
        "comment_id": comment.id,
        "finding_id": comment.finding_id,
        "comment": comment.comment,
        "officer": comment.officer_id,
        "timestamp": comment.created_at,
    }


# ============================================================
# COMPLETE HUMAN VERIFICATION
# ============================================================

@router.post(
    "/inspections/{inspection_id}/verify",
)
def complete_verification(
    inspection_id: int,
    payload: VerificationCreate,
    db: Session = Depends(get_db),
    officer: User = Depends(require_officer),
) -> dict[str, Any]:

    inspection = _get(
        db,
        inspection_id,
    )

    # --------------------------------------------------------
    # FIND ONLY UNRESOLVED NEEDS_VERIFICATION FINDINGS
    # --------------------------------------------------------

    pending_findings = [
        finding
        for finding in inspection.findings
        if (
            finding.source == "AI"
            and str(
                finding.status
                or finding.original_ai_status
                or ""
            ).upper()
            == "NEEDS_VERIFICATION"
            and finding.officer_decision is None
        )
    ]

    # --------------------------------------------------------
    # BLOCK FINALIZATION IF ANY ARE STILL PENDING
    # --------------------------------------------------------

    if pending_findings:

        raise HTTPException(
            status_code=409,
            detail={
                "message": (
                    "Some findings still require "
                    "officer verification."
                ),
                "pending_finding_ids": [
                    finding.id
                    for finding in pending_findings
                ],
            },
        )

    # --------------------------------------------------------
    # VALIDATE FINAL OUTCOME
    # --------------------------------------------------------

    allowed_outcomes = {
        "COMPLIANT",
        "NON_COMPLIANT",
        "REQUIRES_FURTHER_INSPECTION",
    }

    if payload.final_outcome not in allowed_outcomes:

        raise HTTPException(
            status_code=422,
            detail="Invalid final outcome.",
        )

    # --------------------------------------------------------
    # MARK INSPECTION VERIFIED
    # --------------------------------------------------------

    inspection.status = "VERIFIED"

    inspection.final_outcome = (
        payload.final_outcome
    )

    # Final remarks are optional.
    if payload.final_remarks:

        inspection.final_remarks = (
            payload.final_remarks.strip()
        )

    else:

        inspection.final_remarks = None

    inspection.verified_by = officer.id

    inspection.verified_at = datetime.now(
        timezone.utc
    )

    # --------------------------------------------------------
    # SAVE FINAL OFFICER REMARK
    # --------------------------------------------------------

    if inspection.final_remarks:

        db.add(
            InspectionComment(
                inspection_id=inspection_id,
                finding_id=None,
                comment=inspection.final_remarks,
                officer_id=officer.id,
            )
        )

    # --------------------------------------------------------
    # COMMIT
    # --------------------------------------------------------

    try:

        db.commit()

    except Exception:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Failed to complete inspection verification.",
        )

    db.refresh(inspection)

    return _inspection_dict(inspection)


# ============================================================
# FINAL REPORT — JSON
# ============================================================

@router.get(
    "/inspections/{inspection_id}/final-report",
)
def final_report(
    inspection_id: int,
    db: Session = Depends(get_db),
    officer: User = Depends(require_officer),
) -> dict[str, Any]:

    inspection = _get(
        db,
        inspection_id,
    )

    _require_verified(inspection)

    report = build_officer_verified_report(
        _inspection_dict(inspection)
    )

    _persist_report(
        db,
        inspection,
        officer,
        report,
        "JSON",
        json.dumps(
            report,
            default=str,
        ).encode("utf-8"),
        "application/json",
        "json",
    )

    return report


# ============================================================
# FINAL REPORT — PDF
# ============================================================

@router.get(
    "/inspections/{inspection_id}/final-report/pdf",
)
def final_report_pdf(
    inspection_id: int,
    db: Session = Depends(get_db),
    officer: User = Depends(require_officer),
) -> Response:

    inspection = _get(
        db,
        inspection_id,
    )

    _require_verified(inspection)

    report = build_officer_verified_report(
        _inspection_dict(inspection)
    )

    record = _persist_report(
        db,
        inspection,
        officer,
        report,
        "PDF",
        render_pdf(report),
        "application/pdf",
        "pdf",
    )

    return Response(
        content=Path(
            record.file_path
        ).read_bytes(),

        media_type=record.mime_type,

        headers={
            "Content-Disposition":
                f'attachment; filename="inspection-{inspection.id}-report.pdf"'
        },
    )


# ============================================================
# FINAL REPORT — DOCX
# ============================================================

@router.get(
    "/inspections/{inspection_id}/final-report/docx",
)
def final_report_docx(
    inspection_id: int,
    db: Session = Depends(get_db),
    officer: User = Depends(require_officer),
) -> Response:

    inspection = _get(
        db,
        inspection_id,
    )

    _require_verified(inspection)

    report = build_officer_verified_report(
        _inspection_dict(inspection)
    )

    record = _persist_report(
        db,
        inspection,
        officer,
        report,
        "DOCX",
        render_docx(report),
        (
            "application/vnd.openxmlformats-"
            "officedocument.wordprocessingml.document"
        ),
        "docx",
    )

    return Response(
        content=Path(
            record.file_path
        ).read_bytes(),

        media_type=record.mime_type,

        headers={
            "Content-Disposition":
                f'attachment; filename="inspection-{inspection.id}-report.docx"'
        },
    )