/* Cadence frontend logic */

// ---------- Theme ----------
const html = document.documentElement;
const themeToggle = document.getElementById('theme-toggle');

function getPreferredTheme() {
  const stored = localStorage.getItem('cadence-theme');
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function setTheme(theme) {
  if (theme === 'dark') {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
  localStorage.setItem('cadence-theme', theme);
}

setTheme(getPreferredTheme());

themeToggle?.addEventListener('click', () => {
  const next = html.classList.contains('dark') ? 'light' : 'dark';
  setTheme(next);
});

// ---------- Water-drop press + ripple ----------
document.querySelectorAll('.water-btn').forEach(btn => {
  btn.addEventListener('pointerdown', (e) => {
    const rect = btn.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    btn.style.setProperty('--x', `${x}%`);
    btn.style.setProperty('--y', `${y}%`);

    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  });
});

// ---------- Smooth parallax ----------
const parallaxEls = document.querySelectorAll('[data-parallax]');

function updateParallax() {
  const scrollY = window.scrollY;
  parallaxEls.forEach(el => {
    const speed = parseFloat(el.dataset.parallax) || 0.1;
    const rect = el.getBoundingClientRect();
    if (rect.bottom > 0 && rect.top < window.innerHeight) {
      const offset = (scrollY - (el.offsetTop - window.innerHeight * 0.5)) * speed * 0.15;
      el.style.transform = `translate3d(0, ${offset}px, 0)`;
    }
  });
}

let ticking = false;
window.addEventListener('scroll', () => {
  if (!ticking) {
    requestAnimationFrame(() => {
      updateParallax();
      ticking = false;
    });
    ticking = true;
  }
}, { passive: true });

updateParallax();

// ---------- Demo chat ----------
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');

const demoReplies = [
  "I've noted that. I'll store it in long-term semantic memory so we can track patterns over time.",
  "Thanks for sharing. Based on what you've told me previously, this seems consistent with earlier mentions. Would you like me to prepare a short summary for your doctor?",
  "Understood. No emergency flags from the details so far. Keep monitoring and let me know if anything changes — intensity, new symptoms, or duration.",
  "Got it. I've linked this to your existing profile. Remember: this is a local assistant only — please consult a clinician for any medical decisions.",
  "Recorded. Your memory now includes this event. You can ask me later to recall symptoms from the past week or month."
];

function escapeHtml(str) {
  return str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}

function appendMessage(text, isUser = false) {
  const wrapper = document.createElement('div');
  wrapper.className = `flex gap-3 msg-enter ${isUser ? 'justify-end' : ''}`;

  if (isUser) {
    wrapper.innerHTML = `
      <div class="bg-gradient-to-br from-cadence-500 to-indigo-500 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm max-w-[85%]">${escapeHtml(text)}</div>
      <div class="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0"></div>
    `;
  } else {
    wrapper.innerHTML = `
      <div class="w-8 h-8 rounded-full bg-gradient-to-br from-cadence-400 to-indigo-500 flex-shrink-0"></div>
      <div class="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm max-w-[85%]">${escapeHtml(text)}</div>
    `;
  }

  chatMessages.appendChild(wrapper);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

chatForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;

  appendMessage(text, true);
  chatInput.value = '';

  setTimeout(() => {
    const reply = demoReplies[Math.floor(Math.random() * demoReplies.length)];
    appendMessage(reply, false);
  }, 700 + Math.random() * 600);
});

if (window.location.hash === '#chat') {
  setTimeout(() => chatInput?.focus(), 400);
}
