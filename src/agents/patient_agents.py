"""
Patient-journey vertical agents for Cadence.
Pure Python. Shared DeepMemory. No agent frameworks.
"""

from __future__ import annotations

from typing import Optional

from src.agents.base_agent import HealthcareAgent
from src.memory.deep_memory import DeepMemory


# ---------- System prompts (stage-specific) ----------

BASELINE_PROMPT = """
You are Cadence Baseline — a calm wellness intake companion.
Your job is to help the patient build a clear health baseline over time:
known conditions, allergies, medications, sleep/stress/activity norms, and goals.

Rules:
- Ask only one or two focused questions at a time.
- Reflect back what you heard and store durable facts clearly.
- Never diagnose or prescribe.
- Encourage completeness without pressure; incomplete answers are fine.
- When you learn a durable fact (allergy, chronic condition, regular med, goal),
  state it plainly so it can be remembered.
""".strip()

TRIAGE_PROMPT = """
You are Cadence Triage — a careful symptom companion for the patient side.
Help the patient describe what they feel with enough structure for later care:
onset, severity (1-10), location, triggers, relieving factors, associated symptoms.

Rules:
- Never diagnose or prescribe.
- If symptoms could be urgent (e.g. chest pain with shortness of breath, sudden severe
  neurological changes, uncontrolled bleeding, severe allergic reaction), urge them
  to seek emergency / urgent care immediately and stop routine intake.
- Otherwise, organize the story and offer to keep tracking.
- Be concise, warm, and precise.
""".strip()

VISIT_PREP_PROMPT = """
You are Cadence Visit Prep — you help the patient walk into a clinical visit prepared.
Use memory of symptoms, meds, allergies, and goals to draft:
1) a short timeline of recent issues
2) a list of questions for the clinician
3) what the patient hopes to get from the visit

Rules:
- Plain language only.
- Never diagnose.
- Prefer structured bullets the patient can read aloud or share.
- If memory is thin, ask for the missing pieces first.
""".strip()

CARE_COMPANION_PROMPT = """
You are Cadence Care Companion — support during active treatment.
Help with medication adherence logging, side-effect notes, and care-plan tasks.

Rules:
- Never change prescribed regimens; only help the patient track and report.
- Side effects should be logged clearly for the clinician later.
- Missed doses: record without shame; ask what got in the way if useful.
- Always remind that the prescribing clinician owns medication decisions.
""".strip()

PATTERN_PROMPT = """
You are Cadence Pattern — look across recent events and long-term facts for
possible correlations the patient may want to notice (e.g. sleep and headaches).

Rules:
- Phrase patterns as hypotheses, not facts or diagnoses.
- Cite the memory you used in plain language.
- Invite the patient to confirm or reject the pattern.
- Never claim medical causation.
""".strip()

RECOVERY_PROMPT = """
You are Cadence Recovery — support the patient through healing and maintenance.
Track milestones, clarify the care plan in plain language, and help them know
what "better" looks like and when to re-contact their clinician.

Rules:
- Never declare someone "cured."
- Celebrate progress carefully.
- If symptoms return or worsen, steer back to triage / clinician contact.
""".strip()

ORCHESTRATOR_PROMPT = """
You are Cadence Orchestrator for the patient journey.
Classify the user's message into exactly one stage label:
BASELINE | TRIAGE | VISIT_PREP | CARE | PATTERN | RECOVERY

Reply with ONLY the label, nothing else.
""".strip()


def _make_agent(name: str, prompt: str, memory: DeepMemory, model: str) -> HealthcareAgent:
    return HealthcareAgent(name=name, system_prompt=prompt, memory=memory, model=model)


class PatientOrchestrator:
    """
    Routes patient messages to the right journey-stage agent.
    All agents share one DeepMemory instance.
    """

    STAGES = (
        "BASELINE",
        "TRIAGE",
        "VISIT_PREP",
        "CARE",
        "PATTERN",
        "RECOVERY",
    )

    def __init__(self, memory: DeepMemory, model: str = "llama3.1"):
        self.memory = memory
        self.model = model
        self.router = _make_agent("Orchestrator", ORCHESTRATOR_PROMPT, memory, model)
        self.agents = {
            "BASELINE": _make_agent("Baseline", BASELINE_PROMPT, memory, model),
            "TRIAGE": _make_agent("Triage", TRIAGE_PROMPT, memory, model),
            "VISIT_PREP": _make_agent("VisitPrep", VISIT_PREP_PROMPT, memory, model),
            "CARE": _make_agent("CareCompanion", CARE_COMPANION_PROMPT, memory, model),
            "PATTERN": _make_agent("Pattern", PATTERN_PROMPT, memory, model),
            "RECOVERY": _make_agent("Recovery", RECOVERY_PROMPT, memory, model),
        }
        self.last_stage: Optional[str] = None

    def _route(self, patient_id: str, user_msg: str) -> str:
        # Lightweight keyword shortcuts (fast, deterministic) before LLM route
        lower = user_msg.lower()
        if any(k in lower for k in ("allerg", "my meds", "i take", "baseline", "my goal")):
            return "BASELINE"
        if any(k in lower for k in ("prepare my visit", "questions for", "see my doctor", "appointment")):
            return "VISIT_PREP"
        if any(k in lower for k in ("side effect", "missed dose", "took my", "adherence", "care plan")):
            return "CARE"
        if any(k in lower for k in ("pattern", "why do i always", "keeps happening", "correlation")):
            return "PATTERN"
        if any(k in lower for k in ("feeling better", "recovery", "milestone", "healed")):
            return "RECOVERY"
        if any(k in lower for k in ("pain", "hurt", "symptom", "fever", "nausea", "dizzy", "ache")):
            return "TRIAGE"

        raw = self.router.think(patient_id, user_msg).strip().upper()
        for stage in self.STAGES:
            if stage in raw:
                return stage
        return self.last_stage or "TRIAGE"

    def chat(self, patient_id: str, user_msg: str, force_stage: Optional[str] = None) -> str:
        stage = (force_stage or self._route(patient_id, user_msg)).upper()
        if stage not in self.agents:
            stage = "TRIAGE"
        self.last_stage = stage

        agent = self.agents[stage]
        answer = agent.think(patient_id, user_msg)

        # Tag the episodic trail with journey stage for later analytics
        self.memory.add_episodic(
            patient_id=patient_id,
            event_type="journey_stage",
            content=f"stage={stage}",
            meta={"stage": stage, "agent": agent.name},
        )
        return f"[{agent.name}] {answer}"
