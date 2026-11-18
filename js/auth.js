let isRegisterMode = false;

function emailToKey(email) {
  return email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
}

function showAuthMsg(text, isError = true) {
  const msg = document.getElementById('auth-msg');
  msg.textContent = text;
  msg.className = `text-xs text-center font-medium ${isError ? 'text-rose-500' : 'text-emerald-600'}`;
  msg.classList.remove('hidden');
}

function toggleAuthMode() {
  isRegisterMode = !isRegisterMode;
  document.getElementById('auth-title').textContent = isRegisterMode ? 'BUAT AKUN' : 'LOGIN';
  document.getElementById('auth-submit-btn').textContent = isRegisterMode ? 'DAFTAR' : 'LOGIN';
  document.getElementById('auth-toggle-btn').textContent = isRegisterMode ? 'Sudah punya akun? Login' : "Don't have account yet?";
  document.getElementById('forgot-btn').classList.toggle('hidden', isRegisterMode);
  document.getElementById('auth-msg').classList.add('hidden');
}

async function handleForgotPass() {
  const email = document.getElementById('auth-email').value.trim().toLowerCase();
  if (!email) return showAuthMsg('Masukkan email Anda terlebih dahulu di kolom Email.');
  const uKey = emailToKey(email);
  try {
    const profile = await fbGet(`users/${uKey}/profile`);
    if (!profile) return showAuthMsg('Akun dengan email ini belum terdaftar.');
    const newPass = prompt('Masukkan password baru untuk akun ' + email + ' (min. 4 karakter):');
    if (newPass && newPass.length >= 4) {
      profile.password = btoa(newPass);
      await fbPut(`users/${uKey}/profile`, profile);
      showAuthMsg('Password berhasil diperbarui! Silakan login.', false);
    }
  } catch (e) {
    showAuthMsg('Gagal mereset password: ' + e.message);
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value.trim().toLowerCase();
  const password = document.getElementById('auth-password').value;
  const uKey = emailToKey(email);
  const encodedPass = btoa(password);

  showAuthMsg('Memproses...', false);

  try {
    const profile = await fbGet(`users/${uKey}/profile`);

    if (isRegisterMode) {
      if (profile && profile.email) {
        return showAuthMsg('Email sudah terdaftar! Klik "Sudah punya akun? Login".');
      }
      await fbPut(`users/${uKey}/profile`, {
        email: email,
        password: encodedPass,
        createdAt: Date.now()
      });
      await loginSuccess(uKey, email);
    } else {
      if (!profile || !profile.email) {
        return showAuthMsg('Akun belum terdaftar. Klik "Don\'t have account yet?" untuk daftar.');
      }
      if (profile.password !== encodedPass) {
        return showAuthMsg('Password salah! Silakan coba lagi.');
      }
      await loginSuccess(uKey, email);
    }
  } catch (err) {
    showAuthMsg('Kendala koneksi ke Firebase: ' + err.message);
  }
}

async function loginSuccess(uKey, email) {
  currentUserKey = uKey;
  currentUserEmail = email;
  localStorage.setItem(SESSION_USER_KEY, uKey);
  localStorage.setItem(SESSION_USER_KEY + '_email', email);

  document.getElementById('auth-overlay').classList.add('hidden');
  const bar = document.getElementById('user-Session-bar');
  if (bar) bar.classList.remove('hidden');
  const emailEl = document.getElementById('active-user-email');
  if (emailEl) emailEl.textContent = email;

  await loadUserData(uKey);
}

function logoutUser() {
  localStorage.removeItem(SESSION_USER_KEY);
  localStorage.removeItem(SESSION_USER_KEY + '_email');
  currentUserKey = null;
  currentUserEmail = null;
  trades = [];
  initialBalance = 2000000;
  document.getElementById('initial-balance').value = initialBalance;
  updateAll();

  const bar = document.getElementById('user-Session-bar');
  if (bar) bar.classList.add('hidden');
  document.getElementById('auth-overlay').classList.remove('hidden');
  document.getElementById('auth-form').reset();
  document.getElementById('auth-msg').classList.add('hidden');
}

async function loadUserData(uKey) {
  const localBackup = localStorage.getItem(STORE_KEY + '_' + uKey);
  const localBal = localStorage.getItem(BALANCE_KEY + '_' + uKey);
  if (localBackup) {
    trades = JSON.parse(localBackup);
    initialBalance = parseFloat(localBal || '2000000');
    document.getElementById('initial-balance').value = initialBalance;
    updateAll();
  }

  try {
    const cloudData = await fbGet(`users/${uKey}/jurnal_data`);
    if (cloudData) {
      trades = cloudData.trades || [];
      initialBalance = typeof cloudData.initialBalance === 'number' ? cloudData.initialBalance : 2000000;
    } else if (!localBackup) {
      trades = [];
      initialBalance = 2000000;
    }
    document.getElementById('initial-balance').value = initialBalance;
    localStorage.setItem(STORE_KEY + '_' + uKey, JSON.stringify(trades));
    localStorage.setItem(BALANCE_KEY + '_' + uKey, initialBalance.toString());
    updateAll();
  } catch (err) {
    console.warn('Menggunakan cadangan lokal:', err);
  }
}

updateAll();
if (currentUserKey && currentUserEmail) {
  loginSuccess(currentUserKey, currentUserEmail);
}
