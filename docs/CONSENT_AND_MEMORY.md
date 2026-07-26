# Shared Memory + Consent Model

Cadence keeps **one deep memory store per patient**, but **access is role- and consent-scoped**. Clinicians never see raw chat by default; they see **patient-approved packets** (visit brief, timeline slices, note drafts).

## Why this comes before “who pays”

Clinician value (visit brief + note draft) is only trustworthy if:

1. The patient controls what leaves their vault  
2. Every share is time-bound and auditable  
3. Memory layers stay consistent for both sides  

Without consent architecture, a “smart note” is just an unsafe data leak.

---

## Memory layers (shared substrate)

| Layer | What it holds | Patient | Clinician (with consent) |
|-------|----------------|---------|---------------------------|
| **Working** | Current session turns | Full | Only if live-share enabled |
| **Episodic** | Timestamped events (symptoms, meds, milestones) | Full | Filtered packet |
| **Semantic** | Durable facts (allergies, conditions, goals) | Full | Profile slice |
| **Insights** | Pattern hypotheses (patient-confirmed or provisional) | Full | Marked as hypothesis |
| **Artifacts** | Generated docs (visit brief, note draft) | Own copies | Issued under grant |

All layers live in local SQLite (+ optional vector cache). Cloud demo (OpenRouter) is **stateless** unless the patient explicitly syncs a packet.

---

## Roles

| Role | Capabilities |
|------|----------------|
| **Patient** | Write all layers; grant/revoke clinician access; approve packets |
| **Clinician** | Read only what a valid **ConsentGrant** allows; generate note drafts from allowed packet; never mutate patient vault |
| **System** | Enforce expiry, scope, audit log |

---

## ConsentGrant (core object)

```text
ConsentGrant
  grant_id          uuid
  patient_id        str
  clinician_id      str          # or clinic_id
  scopes            set          # profile | timeline | visit_brief | note_source
  purpose           str          # e.g. "upcoming visit 2026-08-01"
  created_at        datetime
  expires_at        datetime     # hard expiry
  status            active | revoked | expired
  packet_snapshot   optional     # frozen copy at grant time (recommended)
```

### Scopes

| Scope | Reveals |
|-------|---------|
| `profile` | Conditions, allergies, meds, goals |
| `timeline` | Episodic events in a date window |
| `visit_brief` | Pre-built visit brief artifact |
| `note_source` | Enough structured data to draft a progress note |

**Default for a visit share:** `profile + timeline(window) + visit_brief`.  
`note_source` is opt-in (higher sensitivity).

### Rules

1. **No grant → no clinician read** of patient memory  
2. **Expiry is absolute** — jobs mark `expired`; API refuses  
3. **Revoke is immediate**  
4. **Audit every access** (who, when, scope, grant_id)  
5. Prefer **packet_snapshot** so later patient edits don’t silently change what the clinician already opened  

---

## Data flow (honest product)

```text
Patient journey agents
        │ write
        ▼
   DeepMemory (patient vault)
        │
        │ patient taps “Share for visit”
        ▼
   ConsentGrant + optional PacketSnapshot
        │
        ▼
   Clinician workspace
        ├── Visit Brief (read)
        └── Note Draft (generated from allowed scopes only)
```

OpenRouter demo on Vercel does **not** persist PHI in the cloud. Local pure-Python path is the system of record.

---

## Implementation map (repo)

| Module | Responsibility |
|--------|----------------|
| `src/memory/deep_memory.py` | Existing episodic / semantic / insights |
| `src/memory/consent.py` | Grants, revoke, expiry, audit |
| `src/agents/clinician_agents.py` | Visit brief builder, note draft agent |
| `run_clinician.py` | CLI for clinician-side demo |

---

## Non-goals (for now)

- Full HIPAA compliance certification  
- Hospital EHR write-back  
- Multi-clinic RBAC  

Those can layer on the same grant model later.
