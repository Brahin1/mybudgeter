# MyBudgeter — Build Spec

Build "MyBudgeter": a fully offline-first Progressive Web App (PWA) for personal
budgeting, hosted free on GitHub Pages, installable on iPhone via Safari
"Add to Home Screen." No backend, no third-party APIs, no paid services, no
user accounts/login.

## Tech constraints
- Pure HTML/CSS/JavaScript. No framework, no build step, no npm dependencies —
  keeps GitHub Pages deployment trivial (it just serves the repo as-is).
- All data stored client-side in IndexedDB via a small wrapper module. Nothing
  is ever sent over the network at runtime — the app makes zero fetch/XHR
  calls after the initial page/asset load.
- Mobile-first design, optimized for iPhone Safari running as an installed
  home-screen app (standalone display mode, safe-area-inset padding for the
  notch/home indicator).
- Must work fully offline after first load (service worker caches all app
  assets, cache-first strategy).

## Core features

### 1. Accounts & Debts
- CRUD for accounts: checking, savings, credit card, loan, other.
- Fields: name, type, current balance; for debts add APR, minimum payment,
  due date.
- Net worth = total assets − total debts, shown on the dashboard.

### 2. Transactions
- Quick-add form: date, account, category, amount, income/expense, optional
  note. Should be fast — this is the thing I'll use daily.
- Transaction list, filterable by account / category / date range.
- Edit and delete.

### 3. Categories & Budgets
- Preloaded categories (groceries, dining, transport, utilities,
  subscriptions, etc.) plus ability to add custom ones.
- Monthly $ limit per category.
- Progress bar per category (spent vs. limit): green <80%, yellow 80–100%,
  red >100%.

### 4. Debt Payoff Planner
- Avalanche (highest APR first) and Snowball (smallest balance first),
  computed and shown side by side for comparison.
- Optional input: extra monthly payment amount.
- Output per strategy: payoff order, month-by-month projected balances,
  payoff date per debt, total interest paid.

### 5. Reminders (on-open, no push notifications)
- On app open, compute and surface: bills/debts due within 7 days, categories
  near/over budget, any account with a negative or unusually low balance.
- Dismissible per item, persists dismissal until next relevant trigger.

### 6. Dashboard / Home
- Net worth, this month's spend vs. total budget, current alerts, quick
  button to add a transaction.

### 7. Backup / Portability
- "Export backup" → downloads one JSON file with all data.
- "Import backup" → restores from that file (require confirmation, it's
  destructive).
- No automatic sync — data lives on this device only. State this plainly in
  the UI so it's never a surprise.

## PWA requirements
- `manifest.json`: name, short_name, icon set (include a 180×180 for iOS),
  `display: standalone`, theme/background colors.
- `apple-touch-icon` and `apple-mobile-web-app-capable` /
  `apple-mobile-web-app-status-bar-style` meta tags in `index.html` for
  correct iOS install/launch behavior.
- Service worker registered on load, caches all static assets so the app is
  fully usable with zero connectivity after the first visit.
- Safe-area-inset padding (`env(safe-area-inset-*)`) so the UI isn't
  obscured when installed full-screen.

## Repo & GitHub setup
- Create a new **public** GitHub repo on my account named `mybudgeter`
  (check `gh auth status` first — if not authenticated, tell me exactly what
  to run).
- Commit in separate, logical stages as you build — not one giant commit:
  1. Project scaffold + README
  2. PWA shell (manifest, service worker, icons)
  3. Data layer (IndexedDB wrapper)
  4. Accounts & debts UI
  5. Transactions UI
  6. Categories/budgets UI
  7. Debt payoff planner
  8. Reminders + dashboard
  9. Export/import
  10. Styling polish + iOS/responsive fixes
- Push to `main`, enable GitHub Pages (Settings → Pages → Deploy from branch
  → main → /root), and give me the live URL when it's done.
- Add a `.gitignore` excluding local export/backup files (e.g.
  `*.backup.json`, `*.export.json`) so real financial data can never get
  committed by accident.
- README covers: what the app does, iPhone install steps ("open in Safari →
  Share → Add to Home Screen"), and a note that all data is local-only with
  export/import instructions for moving it between devices.

## Explicitly out of scope (for now)
- No bank sync / Plaid / any external API.
- No user accounts or login.
- No server, database, or paid services of any kind.

Build it end to end, committing as you go per the stages above, then report
back with the GitHub Pages URL and a short summary of what's done vs. what's
left.
