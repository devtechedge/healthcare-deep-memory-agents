/* Cadence — patient journey frontend */

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

/* ---------- Patient journey ---------- */
var STAGES = ['BASELINE', 'TRIAGE', 'VISIT_PREP', 'CARE', 'PATTERN', 'RECOVERY'];
var STAGE_LABEL = {
  BASELINE: 'Baseline',
  TRIAGE: 'Triage',
  VISIT_PREP: 'Visit Prep',
  CARE: 'Care',
  PATTERN: 'Patterns',
  RECOVERY: 'Recovery'
};
var currentStage = 'TRIAGE';
var timeline = [];

var stageReplies = {
  BASELINE: [
    'Noted for your baseline. I\'ll remember durable facts like allergies, regular meds, and goals so you don\'t re-explain them later.',
    'Got it. Profile memory updated. You can add more anytime — sleep norms, stress patterns, or what "well" means for you.',
    'Saved. When you prepare a visit later, these baseline facts will show up in your brief automatically.'
  ],
  TRIAGE: [
    'Logged as a symptom event. On a scale of 1–10, how intense is it right now? Any triggers you noticed?',
    'I\'ve stored this in your timeline. If anything feels sudden or severe (chest pain, trouble breathing, sudden weakness), seek urgent care now.',
    'Recorded. I\'ll keep this linked to your history so patterns are easier to see over the next days.'
  ],
  VISIT_PREP: [
    'Here\'s a draft visit brief from what I remember so far:\n• Recent symptoms on your timeline\n• Questions you may want to ask\n• Goals for the visit\nWant me to refine any section?',
    'Visit prep ready. Lead with what changed since last time, then your top 2 questions. I can tighten the wording if you like.',
    'Brief updated. You can read this aloud or share it with your clinician when consent tools are enabled.'
  ],
  CARE: [
    'Logged against your care plan. Side effects and missed doses are stored without judgment — useful for your clinician later.',
    'Adherence note saved. If a med is hard to stick to, we can note barriers (timing, cost, side effects) for your next visit.',
    'Care memory updated. Your plan tasks stay here so nothing relies on short-term memory alone.'
  ],
  PATTERN: [
    'Hypothesis only: from your recent entries, similar symptoms often appear after disrupted sleep. Does that match what you feel?',
    'Looking across your timeline, there may be a cluster around stress and afternoon symptoms. Not a diagnosis — just a pattern to discuss.',
    'I can mark a pattern as "feels true" if you confirm it. Verified patterns help future visit briefs.'
  ],
  RECOVERY: [
    'Progress noted. Recovery is tracked as milestones, not a single finish line. What feels better this week?',
    'Logged. If symptoms return or worsen, switch back to Triage and contact your clinician as needed.',
    'Milestone saved. "Better" is defined by your care plan and how you feel day to day — both matter.'
  ]
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
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
    var placeholders = {
      BASELINE: 'Allergies, meds, goals, sleep norms…',
      TRIAGE: 'Describe a symptom (onset, severity, triggers)…',
      VISIT_PREP: 'Prepare my visit / questions for my clinician…',
      CARE: 'Med taken, side effect, care-plan task…',
      PATTERN: 'Why does this keep happening?',
      RECOVERY: 'What feels better / milestone…'
    };
    input.placeholder = placeholders[stage] || 'Message…';
  }
}

function addTimeline(label, detail) {
  timeline.unshift({ t: new Date().toLocaleString(), label: label, detail: detail });
  var list = document.getElementById('timeline-list');
  if (!list) return;
  list.innerHTML = timeline.slice(0, 12).map(function (item) {
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

document.querySelectorAll('[data-stage]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    setStage(btn.getAttribute('data-stage'));
  });
});

var chatForm = document.getElementById('chat-form');
var chatInput = document.getElementById('chat-input');

if (chatForm) {
  chatForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = (chatInput.value || '').trim();
    if (!text) return;

    var stage = routeFromText(text);
    setStage(stage);
    appendMessage(text, true);
    chatInput.value = '';
    addTimeline(STAGE_LABEL[stage], text.slice(0, 80));

    setTimeout(function () {
      var pool = stageReplies[stage] || stageReplies.TRIAGE;
      var reply = pool[Math.floor(Math.random() * pool.length)];
      appendMessage(reply, false, STAGE_LABEL[stage]);
    }, 600 + Math.random() * 500);
  });
}

setStage('TRIAGE');
addTimeline('System', 'Demo journey started — stages share one memory story');

if (window.location.hash === '#chat') {
  setTimeout(function () { if (chatInput) chatInput.focus(); }, 400);
}
