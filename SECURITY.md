# Security Assessment — Cadence (healthcare-deep-memory-agents)

**Date:** 2026-08-21  
**Scope:** Auth, XSS, injection, secrets, PHI, LLM proxy, consent grants  
**Live:** [cadence-healthcare.vercel.app](https://cadence-healthcare.vercel.app/)

This is an **educational / research prototype**. It is not a medical device, not HIPAA-certified, and must not store real patient records.

---

## Executive summary

| Area | Risk | Notes |
|------|------|--------|
| Authentication | **N/A (by design)** | No login on the public UI |
| Authorization (local Python) | **Medium (by design)** | ConsentStore gates clinician read paths; not a hospital IAM |
| Authorization (public UI) | **Browser-local only** | Share codes live in `localStorage` on one device |
| XSS | **Low (hardened)** | Companion renderer now HTML-encodes user/model text |
| Injection (SQL) | **Low** | Parameterized SQLite; no string-built queries |
| Secrets in git | **None found** | `.env`, `data/`, `*.db`, `*.pkl` gitignored |
| Public LLM proxy | **Accepted residual** | Chat text is sent to Groq; env var is named `OPENAI_API_KEY` |
| PHI | **High if misused** | Do not enter real identifiers. Demo data only |
| Pickle vectors | **Accepted residual** | `data/vectors.pkl` is local-only; never load untrusted pickles |
| CORS on `/api/chat` | **Accepted residual** | `Access-Control-Allow-Origin: *` on a public demo POST |

**Overall (public Vercel demo):** Low-to-medium residual risk if used as a **demo**. **High** if anyone pastes real clinical data into the live chat.

---

## 1. Authentication & session

**Findings**
- Public Cadence UI has no accounts, cookies, or JWT.
- Clinician “share code” (`CAD-XXXXXX`) is generated in the browser and stored under `cadence_grants_v1` in `localStorage`.
- The local Python path (`ConsentStore`) uses UUID grants, expiry, revoke, and an audit table. That store is **not** wired to Vercel.

**Verdict:** Do not claim HIPAA, NextAuth, or hospital SSO. Browser grants are a UX demo of consent scopes, not a security boundary.

---

## 2. XSS

**Findings**
- Companion messages, timeline rows, and share metadata are injected via `innerHTML`.
- `escapeHtml` previously replaced characters with themselves (no encoding). That is now fixed (`& < > " '` → entities).
- Tailwind is loaded from `cdn.tailwindcss.com` (supply-chain residual for a demo).

**Hardening applied**
- HTML entity encoding before any `innerHTML` of user or model text.

---

## 3. SQL / command injection

**Findings**
- `ConsentStore` and `DeepMemory` use parameterized `?` placeholders.
- No `os.system`, no shell-out, no eval of model output.

**Verdict:** Low on the local Python path.

---

## 4. Secrets & the Groq proxy

**Findings**
- `web/api/chat.js` is a Vercel serverless function. It reads `process.env.OPENAI_API_KEY` (name chosen in the Vercel project) and calls `https://api.groq.com/openai/v1/chat/completions` with `llama-3.3-70b-versatile`.
- The key never ships in the repo.
- Request bodies include the last 8 chat turns. Those turns go to Groq. They are **not** stored in a Cadence database on Vercel.
- Missing key / Groq errors return `{ fallback: true }`; the UI switches to canned demo replies and stays there for the tab session.

**Residual**
- Env var name `OPENAI_API_KEY` is misleading (it holds a Groq key). Renaming would require a Vercel change; left as-is.
- No server-side rate limit beyond Groq’s free tier (~30 RPM / 1000 RPD).
- Prompt injection: a user can try to override the “never diagnose” system prompt. Model output is untrusted text.

---

## 5. PHI / data residency

**Local Python (`run_patient.py`, `run_clinician.py`)**
- SQLite + pickle under `data/` (gitignored). Intended to stay on one machine with Ollama.

**Public UI**
- Timeline and grants: this browser only.
- Companion messages: Groq when live mode succeeds.

Never put real names, MRNs, or identifiable health data in either path.

---

## 6. Consent model (local agents)

`VALID_SCOPES = {profile, timeline, visit_brief, note_source}`

- Unknown scopes are dropped.
- `is_allowed` checks grant existence, `active` status, clinician id, and required scope.
- Expiry is evaluated on read and written back as `expired`.
- Deny/access/create/revoke are appended to `consent_audit`.

This is a teaching implementation, not a substitute for an EHR access-control system.

---

## 7. Dependencies

| Package | Role |
|---------|------|
| `ollama` | Local CLI agents only |
| `sentence-transformers` + `numpy` | Local semantic memory |
| *(removed)* `faiss-cpu` | Never imported |

CI installs `pytest` + `numpy` only and injects a dummy embedder so GitHub Actions does not download torch.

Do not run `npm audit fix --force` here — there is no production Node graph, only Playwright as a devDependency.

---

## 8. Residual risk (accepted for a portfolio demo)

1. Public chat traffic to Groq.
2. `OPENAI_API_KEY` naming.
3. CORS `*`.
4. `localStorage` grants (any script on the origin can read them).
5. Pickle of embedding vectors (local file; never untrusted).
6. CDN Tailwind / Google Fonts.
7. Educational medical language that a visitor might over-trust — footer + system prompts still say “not a substitute for care.”
