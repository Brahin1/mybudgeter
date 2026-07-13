// Debt payoff simulation. Pure functions, no DOM, integer-cent amounts.
//
// Model (standard avalanche/snowball): you commit a fixed monthly budget =
// sum of all minimum payments + extra. Each month every debt accrues
// interest (APR/12), gets its minimum, and everything left over — including
// minimums freed up by paid-off debts — rolls into the current target debt.

const MAX_MONTHS = 600; // 50 years — beyond this we call it "never".

export function orderDebts(debts, strategy) {
  const d = [...debts];
  if (strategy === 'avalanche') {
    d.sort((a, b) => (b.apr || 0) - (a.apr || 0) || a.balance - b.balance);
  } else { // snowball
    d.sort((a, b) => a.balance - b.balance || (b.apr || 0) - (a.apr || 0));
  }
  return d;
}

export function simulatePayoff(debts, strategy, extra = 0) {
  const order = orderDebts(debts.filter((d) => d.balance > 0), strategy);
  const state = order.map((d) => ({
    id: d.id, name: d.name, apr: d.apr || 0,
    min: d.minPayment || 0, balance: d.balance,
    payoffMonth: null, interest: 0,
  }));
  const budget = state.reduce((s, d) => s + d.min, 0) + extra;

  const result = {
    strategy,
    order: state.map((d) => ({ id: d.id, name: d.name })),
    budget,
    totalInterest: 0,
    months: 0,
    schedule: [], // [{month, balances: {id: cents}, total}]
    neverPaysOff: false,
  };
  if (!state.length) return result;
  if (budget <= 0) {
    result.neverPaysOff = true;
    return result;
  }

  let month = 0;
  while (state.some((d) => d.balance > 0)) {
    month += 1;
    if (month > MAX_MONTHS) {
      result.neverPaysOff = true;
      break;
    }

    // 1. Interest accrues on open balances.
    for (const d of state) {
      if (d.balance <= 0) continue;
      const interest = Math.round(d.balance * (d.apr / 100 / 12));
      d.balance += interest;
      d.interest += interest;
      result.totalInterest += interest;
    }

    // 2. Minimum payments.
    let available = budget;
    for (const d of state) {
      if (d.balance <= 0) continue;
      const pay = Math.min(d.min, d.balance, available);
      d.balance -= pay;
      available -= pay;
    }

    // 3. Everything left attacks the target: first unpaid debt in order.
    for (const d of state) {
      if (available <= 0) break;
      if (d.balance <= 0) continue;
      const pay = Math.min(available, d.balance);
      d.balance -= pay;
      available -= pay;
    }

    for (const d of state) {
      if (d.balance <= 0 && d.payoffMonth === null) d.payoffMonth = month;
    }

    result.schedule.push({
      month,
      balances: Object.fromEntries(state.map((d) => [d.id, Math.max(0, d.balance)])),
      total: state.reduce((s, d) => s + Math.max(0, d.balance), 0),
    });
  }

  result.months = month > MAX_MONTHS ? MAX_MONTHS : month;
  result.perDebt = Object.fromEntries(state.map((d) => [d.id, {
    payoffMonth: d.payoffMonth, interest: d.interest,
  }]));
  return result;
}

// Month index (1-based, from now) -> "Mar 2027".
export function monthLabel(monthIndex) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + monthIndex);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
