function openAccountModal() {
  if (!currentUserKey) return;
  document.getElementById('acc-modal-email').textContent = currentUserEmail || '-';
  document.getElementById('acc-pass-form').reset();
  const msg = document.getElementById('acc-pass-msg');
  if (msg) msg.classList.add('hidden');

  const modal = document.getElementById('account-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex', 'modal-animate-backdrop');
}

function closeAccountModal() {
  const modal = document.getElementById('account-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex', 'modal-animate-backdrop');
}

function showAccMsg(text, isError = true) {
  const msg = document.getElementById('acc-pass-msg');
  if (!msg) return;
  msg.textContent = text;
  msg.className = `text-[11px] font-mono mt-1.5 ${isError ? 'text-rose-400' : 'text-emerald-400'}`;
  msg.classList.remove('hidden');
}

async function handleChangePassword(e) {
  e.preventDefault();
  if (!currentUserKey) return;

  const oldPass = document.getElementById('acc-old-pass').value;
  const newPass = document.getElementById('acc-new-pass').value;
  const confirmPass = document.getElementById('acc-confirm-pass').value;

  if (newPass.length < 4) {
    return showAccMsg('Password baru minimal 4 karakter.');
  }
  if (newPass !== confirmPass) {
    return showAccMsg('Konfirmasi password baru tidak cocok.');
  }

  showAccMsg('Memverifikasi password lama...', false);

  try {
    const profile = await fbGet(`users/${currentUserKey}/profile`);
    if (!profile || profile.password !== btoa(oldPass)) {
      return showAccMsg('Password lama salah!');
    }

    profile.password = btoa(newPass);
    profile.updatedAt = Date.now();
    await fbPut(`users/${currentUserKey}/profile`, profile);

    document.getElementById('acc-pass-form').reset();
    showAccMsg('Password berhasil diperbarui!', false);
  } catch (err) {
    showAccMsg('Gagal memperbarui password: ' + err.message);
  }
}

function exportBackupJSON() {
  const payload = {
    app: 'Jurnal Trading Analytics',
    version: 1,
    exportedAt: new Date().toISOString(),
    email: currentUserEmail || 'trader',
    initialBalance: initialBalance,
    trades: trades
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateTag = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `backup_jurnal_${dateTag}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function handleRestoreJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed || !Array.isArray(parsed.trades)) {
        alert('Format file backup JSON tidak valid!');
        return;
      }

      const replaceMode = confirm(
        `Ditemukan ${parsed.trades.length} transaksi di file backup.\n\n` +
        `Klik OK untuk MENGGANTI seluruh data saat ini dengan file backup.\n` +
        `Klik Batal untuk MENGGABUNGKAN dengan data yang sudah ada.`
      );

      if (replaceMode) {
        trades = parsed.trades;
        if (typeof parsed.initialBalance === 'number') {
          initialBalance = parsed.initialBalance;
          document.getElementById('initial-balance').value = initialBalance;
        }
      } else {
        const existingIds = new Set(trades.map(t => t.id));
        const newItems = parsed.trades.filter(t => !existingIds.has(t.id));
        trades = trades.concat(newItems);
      }

      saveToStorage();
      closeAccountModal();
      alert(`Restore berhasil! Total transaksi saat ini: ${trades.length} posisi.`);
    } catch (err) {
      alert('Gagal membaca file JSON: ' + err.message);
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}
