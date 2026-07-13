# MyBudgeter

A fully offline personal budgeting app that runs in your browser and installs
on your iPhone like a native app. No accounts, no servers, no tracking — your
financial data never leaves your device.

## What it does

- **Accounts & Debts** — track checking, savings, credit cards, and loans in
  one place, with net worth on the dashboard.
- **Transactions** — quick-add daily spending and income, filter by account,
  category, or date range.
- **Budgets** — set a monthly limit per category and watch color-coded
  progress bars (green → yellow → red).
- **Debt Payoff Planner** — compare Avalanche (highest APR first) vs.
  Snowball (smallest balance first) side by side: payoff order, dates, and
  total interest for each strategy.
- **Reminders** — every time you open the app it flags bills due within
  7 days, categories near or over budget, and low account balances.
- **Backup** — export all data to a single JSON file; import it on another
  device to move your data.

## Install on iPhone

1. Open the app URL in **Safari**.
2. Tap the **Share** button (square with an arrow).
3. Tap **Add to Home Screen**, then **Add**.

It now launches full-screen from its own icon and works completely offline.

## Your data is local-only

All data is stored on the device you're using, in the browser's local
database (IndexedDB). Nothing is ever sent over the network — the app makes
zero network requests after the initial load.

That also means **there is no automatic sync between devices**. To move data
(e.g. from your computer to your phone):

1. On the old device: **More → Export backup** — downloads a `.json` file.
2. Get the file to the new device (AirDrop, email to yourself, iCloud, etc.).
3. On the new device: **More → Import backup** and select the file.
   Importing replaces everything on that device, so it asks for confirmation.

> Tip: export a backup every so often. If you clear Safari's website data or
> delete the app icon, the local database can be erased with it.

## Development

Plain HTML/CSS/JavaScript — no framework, no build step, no dependencies.
Serve the folder with any static file server to run locally, e.g.:

```
python -m http.server 8000
```

Then open http://localhost:8000.
