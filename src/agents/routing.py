"""Deterministic patient-journey keyword routing. No LLM, no frameworks."""

from __future__ import annotations

from typing import Optional

STAGES = (
    "BASELINE",
    "TRIAGE",
    "VISIT_PREP",
    "CARE",
    "PATTERN",
    "RECOVERY",
)

_BASELINE_KEYS = ("allerg", "my meds", "i take", "baseline", "my goal")
_VISIT_KEYS = ("prepare my visit", "questions for", "see my doctor", "appointment")
_CARE_KEYS = ("side effect", "missed dose", "took my", "adherence", "care plan")
_PATTERN_KEYS = ("pattern", "why do i always", "keeps happening", "correlation")
_RECOVERY_KEYS = ("feeling better", "recovery", "milestone", "healed")
_TRIAGE_KEYS = ("pain", "hurt", "symptom", "fever", "nausea", "dizzy", "ache")


def keyword_route(user_msg: str) -> Optional[str]:
    """Return a stage from keywords, or None if the LLM router should decide."""
    lower = (user_msg or "").lower()
    if any(k in lower for k in _BASELINE_KEYS):
        return "BASELINE"
    if any(k in lower for k in _VISIT_KEYS):
        return "VISIT_PREP"
    if any(k in lower for k in _CARE_KEYS):
        return "CARE"
    if any(k in lower for k in _PATTERN_KEYS):
        return "PATTERN"
    if any(k in lower for k in _RECOVERY_KEYS):
        return "RECOVERY"
    if any(k in lower for k in _TRIAGE_KEYS):
        return "TRIAGE"
    return None


def coerce_stage(raw: str, last_stage: Optional[str] = None) -> str:
    """Map a free-form label onto a valid stage."""
    text = (raw or "").strip().upper()
    for stage in STAGES:
        if stage in text:
            return stage
    if last_stage in STAGES:
        return last_stage
    return "TRIAGE"
