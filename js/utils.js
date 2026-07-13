// Shared helpers. Amounts are integer cents everywhere in the data layer;
// only format to dollars at the UI boundary.

export function uid() {
  return crypto.randomUUID ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function fmtMoney(cents, { sign = false } = {}) {
  const abs = Math.abs(cents);
  const s = (abs / 100).toLocaleString('en-US', {
    style: 'currency', currency: 'USD',
  });
  if (cents < 0) return `-${s}`;
  return sign ? `+${s}` : s;
}

// "12.34" | "1,234" | "$12" -> cents (integer). Returns NaN if unparseable.
export function parseAmount(str) {
  const clean = String(str).replace(/[$,\s]/g, '');
  if (!clean || !/^-?\d*\.?\d{0,2}$/.test(clean)) return NaN;
  return Math.round(parseFloat(clean) * 100);
}

export function todayISO() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

// "2026-07" for grouping transactions/budgets by month.
export function monthKey(isoDate) {
  return isoDate.slice(0, 7);
}

export function currentMonthKey() {
  return monthKey(todayISO());
}

export function fmtDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function fmtMonth(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  });
}

// Next calendar occurrence of a day-of-month (e.g. bill due on the 28th).
// Clamps to the last day of short months.
export function nextDueDate(dueDay, from = new Date()) {
  const clamp = (y, m) => Math.min(dueDay, new Date(y, m + 1, 0).getDate());
  let y = from.getFullYear(), m = from.getMonth();
  let d = new Date(y, m, clamp(y, m));
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  if (d < today) {
    m += 1;
    d = new Date(y, m, clamp(y, m));
  }
  return d;
}

export function daysUntil(date, from = new Date()) {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((date - a) / 86400000);
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export const DEBT_TYPES = new Set(['credit', 'loan']);
export const isDebt = (account) => DEBT_TYPES.has(account.type);

export const ACCOUNT_TYPE_LABELS = {
  checking: 'Checking',
  savings: 'Savings',
  credit: 'Credit card',
  loan: 'Loan',
  other: 'Other',
};
