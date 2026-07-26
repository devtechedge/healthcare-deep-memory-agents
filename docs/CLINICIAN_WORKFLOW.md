# Clinician Workflow — Visit Brief + Note Draft

**Who pays:** clinics / clinicians.  
**What they buy:** time saved before and during the visit, without unsafe access to the full patient chat log.

Depends on: `docs/CONSENT_AND_MEMORY.md`

---

## Job to be done

1. **Before visit** — open a **Visit Brief** built from patient-approved memory  
2. **During / after visit** — generate a **Note Draft** the clinician edits and owns  

Cadence never becomes the legal medical record of truth; the clinician does.

---

## Visit Brief (artifact)

Structured, skimmable packet:

```text
VISIT BRIEF
-----------
Patient:           (display name / id)
Grant:             grant_id · expires
Purpose:           e.g. follow-up HTN

1. Profile snapshot
   - Conditions
   - Allergies
   - Meds (patient-reported)
   - Goals

2. Since last touch (timeline window)
   - Symptom events
   - Care / adherence notes
   - Recovery milestones

3. Patient questions / agenda
   - From Visit Prep stage

4. Pattern hypotheses (labeled)
   - Only patient-visible or confirmed insights

5. Red flags called out by triage language (if any)
```

**Source rule:** only data allowed by active `ConsentGrant` scopes.  
**Generation:** pure Python assembler first; LLM polish optional.

---

## Note Draft (artifact)

Clinician-facing draft, e.g. SOAP-ish or clinic template:

```text
NOTE DRAFT (editable — not final chart)
---------------------------------------
S: …
O: … (only if data present; never invent vitals)
A: … (hypothesis language only; clinician finalizes)
P: …

Sources: grant_id, brief_id, timestamp
Disclaimer: AI-assisted draft. Clinician must review and sign.
```

**Hard rules**

- Never invent vitals, labs, or exam findings  
- Never auto-diagnose  
- Cite only consented packet fields  
- Output is a **draft**; signing stays in the clinician’s EHR/workflow  

---

## Clinician agents (pure Python)

| Agent | Input | Output |
|-------|--------|--------|
| `VisitBriefAgent` | patient_id + grant_id | Visit Brief markdown/JSON |
| `NoteDraftAgent` | brief + optional clinician bullets | Note Draft markdown |

Both share **read** access through the consent layer only — they do not open the full vault.

---

## Demo path (local)

```bash
# patient side accumulates memory (existing)
python run_patient.py

# clinician side (after a grant exists)
python run_clinician.py --patient demo --grant <grant_id> brief
python run_clinician.py --patient demo --grant <grant_id> note
```

---

## UI (later)

- **Patient:** “Share for visit” → pick scopes + expiry → QR / code for clinician  
- **Clinician:** enter code → Brief view → “Draft note” → copy  

Web demo can simulate grant + brief without real PHI.

---

## Success metrics (product)

- Minutes saved pre-visit  
- % of note draft kept vs rewritten  
- Zero unauthorized vault reads (audit)  
