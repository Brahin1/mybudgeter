// Transactions: quick-add (the daily-use path — keep it fast), filterable
// list, edit and delete. Adding/editing/deleting keeps account balances in
// sync via the db layer.
import { getAll, addTransaction, updateTransaction, deleteTransaction } from '../db.js';
import { showModal, closeModal, refresh } from '../app.js';
import {
  fmtMoney, parseAmount, todayISO, fmtDate, escapeHtml,
} from '../utils.js';

// Filters persist while the app is open so navigating away and back doesn't
// lose your place, but reset on next launch.
const filters = { accountId: '', categoryId: '', from: '', to: '' };

function sortCategories(cats) {
  return [...cats].sort((a, b) => (a.order ?? 50) - (b.order ?? 50) || a.name.localeCompare(b.name));
}

export async function openTxnForm(txn = null) {
  const [accounts, categories] = await Promise.all([
    getAll('accounts'), getAll('categories'),
  ]);
  if (!accounts.length) {
    showModal(`
      <h3>No accounts yet</h3>
      <p class="note" style="margin-bottom:14px">Transactions belong to an account.
      Add your first account and you're off.</p>
      <a class="btn primary block" href="#/accounts" id="goto-accounts">Go to Accounts</a>
    `);
    document.getElementById('goto-accounts').addEventListener('click', closeModal);
    return;
  }

  const t = txn || {
    kind: 'expense', date: todayISO(), accountId: accounts[0].id, amount: 0, note: '',
  };
  const isNew = !txn;
  const cats = sortCategories(categories);
  const incomeCat = categories.find((c) => c.income);

  showModal(`
    <h3>${isNew ? 'Add transaction' : 'Edit transaction'}</h3>
    <form id="txn-form">
      <div class="segment" id="tf-kind">
        <button type="button" data-kind="expense" class="expense ${t.kind === 'expense' ? 'active' : ''}">Expense</button>
        <button type="button" data-kind="income" class="income ${t.kind === 'income' ? 'active' : ''}">Income</button>
      </div>
      <div class="field">
        <label for="tf-amount">Amount</label>
        <input id="tf-amount" inputmode="decimal" required placeholder="0.00" autocomplete="off"
               value="${t.amount ? (t.amount / 100).toFixed(2) : ''}">
      </div>
      <div class="field-row">
        <div class="field">
          <label for="tf-date">Date</label>
          <input id="tf-date" type="date" required value="${t.date}">
        </div>
        <div class="field">
          <label for="tf-account">Account</label>
          <select id="tf-account">
            ${accounts.map((a) => `<option value="${a.id}" ${t.accountId === a.id ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field">
        <label for="tf-category">Category</label>
        <select id="tf-category">
          ${cats.map((c) => `<option value="${c.id}" ${t.categoryId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="tf-note">Note (optional)</label>
        <input id="tf-note" maxlength="80" placeholder="e.g. weekly groceries" value="${escapeHtml(t.note || '')}">
      </div>
      <div class="btn-row">
        ${isNew ? '' : '<button type="button" class="btn danger" id="tf-delete">Delete</button>'}
        <button type="submit" class="btn primary">${isNew ? 'Add' : 'Save'}</button>
      </div>
    </form>
  `);

  let kind = t.kind;
  const catSel = document.getElementById('tf-category');
  const kindSeg = document.getElementById('tf-kind');

  const syncKind = () => {
    kindSeg.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('active', b.dataset.kind === kind);
    });
    // Default income to the Income category (still changeable).
    if (kind === 'income' && incomeCat && isNew) catSel.value = incomeCat.id;
  };
  kindSeg.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-kind]');
    if (!b) return;
    kind = b.dataset.kind;
    syncKind();
  });
  syncKind();
  if (isNew) setTimeout(() => document.getElementById('tf-amount').focus(), 50);

  document.getElementById('txn-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseAmount(document.getElementById('tf-amount').value);
    if (Number.isNaN(amount) || amount <= 0) return alert('Enter an amount greater than zero.');
    const next = {
      ...t,
      kind,
      amount,
      date: document.getElementById('tf-date').value,
      accountId: document.getElementById('tf-account').value,
      categoryId: catSel.value,
      note: document.getElementById('tf-note').value.trim(),
    };
    if (isNew) await addTransaction(next);
    else await updateTransaction(next);
    closeModal();
    refresh();
  });

  const delBtn = document.getElementById('tf-delete');
  if (delBtn) {
    delBtn.addEventListener('click', async () => {
      if (!confirm('Delete this transaction? The account balance will be adjusted back.')) return;
      await deleteTransaction(t.id);
      closeModal();
      refresh();
    });
  }
}

export default {
  title: 'Activity',
  async render(el) {
    const [accounts, categories, txns] = await Promise.all([
      getAll('accounts'), getAll('categories'), getAll('transactions'),
    ]);
    const accById = Object.fromEntries(accounts.map((a) => [a.id, a]));
    const catById = Object.fromEntries(categories.map((c) => [c.id, c]));

    let list = txns;
    if (filters.accountId) list = list.filter((t) => t.accountId === filters.accountId);
    if (filters.categoryId) list = list.filter((t) => t.categoryId === filters.categoryId);
    if (filters.from) list = list.filter((t) => t.date >= filters.from);
    if (filters.to) list = list.filter((t) => t.date <= filters.to);
    list.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));

    const rows = list.map((t) => {
      const neg = t.kind === 'expense';
      const cat = catById[t.categoryId];
      const acc = accById[t.accountId];
      return `
        <div class="row" data-id="${t.id}" role="button">
          <div class="grow">
            <div class="title">${escapeHtml(cat ? cat.name : 'Uncategorized')}${t.note ? ` <span class="sub" style="display:inline">· ${escapeHtml(t.note)}</span>` : ''}</div>
            <div class="sub">${fmtDate(t.date)} · ${escapeHtml(acc ? acc.name : 'Deleted account')}</div>
          </div>
          <div class="amount ${neg ? 'neg' : 'pos'}">${fmtMoney(neg ? -t.amount : t.amount, { sign: !neg })}</div>
        </div>`;
    }).join('');

    el.innerHTML = `
      <div class="filters">
        <select id="fl-account">
          <option value="">All accounts</option>
          ${accounts.map((a) => `<option value="${a.id}" ${filters.accountId === a.id ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}
        </select>
        <select id="fl-category">
          <option value="">All categories</option>
          ${sortCategories(categories).map((c) => `<option value="${c.id}" ${filters.categoryId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="filters">
        <input id="fl-from" type="date" value="${filters.from}" aria-label="From date">
        <input id="fl-to" type="date" value="${filters.to}" aria-label="To date">
      </div>
      <div class="card">
        ${rows || `<div class="empty">${txns.length
          ? 'Nothing matches these filters.'
          : 'No transactions yet. Tap the + button to log your first one.'}</div>`}
      </div>
    `;

    const bind = (id, key) => {
      el.querySelector(id).addEventListener('change', (e) => {
        filters[key] = e.target.value;
        refresh();
      });
    };
    bind('#fl-account', 'accountId');
    bind('#fl-category', 'categoryId');
    bind('#fl-from', 'from');
    bind('#fl-to', 'to');

    el.querySelectorAll('.row[data-id]').forEach((row) => {
      row.addEventListener('click', () => {
        const t = txns.find((x) => x.id === row.dataset.id);
        if (t) openTxnForm(t);
      });
    });
  },
};
