// Accounts & Debts: CRUD, with APR / minimum payment / due day on debts.
import { getAll, put, deleteAccountCascade } from '../db.js';
import { showModal, closeModal, refresh } from '../app.js';
import {
  uid, fmtMoney, parseAmount, escapeHtml, isDebt,
  ACCOUNT_TYPE_LABELS, nextDueDate, daysUntil,
} from '../utils.js';

function accountRow(a) {
  const debt = isDebt(a);
  const subBits = [ACCOUNT_TYPE_LABELS[a.type]];
  if (debt && a.apr > 0) subBits.push(`${a.apr}% APR`);
  if (debt && a.dueDay) {
    const days = daysUntil(nextDueDate(a.dueDay));
    subBits.push(days === 0 ? 'due today' : `due in ${days}d`);
  }
  const cls = debt ? 'neg' : (a.balance < 0 ? 'neg' : '');
  return `
    <div class="row" data-id="${a.id}" role="button">
      <div class="grow">
        <div class="title">${escapeHtml(a.name)}</div>
        <div class="sub">${subBits.join(' · ')}</div>
      </div>
      <div class="amount ${cls}">${debt ? '−' : ''}${fmtMoney(Math.abs(a.balance))}</div>
    </div>`;
}

export function openAccountForm(account = null) {
  const a = account || { type: 'checking', balance: 0 };
  const isNew = !account;
  showModal(`
    <h3>${isNew ? 'Add account' : 'Edit account'}</h3>
    <form id="account-form">
      <div class="field">
        <label for="af-name">Name</label>
        <input id="af-name" required maxlength="40" placeholder="e.g. Chase Checking"
               value="${escapeHtml(a.name || '')}">
      </div>
      <div class="field">
        <label for="af-type">Type</label>
        <select id="af-type">
          ${Object.entries(ACCOUNT_TYPE_LABELS).map(([v, l]) =>
            `<option value="${v}" ${a.type === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="af-balance" id="af-balance-label">Current balance</label>
        <input id="af-balance" inputmode="decimal" required placeholder="0.00"
               value="${(Math.abs(a.balance) / 100).toFixed(2)}">
      </div>
      <div id="debt-fields" hidden>
        <div class="field-row">
          <div class="field">
            <label for="af-apr">APR %</label>
            <input id="af-apr" inputmode="decimal" placeholder="e.g. 24.99" value="${a.apr ?? ''}">
          </div>
          <div class="field">
            <label for="af-min">Min payment</label>
            <input id="af-min" inputmode="decimal" placeholder="0.00"
                   value="${a.minPayment ? (a.minPayment / 100).toFixed(2) : ''}">
          </div>
        </div>
        <div class="field">
          <label for="af-due">Due day of month (1–31)</label>
          <input id="af-due" type="number" min="1" max="31" placeholder="e.g. 15" value="${a.dueDay ?? ''}">
        </div>
      </div>
      <div class="btn-row">
        ${isNew ? '' : '<button type="button" class="btn danger" id="af-delete">Delete</button>'}
        <button type="submit" class="btn primary">${isNew ? 'Add' : 'Save'}</button>
      </div>
    </form>
  `);

  const typeSel = document.getElementById('af-type');
  const debtFields = document.getElementById('debt-fields');
  const balLabel = document.getElementById('af-balance-label');
  const syncType = () => {
    const debt = isDebt({ type: typeSel.value });
    debtFields.hidden = !debt;
    balLabel.textContent = debt ? 'Amount owed' : 'Current balance';
  };
  syncType();
  typeSel.addEventListener('change', syncType);

  document.getElementById('account-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const balance = parseAmount(document.getElementById('af-balance').value);
    if (Number.isNaN(balance)) return alert('Enter a valid balance.');
    const type = typeSel.value;
    const next = {
      ...a,
      id: a.id || uid(),
      name: document.getElementById('af-name').value.trim(),
      type,
      balance: Math.abs(balance),
    };
    if (isDebt({ type })) {
      next.apr = parseFloat(document.getElementById('af-apr').value) || 0;
      const min = parseAmount(document.getElementById('af-min').value);
      next.minPayment = Number.isNaN(min) ? 0 : Math.max(0, min);
      const due = parseInt(document.getElementById('af-due').value, 10);
      next.dueDay = due >= 1 && due <= 31 ? due : null;
    } else {
      delete next.apr; delete next.minPayment; delete next.dueDay;
      // Assets may legitimately be negative (overdraft).
      next.balance = balance;
    }
    await put('accounts', next);
    closeModal();
    refresh();
  });

  const delBtn = document.getElementById('af-delete');
  if (delBtn) {
    delBtn.addEventListener('click', async () => {
      if (!confirm(`Delete "${a.name}" and all of its transactions? This cannot be undone.`)) return;
      await deleteAccountCascade(a.id);
      closeModal();
      refresh();
    });
  }
}

export default {
  title: 'Accounts',
  async render(el) {
    const accounts = await getAll('accounts');
    const assets = accounts.filter((a) => !isDebt(a));
    const debts = accounts.filter(isDebt);
    const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
    const totalDebt = debts.reduce((s, a) => s + a.balance, 0);

    el.innerHTML = `
      <div class="stat-grid">
        <div class="stat"><div class="label">Assets</div>
          <div class="value">${fmtMoney(totalAssets)}</div></div>
        <div class="stat"><div class="label">Debt</div>
          <div class="value" style="color:var(--danger)">${fmtMoney(totalDebt)}</div></div>
      </div>

      <div class="section-head"><h2>Accounts</h2></div>
      <div class="card" id="asset-list">
        ${assets.length ? assets.map(accountRow).join('')
          : '<div class="empty">No accounts yet. Add your checking or savings account to get started.</div>'}
      </div>

      <div class="section-head"><h2>Debts</h2></div>
      <div class="card" id="debt-list">
        ${debts.length ? debts.map(accountRow).join('')
          : '<div class="empty">No debts tracked. Add credit cards or loans to use the payoff planner.</div>'}
      </div>

      <button class="btn block" id="add-account">+ Add account or debt</button>
    `;

    el.querySelector('#add-account').addEventListener('click', () => openAccountForm());
    el.querySelectorAll('.row[data-id]').forEach((row) => {
      row.addEventListener('click', () => {
        const acc = accounts.find((x) => x.id === row.dataset.id);
        if (acc) openAccountForm(acc);
      });
    });
  },
};
