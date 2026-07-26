/* Cadence — patient journey + consent share + clinician demo */

const html = document.documentElement;
const themeToggle = document.getElementById('theme-toggle');

function getPreferredTheme() {
  const stored = localStorage.getItem('cadence-theme');
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function setTheme(theme) {
  if (theme === 'dark') html.classList.add('dark');
  else html.classList.remove('dark');
  localStorage.setItem('cadence-theme', theme);
}
setTheme(getPreferredTheme());
themeToggle && themeToggle.addEventListener('click', function () {
  setTheme(html.classList.contains('dark') ? 'light' : 'dark');
});

document.querySelectorAll('.water-btn').forEach(function (btn) {
  btn.addEventListener('pointerdown', function (e) {
    var rect = btn.getBoundingClientRect();
    btn.style.setProperty('--x', ((e.clientX - rect.left) / rect.width) * 100 + '%');
    btn.style.setProperty('--y', ((e.clientY - rect.top) / rect.height) * 100 + '%');
    var ripple = document.createElement('span');
    ripple.className = 'ripple';
    var size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', function () { ripple.remove(); });
  });
});

var parallaxEls = document.querySelectorAll('[data-parallax]');
function updateParallax() {
  var scrollY = window.scrollY;
  parallaxEls.forEach(function (el) {
    var speed = parseFloat(el.dataset.parallax) || 0.1;
    var rect = el.getBoundingClientRect();
    if (rect.bottom > 0 && rect.top < window.innerHeight) {
      var offset = (scrollY - (el.offsetTop - window.innerHeight * 0.5)) * speed * 0.15;
      el.style.transform = 'translate3d(0, ' + offset + 'px, 0)';
    }
  });
}
var ticking = false;
window.addEventListener('scroll', function () {
  if (!ticking) {
    requestAnimationFrame(function () { updateParallax(); ticking = false; });
    ticking = true;
  }
}, { passive: true });
updateParallax();

var STAGES = ['BASELINE', 'TRIAGE', 'VISIT_PREP', 'CARE', 'PATTERN', 'RECOVERY'];
var STAGE_LABEL = {
  BASELINE: 'Baseline', TRIAGE: 'Triage', VISIT_PREP: 'Visit Prep',
  CARE: 'Care', PATTERN: 'Patterns', RECOVERY: 'Recovery'
};
var currentStage = 'TRIAGE';
var timeline = [];
var chatHistory = [];
var liveMode = true;
var GRANT_KEY = 'cadence_grants_v1';

var stageReplies = {
  BASELINE: ['Noted for your baseline. Durable facts like allergies and meds are kept for continuity.', 'Profile updated. Add goals or sleep norms anytime.'],
  TRIAGE: ['Logged as a symptom event. Severity 1–10? Any triggers?', 'Stored on your timeline. Seek urgent care for sudden severe symptoms.'],
  VISIT_PREP: ['Visit prep notes saved. Lead with what changed, then top questions.', 'Brief ingredients updated from this session.'],
  CARE: ['Care note saved without judgment.', 'Adherence / side-effect note stored for your clinician packet.'],
  PATTERN: ['Hypothesis only — patterns need your confirmation.', 'Possible cluster noted; not a diagnosis.'],
  RECOVERY: ['Milestone noted. Recovery is stepwise.', 'Logged. Worsening → Triage + clinician.']
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}

function setModeBadge(text, live) {
  var el = document.getElementById('mode-badge');
  if (!el) return;
  el.textContent = text;
  el.className = 'text-[10px] font-mono px-2 py-1 rounded-lg ' +
    (live
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
      : 'bg-slate-100 text-slate-400 dark:bg-slate-800');
}

function setStage(stage) {
  if (STAGES.indexOf(stage) === -1) return;
  currentStage = stage;
  document.querySelectorAll('[data-stage]').forEach(function (el) {
    var active = el.getAttribute('data-stage') === stage;
    el.classList.toggle('ring-2', active);
    el.classList.toggle('ring-cadence-500', active);
    el.classList.toggle('bg-cadence-50', active);
    el.classList.toggle('dark:bg-cadence-950/40', active);
    el.classList.toggle('opacity-60', !active);
  });
  var badge = document.getElementById('stage-badge');
  if (badge) badge.textContent = STAGE_LABEL[stage];
  var input = document.getElementById('chat-input');
  if (input) {
    var ph = {
      BASELINE: 'Allergies, meds, goals…',
      TRIAGE: 'Symptom onset, severity, triggers…',
      VISIT_PREP: 'Questions for my clinician…',
      CARE: 'Med / side effect / plan task…',
      PATTERN: 'Why does this keep happening?',
      RECOVERY: 'What feels better…'
    };
    input.placeholder = ph[stage] || 'Message…';
  }
}

function addTimeline(label, detail) {
  timeline.unshift({ t: new Date().toLocaleString(), label: label, detail: detail });
  var list = document.getElementById('timeline-list');
  if (!list) return;
  list.innerHTML = timeline.slice(0, 16).map(function (item) {
    return '<div class="py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">' +
      '<div class="text-[10px] uppercase tracking-wide text-cadence-600 dark:text-cadence-400 font-medium">' + escapeHtml(item.label) + '</div>' +
      '<div class="text-sm text-slate-700 dark:text-slate-300">' + escapeHtml(item.detail) + '</div>' +
      '<div class="text-[10px] text-slate-400 mt-0.5">' + escapeHtml(item.t) + '</div></div>';
  }).join('');
}

function appendMessage(text, isUser, stageTag) {
  var chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;
  var wrapper = document.createElement('div');
  wrapper.className = 'flex gap-3 msg-enter' + (isUser ? ' justify-end' : '');
  if (isUser) {
    wrapper.innerHTML = '<div class="bg-gradient-to-br from-cadence-500 to-indigo-500 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm max-w-[85%] whitespace-pre-wrap">' +
      escapeHtml(text) + '</div><div class="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0"></div>';
  } else {
    var tag = stageTag ? '<div class="text-[10px] font-medium text-cadence-600 dark:text-cadence-400 mb-1">' + escapeHtml(stageTag) + '</div>' : '';
    wrapper.innerHTML = '<div class="w-8 h-8 rounded-full bg-gradient-to-br from-cadence-400 to-indigo-500 flex-shrink-0"></div>' +
      '<div class="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm max-w-[85%]">' +
      tag + '<div class="whitespace-pre-wrap">' + escapeHtml(text) + '</div></div>';
  }
  chatMessages.appendChild(wrapper);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function routeFromText(text) {
  var lower = text.toLowerCase();
  if (/allerg|baseline|i take|my goal|my meds/.test(lower)) return 'BASELINE';
  if (/prepare my visit|questions for|appointment|see my doctor/.test(lower)) return 'VISIT_PREP';
  if (/side effect|missed dose|took my|adherence|care plan/.test(lower)) return 'CARE';
  if (/pattern|why do i|keeps happening|correlation/.test(lower)) return 'PATTERN';
  if (/feeling better|recovery|milestone|healed/.test(lower)) return 'RECOVERY';
  if (/pain|hurt|symptom|fever|nausea|dizzy|ache|headache/.test(lower)) return 'TRIAGE';
  return currentStage;
}

function fallbackReply(stage) {
  var pool = stageReplies[stage] || stageReplies.TRIAGE;
  return pool[Math.floor(Math.random() * pool.length)];
}

async function liveReply(stage, message) {
  var res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: message, stage: stage, history: chatHistory })
  });
  var data = await res.json().catch(function () { return {}; });
  if (!res.ok || !data.reply) throw new Error((data && data.error) || 'Live model unavailable');
  return data.reply;
}

document.querySelectorAll('[data-stage]').forEach(function (btn) {
  btn.addEventListener('click', function () { setStage(btn.getAttribute('data-stage')); });
});

var chatForm = document.getElementById('chat-form');
var chatInput = document.getElementById('chat-input');
var sending = false;

if (chatForm) {
  chatForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (sending) return;
    var text = (chatInput.value || '').trim();
    if (!text) return;
    var stage = routeFromText(text);
    setStage(stage);
    appendMessage(text, true);
    chatInput.value = '';
    addTimeline(STAGE_LABEL[stage], text.slice(0, 100));
    chatHistory.push({ role: 'user', content: text });
    sending = true;
    chatInput.disabled = true;
    try {
      var reply;
      if (liveMode) {
        try {
          reply = await liveReply(stage, text);
          setModeBadge('live · openrouter', true);
        } catch (err) {
          liveMode = false;
          setModeBadge('demo fallback', false);
          reply = fallbackReply(stage);
        }
      } else {
        reply = fallbackReply(stage);
      }
      appendMessage(reply, false, STAGE_LABEL[stage]);
      chatHistory.push({ role: 'assistant', content: reply });
      if (chatHistory.length > 16) chatHistory = chatHistory.slice(-16);
    } finally {
      sending = false;
      chatInput.disabled = false;
      chatInput.focus();
    }
  });
}

/* ---------- Consent share (browser-local) ---------- */
function loadGrants() {
  try { return JSON.parse(localStorage.getItem(GRANT_KEY) || '{}'); } catch (e) { return {}; }
}
function saveGrants(map) {
  localStorage.setItem(GRANT_KEY, JSON.stringify(map));
}
function makeCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var s = '';
  for (var i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return 'CAD-' + s;
}

function buildPacket(scopes, purpose, hours) {
  var profile = [];
  var events = [];
  timeline.forEach(function (item) {
    events.push({ ts: item.t, type: item.label, content: item.detail });
    if (/baseline|allerg|med|goal|condition|profile/i.test(item.label + ' ' + item.detail)) {
      profile.push(item.detail);
    }
  });
  chatHistory.forEach(function (m) {
    if (m.role === 'user') {
      events.push({ ts: new Date().toLocaleString(), type: 'conversation', content: m.content });
    }
  });
  var expires = Date.now() + (hours * 3600 * 1000);
  return {
    code: null,
    purpose: purpose,
    scopes: scopes,
    created_at: new Date().toISOString(),
    expires_at: new Date(expires).toISOString(),
    expires_ms: expires,
    profile: scopes.indexOf('profile') >= 0 ? profile.slice(0, 20) : [],
    timeline: (scopes.indexOf('timeline') >= 0 || scopes.indexOf('visit_brief') >= 0) ? events.slice(0, 30) : [],
    insights: [],
    status: 'active'
  };
}

function formatBrief(packet) {
  var lines = [
    '# Visit Brief',
    'Code: ' + packet.code,
    'Purpose: ' + (packet.purpose || '—'),
    'Expires: ' + (packet.expires_at || '').replace('T', ' ').slice(0, 19),
    'Scopes: ' + (packet.scopes || []).join(', '),
    '',
    '## Profile snapshot'
  ];
  if (packet.profile && packet.profile.length) {
    packet.profile.forEach(function (p) { lines.push('- ' + p); });
  } else {
    lines.push('- (none in this packet)');
  }
  lines.push('', '## Timeline');
  if (packet.timeline && packet.timeline.length) {
    packet.timeline.forEach(function (t) {
      lines.push('- [' + (t.ts || '') + '] ' + (t.type || '') + ': ' + (t.content || ''));
    });
  } else {
    lines.push('- (none in this packet)');
  }
  lines.push('', '---', 'Educational packet. Not a medical record. Clinician must verify.');
  return lines.join('\n');
}

function formatNote(packet) {
  var lines = [
    '# Note Draft (AI-assisted — not signed)',
    'Source code: ' + packet.code,
    '',
    '## S — Subjective'
  ];
  var sub = (packet.timeline || []).slice(0, 12);
  if (sub.length) sub.forEach(function (t) { lines.push('- ' + (t.ts || '') + ': ' + (t.content || '')); });
  else lines.push('- (no timeline in packet)');
  lines.push('', '## O — Objective', '- (none — do not invent vitals/labs/exam)');
  lines.push('', '## A — Assessment', '- (clinician to complete — hypotheses only if present)');
  lines.push('', '## P — Plan', '- (clinician to complete)');
  lines.push('', '---', 'Disclaimer: Draft from patient-authorized demo packet only. Review, edit, and sign in your own system.');
  return lines.join('\n');
}

function getGrant(code) {
  if (!code) return null;
  var map = loadGrants();
  var g = map[code.toUpperCase()];
  if (!g) return null;
  if (g.expires_ms && Date.now() > g.expires_ms) {
    g.status = 'expired';
    map[code.toUpperCase()] = g;
    saveGrants(map);
  }
  return g;
}

var btnCreate = document.getElementById('btn-create-share');
if (btnCreate) {
  btnCreate.addEventListener('click', function () {
    var scopes = [];
    document.querySelectorAll('.scope-cb:checked').forEach(function (cb) { scopes.push(cb.value); });
    if (!scopes.length) {
      alert('Select at least one scope');
      return;
    }
    var hours = parseInt((document.getElementById('share-hours') || {}).value || '48', 10);
    if (!hours || hours < 1) hours = 48;
    var purpose = ((document.getElementById('share-purpose') || {}).value || 'Upcoming visit').trim();
    var packet = buildPacket(scopes, purpose, hours);
    var code = makeCode();
    packet.code = code;
    var map = loadGrants();
    map[code] = packet;
    saveGrants(map);
    document.getElementById('share-code').textContent = code;
    document.getElementById('share-meta').textContent =
      'Active · ' + scopes.join(', ') + ' · expires in ' + hours + 'h · stored only in this browser';
    var clinInput = document.getElementById('clinician-code');
    if (clinInput) clinInput.value = code;
  });
}

var btnCopy = document.getElementById('btn-copy-code');
if (btnCopy) {
  btnCopy.addEventListener('click', function () {
    var code = (document.getElementById('share-code') || {}).textContent || '';
    if (!code || code === '—') return;
    navigator.clipboard.writeText(code).then(function () {
      btnCopy.textContent = 'Copied';
      setTimeout(function () { btnCopy.textContent = 'Copy code'; }, 1200);
    });
  });
}

var btnBrief = document.getElementById('btn-open-brief');
var btnNote = document.getElementById('btn-draft-note');

function requireGrant() {
  var code = ((document.getElementById('clinician-code') || {}).value || '').trim().toUpperCase();
  var g = getGrant(code);
  var status = document.getElementById('clinician-status');
  if (!g) {
    if (status) status.textContent = 'No grant found for that code in this browser.';
    return null;
  }
  if (g.status !== 'active') {
    if (status) status.textContent = 'Grant status: ' + g.status;
    return null;
  }
  if (status) status.textContent = 'Grant active · purpose: ' + (g.purpose || '—') + ' · scopes: ' + (g.scopes || []).join(', ');
  return g;
}

if (btnBrief) {
  btnBrief.addEventListener('click', function () {
    var g = requireGrant();
    if (!g) return;
    if ((g.scopes || []).indexOf('visit_brief') < 0 && (g.scopes || []).indexOf('profile') < 0) {
      document.getElementById('clinician-status').textContent = 'Grant lacks visit_brief/profile scope.';
      return;
    }
    document.getElementById('brief-out').textContent = formatBrief(g);
  });
}

if (btnNote) {
  btnNote.addEventListener('click', function () {
    var g = requireGrant();
    if (!g) return;
    var scopes = g.scopes || [];
    if (scopes.indexOf('note_source') < 0 && scopes.indexOf('visit_brief') < 0) {
      document.getElementById('clinician-status').textContent = 'Grant lacks note_source/visit_brief scope.';
      return;
    }
    document.getElementById('note-out').textContent = formatNote(g);
    if (!document.getElementById('brief-out').textContent || document.getElementById('brief-out').textContent === '—') {
      document.getElementById('brief-out').textContent = formatBrief(g);
    }
  });
}

setStage('TRIAGE');
setModeBadge('live · openrouter', true);
addTimeline('System', 'Companion ready');

if (window.location.hash === '#chat') {
  setTimeout(function () { if (chatInput) chatInput.focus(); }, 400);
}
