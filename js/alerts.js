// On-open reminders. Each alert gets a stable id that encodes its trigger
// (the specific due date, the month, the threshold crossed), so a dismissal
// naturally expires when the next occurrence rolls around.
import { getMeta, setMeta } from './db.js';
import {
  fmtMoney, escapeHtml, isDebt, nextDueDate, daysUntil, currentMonthKey,
} from './utils.js';

const LOW_BALANCE_CENTS = 10000; // flag checking accounts under $100

export function computeAlerts({ accounts, categories, txns }) {
  const alerts = [];
  const month = currentMonthKey();

  // Bills / debts due within 7 days.
  for (const a of accounts) {
    if (!isDebt(a) || !a.dueDay || a.balance <= 0) continue;
    const due = nextDueDate(a.dueDay);
    const days = daysUntil(due);
    if (days > 7) continue;
    const dueISO = due.toISOString().slice(0, 10);
    const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
    alerts.push({
      id: `due:${a.id}:${dueISO}`,
      level: days <= 3 ? 'danger' : 'warn',
      html: `<b>${escapeHtml(a.name)}</b> payment due ${when}` +
        (a.minPayment ? ` — minimum ${fmtMoney(a.minPayment)}` : ''),
    });
  }

  // Categories near or over their monthly limit.
  const spent = {};
  for (const t of txns) {
    if (t.kind !== 'expense' || t.date.slice(0, 7) !== month) continue;
    spent[t.categoryId] = (spent[t.categoryId] || 0) + t.amount;
  }
  for (const c of categories) {
    if (!c.limit || c.income) continue;
    const used = spent[c.id] || 0;
    if (used > c.limit) {
      alerts.push({
        id: `budget:${c.id}:${month}:over`,
        level: 'danger',
        html: `<b>${escapeHtml(c.name)}</b> is ${fmtMoney(used - c.limit)} over its ${fmtMoney(c.limit)} budget this month`,
      });
    } else if (used >= c.limit * 0.8) {
      alerts.push({
        id: `budget:${c.id}:${month}:near`,
        level: 'warn',
        html: `<b>${escapeHtml(c.name)}</b> is at ${Math.round((used / c.limit) * 100)}% of its monthly budget (${fmtMoney(c.limit - used)} left)`,
      });
    }
  }

  // Negative or unusually low asset balances.
  for (const a of accounts) {
    if (isDebt(a)) continue;
    if (a.balance < 0) {
      alerts.push({
        id: `low:${a.id}:${month}:neg`,
        level: 'danger',
        html: `<b>${escapeHtml(a.name)}</b> balance is negative: ${fmtMoney(a.balance)}`,
      });
    } else if (a.type === 'checking' && a.balance < LOW_BALANCE_CENTS) {
      alerts.push({
        id: `low:${a.id}:${month}:low`,
        level: 'warn',
        html: `<b>${escapeHtml(a.name)}</b> is running low: ${fmtMoney(a.balance)}`,
      });
    }
  }

  return alerts;
}

export async function activeAlerts(data) {
  const dismissed = await getMeta('dismissedAlerts', {});
  return computeAlerts(data).filter((a) => !dismissed[a.id]);
}

export async function dismissAlert(id) {
  const dismissed = await getMeta('dismissedAlerts', {});
  dismissed[id] = Date.now();
  // Keep the map from growing forever: drop dismissals older than 90 days.
  const cutoff = Date.now() - 90 * 86400000;
  for (const [k, v] of Object.entries(dismissed)) {
    if (v < cutoff) delete dismissed[k];
  }
  await setMeta('dismissedAlerts', dismissed);
}
