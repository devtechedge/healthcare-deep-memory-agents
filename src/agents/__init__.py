"""Agent package. Heavy imports (ollama) are lazy so unit tests stay light."""

from __future__ import annotations

__all__ = ["HealthcareAgent", "PatientOrchestrator"]


def __getattr__(name: str):
    if name == "HealthcareAgent":
        from .base_agent import HealthcareAgent

        return HealthcareAgent
    if name == "PatientOrchestrator":
        from .patient_agents import PatientOrchestrator

        return PatientOrchestrator
    raise AttributeError(name)
