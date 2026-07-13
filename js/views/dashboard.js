// Home: net worth, this month vs budget, active alerts, recent activity.
import { getAll } from '../db.js';
import { refresh } from '../app.js';
import { activeAlerts, dismissAlert } from '../alerts.js';
import { openTxnForm } from './transactions.js';
import { barClass } from './budgets.js';
import {
  fmtMoney, fmtDate, escapeHtml, isDebt, currentMonthKey, fmtMonth,
} from '../utils.js';

export default {
  title: 'MyBudgeter',
  async render(el) {
    const [accounts, categories, txns] = await Promise.all([
      getAll('accounts'), getAll('categories'), getAll('transactions'),
    ]);

    const month = currentMonthKey();
    const assets = accounts.filter((a) => !isDebt(a)).reduce((s, a) => s + a.balance, 0);
    const debt = accounts.filter(isDebt).reduce((s, a) => s + a.balance, 0);
    const netWorth = assets - debt;

    const monthTxns = txns.filter((t) => t.date.slice(0, 7) === month);
    const monthSpent = monthTxns.filter((t) => t.kind === 'expense').reduce((s, t) => s + t.amount, 0);
    const monthIncome = monthTxns.filter((t) => t.kind === 'income').reduce((s, t) => s + t.amount, 0);
    const totalBudget = categories.filter((c) => !c.income).reduce((s, c) => s + (c.limit || 0), 0);

    const alerts = await activeAlerts({ accounts, categories, txns });
    const catById = Object.fromEntries(categories.map((c) => [c.id, c]));
    const recent = [...txns].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

    el.innerHTML = `
      <div class="stat-hero">
        <div class="label">Net worth</div>
        <div class="value" style="color:${netWorth < 0 ? 'var(--danger)' : 'var(--text)'}">${fmtMoney(netWorth)}</div>
        <div class="note" style="margin-top:4px">${fmtMoney(assets)} assets · ${fmtMoney(debt)} debt</div>
      </div>

      ${alerts.length ? `
        <div class="section-head"><h2>Needs attention</h2></div>
        <div id="alerts">
          ${alerts.map((a) => `
            <div class="alert ${a.level}" data-alert="${a.id}">
              <div class="grow">${a.html}</div>
              <button class="dismiss" aria-label="Dismiss">×</button>
            </div>`).join('')}
        </div>` : ''}

      <div class="card">
        <h2>${fmtMonth(month)}</h2>
        <div class="stat-grid" style="margin-bottom:0">
          <div class="stat" style="border:none;padding:2px 0">
            <div class="label">Spent</div>
            <div class="value">${fmtMoney(monthSpent)}</div>
          </div>
          <div class="stat" style="border:none;padding:2px 0">
            <div class="label">Income</div>
            <div class="value" style="color:var(--accent)">${fmtMoney(monthIncome)}</div>
          </div>
        </div>
        ${totalBudget ? `
          <div class="progress"><div class="${barClass(monthSpent, totalBudget)}"
            style="width:${Math.min(100, Math.round((monthSpent / totalBudget) * 100))}%"></div></div>
          <p class="note" style="margin-top:6px">${fmtMoney(monthSpent)} of ${fmtMoney(totalBudget)} total budget
            (${Math.round((monthSpent / totalBudget) * 100)}%)</p>`
          : '<p class="note" style="margin-top:8px">Set category limits on the Budgets tab to track spending against a plan.</p>'}
      </div>

      <button class="btn primary block" id="quick-add">+ Add transaction</button>

      <div class="section-head"><h2>Recent activity</h2></div>
      <div class="card">
        ${recent.length ? recent.map((t) => `
          <div class="row">
            <div class="grow">
              <div class="title">${escapeHtml(catById[t.categoryId]?.name || 'Uncategorized')}</div>
              <div class="sub">${fmtDate(t.date)}${t.note ? ` · ${escapeHtml(t.note)}` : ''}</div>
            </div>
            <div class="amount ${t.kind === 'expense' ? 'neg' : 'pos'}">
              ${fmtMoney(t.kind === 'expense' ? -t.amount : t.amount, { sign: t.kind === 'income' })}</div>
          </div>`).join('')
          : `<div class="empty">${accounts.length
              ? 'No transactions yet — tap “Add transaction” above.'
              : 'Start by adding an account on the Accounts tab.'}</div>`}
      </div>
    `;

    el.querySelector('#quick-add').addEventListener('click', () => openTxnForm());
    el.querySelectorAll('.alert .dismiss').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const box = e.target.closest('.alert');
        await dismissAlert(box.dataset.alert);
        box.remove();
        const wrap = el.querySelector('#alerts');
        if (wrap && !wrap.children.length) refresh();
      });
    });
  },
};
