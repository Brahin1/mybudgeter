// More: backup/restore and the plain-words privacy story.
import { exportAll, importAll } from '../db.js';
import { refresh } from '../app.js';
import { todayISO } from '../utils.js';

export default {
  title: 'More',
  async render(el) {
    el.innerHTML = `
      <div class="card">
        <h2>Backup</h2>
        <p class="note" style="margin-bottom:12px">
          Downloads one JSON file containing every account, transaction,
          category, and setting. Keep it somewhere safe — it's your only copy.
        </p>
        <button class="btn primary block" id="do-export">Export backup</button>
      </div>

      <div class="card">
        <h2>Restore</h2>
        <p class="note" style="margin-bottom:12px">
          Restores from a backup file. <b>This replaces everything currently
          in the app on this device</b> — you'll be asked to confirm.
        </p>
        <input type="file" id="import-file" accept=".json,application/json" hidden>
        <button class="btn block" id="do-import">Import backup…</button>
      </div>

      <div class="card">
        <h2>Where your data lives</h2>
        <p class="note">
          All data is stored only on this device, in the browser's local
          database. Nothing is uploaded anywhere — the app makes no network
          requests. There is <b>no automatic sync between devices</b>: to move
          data to another device, export a backup here and import it there.
          If you delete the app icon or clear Safari website data, this
          device's data can be erased with it, so export a backup now and then.
        </p>
      </div>

      <div class="card">
        <h2>About</h2>
        <p class="note">MyBudgeter — offline personal budgeting.
          Home shows your overview and alerts; Accounts holds balances and
          debts; Activity is your transaction log; Budgets sets category
          limits; and the Debt Payoff planner compares payoff strategies:
        </p>
        <a class="btn block" href="#/payoff" style="margin-top:10px">Open Debt Payoff planner</a>
      </div>
    `;

    el.querySelector('#do-export').addEventListener('click', async () => {
      const payload = await exportAll();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `mybudgeter-backup-${todayISO()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    });

    const fileInput = el.querySelector('#import-file');
    el.querySelector('#do-import').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      try {
        const payload = JSON.parse(await file.text());
        const counts = payload?.data
          ? `${(payload.data.accounts || []).length} accounts, ${(payload.data.transactions || []).length} transactions`
          : '';
        if (!confirm(`Import "${file.name}" (${counts})?\n\nThis REPLACES all current data on this device.`)) {
          fileInput.value = '';
          return;
        }
        await importAll(payload);
        alert('Backup restored.');
        location.hash = '#/home';
        refresh();
      } catch (err) {
        alert(`Import failed: ${err.message}`);
      } finally {
        fileInput.value = '';
      }
    });
  },
};
