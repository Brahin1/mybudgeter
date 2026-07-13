// Debt Payoff Planner: Avalanche vs Snowball side by side, with optional
// extra monthly payment and a month-by-month projection table.
import { getAll, getMeta, setMeta } from '../db.js';
import { refresh } from '../app.js';
import { simulatePayoff, monthLabel } from '../payoff.js';
import { fmtMoney, parseAmount, escapeHtml, isDebt } from '../utils.js';

function strategyCard(sim, title, blurb, highlight) {
  if (sim.neverPaysOff) {
    return `
      <div class="card" ${highlight ? 'style="border-color:var(--accent-dim)"' : ''}>
        <h2>${title}</h2>
        <div class="empty">At the current payment level this debt never pays off —
        interest grows faster than payments. Set minimum payments on your debts
        or add an extra monthly amount.</div>
      </div>`;
  }
  const orderList = sim.order.map((d, i) => {
    const info = sim.perDebt[d.id];
    return `<div class="row">
      <div class="grow">
        <div class="title">${i + 1}. ${escapeHtml(d.name)}</div>
        <div class="sub">paid off ${info.payoffMonth ? monthLabel(info.payoffMonth) : '—'}</div>
      </div>
      <div class="amount">${fmtMoney(info.interest)} interest</div>
    </div>`;
  }).join('');

  return `
    <div class="card" ${highlight ? 'style="border-color:var(--accent-dim)"' : ''}>
      <h2>${title}${highlight ? ' · cheapest' : ''}</h2>
      <p class="note" style="margin-bottom:10px">${blurb}</p>
      <div class="stat-grid" style="margin-bottom:4px">
        <div class="stat"><div class="label">Debt-free</div>
          <div class="value">${monthLabel(sim.months)}</div></div>
        <div class="stat"><div class="label">Total interest</div>
          <div class="value">${fmtMoney(sim.totalInterest)}</div></div>
      </div>
      ${orderList}
      <details style="margin-top:10px">
        <summary class="note" style="cursor:pointer">Month-by-month balances</summary>
        <div style="overflow-x:auto;margin-top:8px">
          <table class="plan">
            <tr><th>Month</th>${sim.order.map((d) => `<th class="num">${escapeHtml(d.name)}</th>`).join('')}<th class="num">Total</th></tr>
            ${sim.schedule.map((s) => `
              <tr><td>${monthLabel(s.month)}</td>
                ${sim.order.map((d) => `<td class="num">${fmtMoney(s.balances[d.id])}</td>`).join('')}
                <td class="num">${fmtMoney(s.total)}</td></tr>`).join('')}
          </table>
        </div>
      </details>
    </div>`;
}

export default {
  title: 'Debt Payoff',
  async render(el) {
    const accounts = await getAll('accounts');
    const debts = accounts.filter((a) => isDebt(a) && a.balance > 0);

    if (!debts.length) {
      el.innerHTML = `
        <div class="empty" style="padding-top:60px">
          No debts with a balance. Add a credit card or loan on the
          <a href="#/accounts" style="color:var(--accent)">Accounts</a> tab
          and the payoff planner lights up.
        </div>`;
      return;
    }

    const extra = await getMeta('payoffExtra', 0);
    const avalanche = simulatePayoff(debts, 'avalanche', extra);
    const snowball = simulatePayoff(debts, 'snowball', extra);
    const comparable = !avalanche.neverPaysOff && !snowball.neverPaysOff;
    const saved = comparable ? snowball.totalInterest - avalanche.totalInterest : 0;

    const missingMin = debts.filter((d) => !d.minPayment);

    el.innerHTML = `
      <div class="card">
        <h2>Your plan</h2>
        <div class="field" style="margin-bottom:6px">
          <label for="po-extra">Extra payment per month, on top of minimums</label>
          <input id="po-extra" inputmode="decimal" placeholder="0.00"
                 value="${extra ? (extra / 100).toFixed(2) : ''}">
        </div>
        <p class="note">Monthly commitment: ${fmtMoney(avalanche.budget)}
          (${fmtMoney(avalanche.budget - extra)} in minimums + ${fmtMoney(extra)} extra)</p>
        ${missingMin.length ? `<p class="note" style="color:var(--warn);margin-top:6px">
          ⚠ No minimum payment set on: ${missingMin.map((d) => escapeHtml(d.name)).join(', ')}.
          Edit them in Accounts for accurate projections.</p>` : ''}
      </div>

      ${comparable && saved !== 0 ? `
        <div class="alert info"><div class="grow">
          ${saved > 0
            ? `<b>Avalanche saves you ${fmtMoney(saved)}</b> in interest vs. Snowball.
               Snowball's earlier small wins can help motivation — your call.`
            : `<b>Snowball saves you ${fmtMoney(-saved)}</b> here — unusual, but the
               numbers don't lie.`}
        </div></div>` : ''}

      ${strategyCard(avalanche, 'Avalanche', 'Highest interest rate first — mathematically cheapest.', comparable && saved >= 0)}
      ${strategyCard(snowball, 'Snowball', 'Smallest balance first — quick wins, fewer bills sooner.', comparable && saved < 0)}
    `;

    const extraInput = el.querySelector('#po-extra');
    extraInput.addEventListener('change', async () => {
      const v = parseAmount(extraInput.value || '0');
      if (Number.isNaN(v) || v < 0) return alert('Enter a valid amount.');
      await setMeta('payoffExtra', v);
      refresh();
    });
  },
};
