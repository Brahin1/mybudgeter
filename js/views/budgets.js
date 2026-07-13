// Categories & budgets: monthly limit per category with color-coded
// progress (green < 80%, yellow 80–100%, red > 100%) for the current month.
import { getAll, put, del } from '../db.js';
import { showModal, closeModal, refresh } from '../app.js';
import {
  uid, fmtMoney, parseAmount, escapeHtml, currentMonthKey, fmtMonth, monthKey,
} from '../utils.js';

export function spentByCategory(txns, month) {
  const spent = {};
  for (const t of txns) {
    if (t.kind !== 'expense' || monthKey(t.date) !== month) continue;
    spent[t.categoryId] = (spent[t.categoryId] || 0) + t.amount;
  }
  return spent;
}

export function barClass(spent, limit) {
  if (!limit) return 'ok';
  const pct = spent / limit;
  if (pct > 1) return 'over';
  if (pct >= 0.8) return 'warn';
  return 'ok';
}

function openCategoryForm(cat = null) {
  const c = cat || {};
  const isNew = !cat;
  showModal(`
    <h3>${isNew ? 'Add category' : `Edit ${escapeHtml(c.name)}`}</h3>
    <form id="cat-form">
      <div class="field">
        <label for="cf-name">Name</label>
        <input id="cf-name" required maxlength="30" value="${escapeHtml(c.name || '')}"
               ${c.builtin ? 'readonly' : ''} placeholder="e.g. Pets">
      </div>
      <div class="field">
        <label for="cf-limit">Monthly limit (0 = no limit)</label>
        <input id="cf-limit" inputmode="decimal" placeholder="0.00"
               value="${c.limit ? (c.limit / 100).toFixed(2) : ''}">
      </div>
      <div class="btn-row">
        ${isNew || c.builtin ? '' : '<button type="button" class="btn danger" id="cf-delete">Delete</button>'}
        <button type="submit" class="btn primary">${isNew ? 'Add' : 'Save'}</button>
      </div>
    </form>
  `);

  document.getElementById('cat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const limit = parseAmount(document.getElementById('cf-limit').value || '0');
    if (Number.isNaN(limit) || limit < 0) return alert('Enter a valid limit.');
    await put('categories', {
      ...c,
      id: c.id || uid(),
      name: document.getElementById('cf-name').value.trim(),
      limit,
    });
    closeModal();
    refresh();
  });

  const delBtn = document.getElementById('cf-delete');
  if (delBtn) {
    delBtn.addEventListener('click', async () => {
      if (!confirm(`Delete "${c.name}"? Its transactions keep their history but show as Uncategorized.`)) return;
      await del('categories', c.id);
      closeModal();
      refresh();
    });
  }
}

export default {
  title: 'Budgets',
  async render(el) {
    const [categories, txns] = await Promise.all([
      getAll('categories'), getAll('transactions'),
    ]);
    const month = currentMonthKey();
    const spent = spentByCategory(txns, month);

    const cats = categories
      .filter((c) => !c.income)
      .sort((a, b) => (a.order ?? 50) - (b.order ?? 50) || a.name.localeCompare(b.name));

    const totalLimit = cats.reduce((s, c) => s + (c.limit || 0), 0);
    const totalSpent = cats.reduce((s, c) => s + (spent[c.id] || 0), 0);

    const rows = cats.map((c) => {
      const used = spent[c.id] || 0;
      const cls = barClass(used, c.limit);
      const pct = c.limit ? Math.min(100, Math.round((used / c.limit) * 100)) : 0;
      return `
        <div class="row" data-id="${c.id}" role="button" style="display:block">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="grow">
              <div class="title">${escapeHtml(c.name)}</div>
              <div class="sub">${c.limit
                ? `${fmtMoney(used)} of ${fmtMoney(c.limit)}${used > c.limit ? ` · ${fmtMoney(used - c.limit)} over` : ''}`
                : `${fmtMoney(used)} spent · no limit set`}</div>
            </div>
            ${c.limit ? `<span class="pill">${Math.round((used / c.limit) * 100)}%</span>` : ''}
          </div>
          ${c.limit ? `<div class="progress"><div class="${cls}" style="width:${pct}%"></div></div>` : ''}
        </div>`;
    }).join('');

    el.innerHTML = `
      <div class="card">
        <h2>${fmtMonth(month)}</h2>
        <div class="stat-hero" style="padding-bottom:4px">
          <div class="value">${fmtMoney(totalSpent)}</div>
          <div class="label" style="margin-top:4px">spent${totalLimit ? ` of ${fmtMoney(totalLimit)} budgeted` : ''}</div>
        </div>
        ${totalLimit ? `<div class="progress"><div class="${barClass(totalSpent, totalLimit)}"
          style="width:${Math.min(100, Math.round((totalSpent / totalLimit) * 100))}%"></div></div>` : ''}
      </div>

      <div class="section-head"><h2>Categories</h2></div>
      <div class="card">${rows || '<div class="empty">No categories.</div>'}</div>
      <button class="btn block" id="add-cat">+ Add custom category</button>
      <p class="note" style="margin-top:10px">Tap a category to set its monthly limit.</p>
    `;

    el.querySelector('#add-cat').addEventListener('click', () => openCategoryForm());
    el.querySelectorAll('.row[data-id]').forEach((row) => {
      row.addEventListener('click', () => {
        const c = categories.find((x) => x.id === row.dataset.id);
        if (c) openCategoryForm(c);
      });
    });
  },
};
