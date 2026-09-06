/**
 * Cadence live chat proxy — Vercel serverless
 * Model: llama-3.3-70b-versatile via Groq (OpenAI-compatible)
 * Secret: OPENAI_API_KEY (Vercel Environment Variable — holds the Groq key)
 * Free tier: ~30 RPM / 1000 RPD
 * Hardening: allowlisted CORS (no *), rate limit, demo fallback without key, scrub secrets.
 */

const MODEL = 'llama-3.3-70b-versatile';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const STAGE_PROMPTS = {
  BASELINE: `You are Cadence Baseline — a calm wellness intake companion.
Help the patient build a health baseline: conditions, allergies, medications, sleep/stress/activity norms, goals.
Ask at most one or two focused questions. Never diagnose or prescribe. Encourage professional care.`,

  TRIAGE: `You are Cadence Triage — a careful symptom companion.
Help structure symptoms: onset, severity 1-10, location, triggers, relieving factors, associated symptoms.
Never diagnose or prescribe. If symptoms could be urgent (chest pain with shortness of breath, sudden severe neurological changes, uncontrolled bleeding, severe allergic reaction), urge emergency/urgent care immediately.
Be concise, warm, and precise.`,

  VISIT_PREP: `You are Cadence Visit Prep.
Help the patient prepare for a clinical visit: short timeline, questions for the clinician, visit goals.
Plain language. Structured bullets when useful. Never diagnose.`,

  CARE: `You are Cadence Care Companion during active treatment.
Help with medication adherence notes, side effects, and care-plan tasks.
Never change prescribed regimens. Record without shame. Clinician owns medication decisions.`,

  PATTERN: `You are Cadence Pattern.
Suggest possible correlations from what the patient describes (e.g. sleep and headaches) as hypotheses only — not facts or diagnoses.
Invite confirmation or rejection.`,

  RECOVERY: `You are Cadence Recovery.
Support healing milestones and plain-language understanding of progress.
Never declare someone cured. If symptoms worsen, steer back toward triage and clinician contact.`,
};

const BASE_RULES = `
You are part of Cadence, an educational health companion demo.
Rules:
- Never give a definitive diagnosis or prescription.
- Always note that this is not a substitute for professional medical care when relevant.
- Be concise (usually 2–5 short sentences unless the user asks for a brief).
- Match the patient's language simply and clearly.
`.trim();


const ALLOWED_ORIGINS = (
  process.env.CORS_ORIGINS ||
  'https://cadence-healthcare.vercel.app,http://localhost:3000,http://127.0.0.1:3000'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const DEMO_REPLIES = {
  BASELINE:
    'Thanks for sharing that baseline context. In this demo I only keep notes in your browser. What is one wellness goal you want your clinician to know about? This is educational — not a medical record.',
  TRIAGE:
    'I can help you organize symptoms for a clinician (onset, severity 1–10, location). I cannot diagnose. If this feels urgent — chest pain with shortness of breath, sudden neurological changes, severe bleeding, or anaphylaxis — seek emergency care now.',
  VISIT_PREP:
    'For visit prep, jot a short timeline, your top three questions, and what success looks like today. Bring this list to your clinician — I am a demo companion, not care.',
  CARE:
    'Noted for your care-plan journal (browser-only). Do not change prescribed regimens based on this chat. Flag side effects to your clinician.',
  PATTERN:
    'Any pattern I suggest is a hypothesis only — not a diagnosis. Does sleep, stress, or activity seem to line up with what you notice?',
  RECOVERY:
    'Recovery check-ins here are educational. If symptoms worsen, contact your clinician or urgent care. What milestone feels most relevant today?',
};

const g = globalThis;
if (!g.__cadenceHits) g.__cadenceHits = new Map();

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim();
  return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : 'unknown';
}

function rateLimited(req) {
  const ip = clientIp(req);
  const now = Date.now();
  const windowMs = 60_000;
  const max = 20;
  const map = g.__cadenceHits;
  let arr = map.get(ip) || [];
  arr = arr.filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    map.set(ip, arr);
    return true;
  }
  arr.push(now);
  map.set(ip, arr);
  return false;
}

function resolveOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return null;
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  const host = req.headers.host;
  if (host && (origin === 'https://' + host || origin === 'http://' + host)) return origin;
  return undefined;
}

function scrub(text) {
  if (!text) return text;
  let s = String(text);
  const key = process.env.OPENAI_API_KEY;
  if (key && key.length > 8) s = s.split(key).join('[redacted]');
  s = s.replace(/gsk_[A-Za-z0-9]+/g, '[redacted]');
  s = s.replace(/sk-[A-Za-z0-9]+/g, '[redacted]');
  return s;
}

function demoPayload(stage) {
  const s = STAGE_PROMPTS[stage] ? stage : 'TRIAGE';
  return {
    reply: DEMO_REPLIES[s] || DEMO_REPLIES.TRIAGE,
    stage: s,
    model: 'demo-fallback',
    mode: 'demo',
    fallback: true,
  };
}

function json(res, status, body, allowOrigin) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (allowOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
  }
  if (body && typeof body === 'object' && body.error) {
    body = Object.assign({}, body, { error: scrub(body.error) });
  }
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  const allowOrigin = resolveOrigin(req);
  if (req.headers.origin && allowOrigin === undefined) {
    return json(res, 403, { error: 'Origin not allowed' }, null);
  }

  if (req.method === 'OPTIONS') {
    return json(res, 204, {}, allowOrigin);
  }
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' }, allowOrigin);
  }

  if (rateLimited(req)) {
    return json(res, 429, { error: 'Rate limit exceeded', fallback: true }, allowOrigin);
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return json(res, 400, { error: 'Invalid JSON' }, allowOrigin);
    }
  }
  body = body || {};

  const message = (body.message || '').trim();
  const stage = (body.stage || 'TRIAGE').toUpperCase();
  const history = Array.isArray(body.history) ? body.history.slice(-8) : [];

  if (!message) {
    return json(res, 400, { error: 'message required' }, allowOrigin);
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return json(res, 200, demoPayload(stage), allowOrigin);
  }

  const stagePrompt = STAGE_PROMPTS[stage] || STAGE_PROMPTS.TRIAGE;
  const messages = [
    { role: 'system', content: BASE_RULES + '\n\n' + stagePrompt },
    ...history
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
      .map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) })),
    { role: 'user', content: message.slice(0, 4000) },
  ];

  try {
    const upstream = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.4,
        max_tokens: 600,
      }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      const errMsg =
        (data && data.error && (data.error.message || data.error)) ||
        'Groq error ' + upstream.status;
      return json(res, 502, { error: scrub(String(errMsg)), fallback: true }, allowOrigin);
    }

    const reply =
      data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content
        ? data.choices[0].message.content.trim()
        : '';

    if (!reply) {
      return json(res, 502, { error: 'Empty model response', fallback: true }, allowOrigin);
    }

    return json(res, 200, {
      reply,
      stage,
      model: MODEL,
      mode: 'groq',
    }, allowOrigin);
  } catch (err) {
    return json(res, 500, {
      error: scrub(err && err.message ? err.message : 'Proxy failure'),
      fallback: true,
    }, allowOrigin);
  }
};
