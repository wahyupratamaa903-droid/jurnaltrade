const STORE_KEY = 'sheet_trading_data_v2';
const BALANCE_KEY = 'sheet_trading_init_bal';
const SESSION_USER_KEY = 'jurnal_logged_in_user';
const DB_URL = "https://jurnal-trading-514b2-default-rtdb.asia-southeast1.firebasedatabase.app";

let currentUserKey = localStorage.getItem(SESSION_USER_KEY) || null;
let currentUserEmail = localStorage.getItem(SESSION_USER_KEY + '_email') || null;
let trades = [];
let initialBalance = 2000000;
let lastSyncedAt = 0;
let autoSyncTimer = null;

async function fbGet(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${DB_URL}/${path}.json`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error("Akses ditolak oleh server Firebase");
    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

async function fbPut(path, data) {
  const res = await fetch(`${DB_URL}/${path}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const errDetail = await res.text();
    throw new Error(`Status ${res.status}: ${errDetail}`);
  }
  return await res.json();
}

function detectSession() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 14) return 'Asia';
  if (hour >= 14 && hour < 20) return 'London';
  return 'New York';
}

function saveToStorage() {
  const now = Date.now();
  lastSyncedAt = now;
  updateAll();

  if (currentUserKey) {
    localStorage.setItem(STORE_KEY + '_' + currentUserKey, JSON.stringify(trades));
    localStorage.setItem(BALANCE_KEY + '_' + currentUserKey, initialBalance.toString());
    fbPut(`users/${currentUserKey}/jurnal_data`, {
      initialBalance: initialBalance,
      trades: trades,
      updatedAt: now
    }).catch(err => console.error('Gagal simpan ke cloud:', err));
  }
}

// Auto-refresh ringan: hanya cek timestamp updatedAt (~15 byte) sebelum mengunduh data
async function checkCloudUpdates() {
  if (!currentUserKey || document.hidden) return;
  try {
    const remoteUpdatedAt = await fbGet(`users/${currentUserKey}/jurnal_data/updatedAt`);
    if (typeof remoteUpdatedAt === 'number' && remoteUpdatedAt > lastSyncedAt) {
      const cloudData = await fbGet(`users/${currentUserKey}/jurnal_data`);
      if (cloudData) {
        trades = cloudData.trades || [];
        initialBalance = typeof cloudData.initialBalance === 'number' ? cloudData.initialBalance : 2000000;
        lastSyncedAt = cloudData.updatedAt || Date.now();
        document.getElementById('initial-balance').value = initialBalance;
        localStorage.setItem(STORE_KEY + '_' + currentUserKey, JSON.stringify(trades));
        localStorage.setItem(BALANCE_KEY + '_' + currentUserKey, initialBalance.toString());
        updateAll();
      }
    }
  } catch (e) {
    // Abaikan sementara jika sinyal sedang terputus
  }
}

function startAutoSync() {
  stopAutoSync();
  autoSyncTimer = setInterval(checkCloudUpdates, 6000);
}

function stopAutoSync() {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer);
    autoSyncTimer = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && currentUserKey) {
    checkCloudUpdates();
  }
});

document.getElementById('initial-balance').addEventListener('change', () => {
  initialBalance = parseFloat(document.getElementById('initial-balance').value) || 0;
  saveToStorage();
});
