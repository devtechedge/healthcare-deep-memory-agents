/**
 * Cadence demo chat proxy — Vercel serverless
 * Model: nvidia/nemotron-3-ultra-550b-a55b:free via OpenRouter
 * Secret: OPENROUTER_API_KEY (Vercel Environment Variable)
 */

const MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';

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

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return json(res, 204, {});
  }
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return json(res, 503, {
      error: 'OPENROUTER_API_KEY not configured',
      fallback: true,
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return json(res, 400, { error: 'Invalid JSON' });
    }
  }
  body = body || {};

  const message = (body.message || '').trim();
  const stage = (body.stage || 'TRIAGE').toUpperCase();
  const history = Array.isArray(body.history) ? body.history.slice(-8) : [];

  if (!message) {
    return json(res, 400, { error: 'message required' });
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
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://cadence-devtechedge1.vercel.app',
        'X-Title': 'Cadence Patient Journey Demo',
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
        'OpenRouter error ' + upstream.status;
      return json(res, 502, { error: String(errMsg), fallback: true });
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
      return json(res, 502, { error: 'Empty model response', fallback: true });
    }

    return json(res, 200, {
      reply,
      stage,
      model: MODEL,
      mode: 'openrouter',
    });
  } catch (err) {
    return json(res, 500, {
      error: err && err.message ? err.message : 'Proxy failure',
      fallback: true,
    });
  }
};
