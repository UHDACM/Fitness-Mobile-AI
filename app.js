const root = document.documentElement;
const metaTheme = document.querySelector('meta[name="theme-color"]');
const toast = document.querySelector('[data-toast]');
let toastTimer;

function setTheme(theme) {
  root.dataset.theme = theme;
  localStorage.setItem('acm-mobile-theme', theme);
  metaTheme?.setAttribute('content', theme === 'dark' ? '#090909' : '#f7f4ec');
  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    button.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
  });
}

setTheme(localStorage.getItem('acm-mobile-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));

document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
  button.addEventListener('click', () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));
});

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function showScreen(name) {
  document.querySelectorAll('[data-screen]').forEach((screen) => screen.classList.toggle('is-active', screen.dataset.screen === name));
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function showView(name) {
  document.querySelectorAll('[data-view]').forEach((view) => view.classList.toggle('is-active', view.dataset.view === name));
  document.querySelectorAll('[data-tab]').forEach((tab) => tab.classList.toggle('is-active', tab.dataset.tab === name));
  document.querySelector('.app-content')?.scrollTo?.({ top: 0 });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelector('[data-enter-app]')?.addEventListener('click', () => showScreen('app'));
document.querySelector('[data-sign-out]')?.addEventListener('click', () => showScreen('auth'));

document.querySelectorAll('[data-provider]').forEach((button) => {
  button.addEventListener('click', () => showToast(`${button.dataset.provider} sign-in is a front-end preview only.`));
});

document.querySelectorAll('[data-tab]').forEach((button) => {
  button.addEventListener('click', () => showView(button.dataset.tab));
});

document.querySelectorAll('[data-nav-target]').forEach((button) => {
  button.addEventListener('click', () => showView(button.dataset.navTarget));
});

const actionMessages = {
  log: 'Workout logger preview opened.',
  form: 'Form camera preview opened.',
  calendar: 'Training calendar preview.',
  swap: 'Workout substitutes would appear here.',
  start: 'Workout started — prototype mode.',
  history: 'Nutrition history preview.',
  search: 'Food search preview.',
  meal: 'Meal builder preview.',
  'add-friend': 'Friend search preview.',
  invite: 'Challenge invite preview.',
  goals: 'Goals settings preview.',
  equipment: 'Equipment settings preview.',
  notifications: 'Notification settings preview.'
};

document.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.action === 'scan') { showView('scan'); return; }
    showToast(actionMessages[button.dataset.action] || 'Front-end interaction preview.');
  });
});

document.querySelectorAll('[data-cheer]').forEach((button) => {
  button.addEventListener('click', () => {
    button.textContent = button.textContent.includes('Sent') ? '⚡ 24' : '✓ Sent';
    showToast('Cheer sent!');
  });
});
