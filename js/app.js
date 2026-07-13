// App shell: hash router, modal helpers, FAB wiring.
import { seedIfNeeded } from './db.js';
import dashboard from './views/dashboard.js';
import accounts from './views/accounts.js';
import transactions, { openTxnForm } from './views/transactions.js';
import budgets from './views/budgets.js';
import payoffView from './views/payoffView.js';
import more from './views/more.js';

const routes = {
  home: dashboard,
  accounts,
  transactions,
  budgets,
  payoff: payoffView,
  more,
};

// Tabs where the floating "+" (quick-add transaction) makes sense.
const FAB_TABS = new Set(['home', 'accounts', 'transactions', 'budgets']);

const viewEl = document.getElementById('view');
const titleEl = document.getElementById('view-title');
const fab = document.getElementById('fab');
const modal = document.getElementById('modal');

let currentTab = 'home';

function parseHash() {
  const m = location.hash.match(/^#\/([a-z]+)/);
  return m && routes[m[1]] ? m[1] : 'home';
}

export async function refresh() {
  const tab = currentTab;
  const view = routes[tab];
  titleEl.textContent = view.title;
  document.querySelectorAll('.tabbar a').forEach((a) => {
    a.classList.toggle('active', a.dataset.tab === tab);
  });
  fab.hidden = !FAB_TABS.has(tab);
  viewEl.innerHTML = '<div class="loading">Loading…</div>';
  await view.render(viewEl);
  viewEl.scrollTop = 0;
}

async function onRoute() {
  currentTab = parseHash();
  await refresh();
}

// ---- modal helpers ----

export function showModal(html) {
  modal.innerHTML = html;
  if (!modal.open) modal.showModal();
}

export function closeModal() {
  if (modal.open) modal.close();
  modal.innerHTML = '';
}

modal.addEventListener('click', (e) => {
  // Click on the backdrop (the dialog element itself) closes.
  if (e.target === modal) closeModal();
});
modal.addEventListener('cancel', () => { modal.innerHTML = ''; });

fab.addEventListener('click', () => openTxnForm());

window.addEventListener('hashchange', onRoute);

(async function init() {
  await seedIfNeeded();
  if (!location.hash) location.replace('#/home');
  await onRoute();
})();
