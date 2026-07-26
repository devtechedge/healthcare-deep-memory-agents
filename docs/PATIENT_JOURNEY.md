# Cadence — Patient Journey Spec

Goal: one continuous companion from first wellness signal → active care → recovery.
Retention + demo wow live here first. Clinician portal comes later on the same memory.

---

## Journey stages

| Stage | Patient need | Primary agent | Memory writes |
|-------|--------------|---------------|---------------|
| 1. Baseline | Who am I health-wise? | `BaselineAgent` | semantic profile, goals |
| 2. Signal | Something feels off | `TriageAgent` | episodic symptoms, red-flags |
| 3. Prep | Going to see someone | `VisitPrepAgent` | questions, brief packet |
| 4. Active care | Following a plan | `CareCompanionAgent` | meds, adherence, side effects |
| 5. Patterns | Understanding the arc | `PatternAgent` | insights from episodic |
| 6. Recovery | Getting better / staying well | `RecoveryAgent` | milestones, discharge understanding |

Orchestrator: `PatientOrchestrator` routes each message to the best stage agent while sharing one `DeepMemory`.

---

## Stage detail

### 1. Baseline
- Collect: age band (optional), known conditions, allergies, current meds, sleep/stress/activity norms, goals
- Output: structured profile facts in semantic memory
- Tone: calm, non-clinical, respectful of incomplete answers

### 2. Signal (Triage)
- Collect: symptom, onset, severity 1–10, triggers, relieving factors, associated symptoms
- Soft red-flag language only (never diagnose; urge urgent care when patterns match danger signals)
- Always store episodic event with structured meta

### 3. Visit prep
- Build: “questions for my clinician”, timeline of recent symptoms, med list snapshot, goals for the visit
- Output: plain-language brief the patient can read or export later

### 4. Active care
- Track: medications, doses, adherence, side effects, care-plan tasks
- Remind without nagging; log misses as episodic, not shame

### 5. Patterns
- Read episodic + semantic; propose possible correlations (sleep ↔ headache, etc.)
- Insights start **unverified**; patient can confirm “feels true” → mark verified

### 6. Recovery
- Track milestones from the care plan
- Plain-language “what good looks like” and when to re-contact clinician

---

## Hard product rules (patient side)

1. Never diagnose or prescribe.
2. Never discourage seeking professional care.
3. Memory is patient-owned; sharing with clinicians is explicit later.
4. Every agent writes to the same DeepMemory instance.
5. Red-flag language is cautious and action-oriented, not alarming theater.

---

## Demo wow moments

1. Patient logs a headache → days later agent recalls prior screen-strain note without being asked.
2. “Prepare my visit” produces a clean one-page brief from memory alone.
3. Pattern agent surfaces “headaches often after late nights” from episodic history.
4. Med companion remembers a reported side effect next time the drug is mentioned.

---

## Implementation status

- [x] Spec
- [x] Patient agents (pure Python)
- [x] Orchestrator CLI path
- [ ] Richer structured symptom schema in memory meta
- [ ] Patient web surfaces (timeline, check-in, visit brief)
- [ ] Consent / share tokens for clinician view
