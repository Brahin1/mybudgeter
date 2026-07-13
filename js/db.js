// IndexedDB data layer. Promise-based wrapper plus the domain operations
// the views use. All amounts are integer cents.
import { uid, isDebt } from './utils.js';

const DB_NAME = 'mybudgeter';
const DB_VERSION = 1;
export const STORES = ['accounts', 'transactions', 'categories', 'meta'];

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('accounts')) {
        db.createObjectStore('accounts', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('transactions')) {
        const tx = db.createObjectStore('transactions', { keyPath: 'id' });
        tx.createIndex('date', 'date');
        tx.createIndex('accountId', 'accountId');
        tx.createIndex('categoryId', 'categoryId');
      }
      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

const REQ_HOLDER = Symbol('reqHolder');

function op(storeName, mode, fn) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const result = fn(tx.objectStore(storeName), tx);
    tx.oncomplete = () => resolve(result && result[REQ_HOLDER] ? result.value : result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

// Wraps an IDBRequest so op() can resolve with its result (which may
// legitimately be undefined, e.g. get() on a missing key).
function reqValue(request) {
  const holder = { [REQ_HOLDER]: true, value: undefined };
  request.onsuccess = () => { holder.value = request.result; };
  return holder;
}

export const getAll = (store) => op(store, 'readonly', (s) => reqValue(s.getAll()));
export const get = (store, key) => op(store, 'readonly', (s) => reqValue(s.get(key)));
export const put = (store, value) => op(store, 'readwrite', (s) => { s.put(value); return value; });
export const del = (store, key) => op(store, 'readwrite', (s) => { s.delete(key); });
export const clear = (store) => op(store, 'readwrite', (s) => { s.clear(); });

export function bulkPut(store, values) {
  return op(store, 'readwrite', (s) => { values.forEach((v) => s.put(v)); });
}

// ---- meta helpers (settings, alert dismissals) ----

export async function getMeta(key, fallback = null) {
  const row = await get('meta', key);
  return row ? row.value : fallback;
}

export function setMeta(key, value) {
  return put('meta', { key, value });
}

// ---- first-run seed ----

const DEFAULT_CATEGORIES = [
  'Groceries', 'Dining', 'Transport', 'Utilities', 'Subscriptions',
  'Housing', 'Health', 'Entertainment', 'Shopping', 'Personal', 'Other',
];

export async function seedIfNeeded() {
  const seeded = await getMeta('seeded');
  if (seeded) return;
  const cats = DEFAULT_CATEGORIES.map((name, i) => ({
    id: uid(), name, limit: 0, builtin: true, order: i,
  }));
  // Income is a special builtin so income transactions have a home; it never
  // gets a spending limit.
  cats.push({ id: uid(), name: 'Income', limit: 0, builtin: true, income: true, order: 99 });
  await bulkPut('categories', cats);
  await setMeta('seeded', true);
}

// ---- transactions keep account balances in sync ----
// Convention: asset accounts hold what you have; debt accounts (credit/loan)
// hold what you owe, as a positive number. An expense on a credit card
// therefore *increases* its balance; income/payment decreases it.

function balanceDelta(account, txn) {
  const sign = isDebt(account)
    ? (txn.kind === 'expense' ? +1 : -1)
    : (txn.kind === 'expense' ? -1 : +1);
  return sign * txn.amount;
}

async function applyToBalance(txn, direction) {
  const account = await get('accounts', txn.accountId);
  if (!account) return;
  account.balance += direction * balanceDelta(account, txn);
  await put('accounts', account);
}

export async function addTransaction(txn) {
  txn.id = txn.id || uid();
  await put('transactions', txn);
  await applyToBalance(txn, +1);
  return txn;
}

export async function updateTransaction(txn) {
  const old = await get('transactions', txn.id);
  if (old) await applyToBalance(old, -1);
  await put('transactions', txn);
  await applyToBalance(txn, +1);
  return txn;
}

export async function deleteTransaction(id) {
  const old = await get('transactions', id);
  if (!old) return;
  await applyToBalance(old, -1);
  await del('transactions', id);
}

// Deleting an account orphans its transactions; remove them too so lists and
// budget math stay truthful.
export async function deleteAccountCascade(accountId) {
  const txns = await getAll('transactions');
  await Promise.all(
    txns.filter((t) => t.accountId === accountId).map((t) => del('transactions', t.id))
  );
  await del('accounts', accountId);
}

// ---- export / import ----

export async function exportAll() {
  const [accounts, transactions, categories, meta] = await Promise.all(
    STORES.map((s) => getAll(s))
  );
  return {
    app: 'mybudgeter',
    version: DB_VERSION,
    exportedAt: new Date().toISOString(),
    data: { accounts, transactions, categories, meta },
  };
}

export async function importAll(payload) {
  if (!payload || payload.app !== 'mybudgeter' || !payload.data) {
    throw new Error('Not a MyBudgeter backup file.');
  }
  for (const store of STORES) {
    await clear(store);
    await bulkPut(store, payload.data[store] || []);
  }
}
