function applyTableFilters() {
  renderSheet();
}

function openModal(tradeId = null) {
  const form = document.getElementById('trade-form');
  form.reset();

  if (tradeId) {
    const item = trades.find(t => t.id === tradeId);
    if (item) {
      document.getElementById('modal-title').innerHTML = '<i class="fas fa-pen-to-square text-amber-400"></i> Edit Transaksi';
      document.getElementById('edit-id').value = item.id;
      document.getElementById('m-date').value = item.date;
      document.getElementById('m-session').value = item.session || 'Asia';
      document.getElementById('m-pair').value = item.pair;
      document.getElementById('m-side').value = item.side;
      document.getElementById('m-lot').value = item.lot;
      document.getElementById('m-rr').value = item.rr;
      document.getElementById('m-risk').value = item.risk || '';
      document.getElementById('m-status').value = item.status;
      document.getElementById('m-nominal').value = item.status === 'SL' ? item.loss : item.profit;
      document.getElementById('m-pips').value = item.pips !== '-' ? item.pips : '';
      document.getElementById('m-reason').value = item.reason !== '-' ? item.reason : '';
      document.getElementById('m-info').value = item.info !== '-' ? item.info : '';
      document.getElementById('m-doc').value = item.doc || '';
      document.getElementById('submit-btn').textContent = 'Perbarui Transaksi';
    }
  } else {
    document.getElementById('modal-title').innerHTML = '<i class="fas fa-pen-to-square text-emerald-400"></i> Catat Transaksi Baru';
    document.getElementById('edit-id').value = '';
    document.getElementById('submit-btn').textContent = 'Simpan ke Sheet';
    const now = new Date();
    document.getElementById('m-date').value = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    document.getElementById('m-session').value = detectSession();
  }

  const modal = document.getElementById('entry-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex', 'modal-animate-backdrop');
}

function closeModal() {
  const modal = document.getElementById('entry-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex', 'modal-animate-backdrop');
}

function openDetailModal(id) {
  const item = trades.find(t => t.id === id);
  if (!item) return;

  document.getElementById('detail-pair').textContent = `${item.pair} (${item.lot} Lot)`;
  const sideEl = document.getElementById('detail-side');
  sideEl.textContent = item.side;
  sideEl.className = `font-mono text-[10px] px-1.5 py-0.5 rounded font-bold ${item.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`;
  document.getElementById('detail-session').textContent = `• Sesi ${item.session || 'Asia'}`;

  document.getElementById('detail-reason').textContent = item.reason || '-';
  document.getElementById('detail-info').textContent = item.info || '-';

  const docContainer = document.getElementById('detail-doc-container');
  const docLink = document.getElementById('detail-doc-link');
  if (item.doc) {
    docLink.href = item.doc;
    docContainer.classList.remove('hidden');
  } else {
    docContainer.classList.add('hidden');
  }

  document.getElementById('detail-edit-btn').onclick = function() {
    closeDetailModal();
    openModal(item.id);
  };

  const modal = document.getElementById('detail-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex', 'modal-animate-backdrop');
}

function closeDetailModal() {
  const modal = document.getElementById('detail-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex', 'modal-animate-backdrop');
}

function handleFormSubmit(e) {
  e.preventDefault();
  const editId = document.getElementById('edit-id').value;
  const status = document.getElementById('m-status').value;
  const nominal = parseFloat(document.getElementById('m-nominal').value) || 0;

  let profit = 0;
  let loss = 0;
  if (status === 'TP' || status === 'SL+') profit = nominal;
  else if (status === 'SL') loss = nominal;

  const tradeData = {
    date: document.getElementById('m-date').value,
    session: document.getElementById('m-session').value,
    pair: document.getElementById('m-pair').value.toUpperCase(),
    side: document.getElementById('m-side').value,
    lot: document.getElementById('m-lot').value,
    rr: document.getElementById('m-rr').value || '-',
    risk: parseFloat(document.getElementById('m-risk').value) || 0,
    status: status,
    profit: profit,
    loss: loss,
    pips: document.getElementById('m-pips').value || '-',
    reason: document.getElementById('m-reason').value || '-',
    info: document.getElementById('m-info').value || '-',
    doc: document.getElementById('m-doc').value || ''
  };

  if (editId) {
    const index = trades.findIndex(t => t.id === parseInt(editId));
    if (index !== -1) trades[index] = { ...trades[index], ...tradeData };
  } else {
    tradeData.id = Date.now();
    trades.push(tradeData);
  }

  saveToStorage();
  closeModal();
}

function deleteRow(id) {
  if (confirm('Hapus baris transaksi ini?')) {
    const rowEl = document.querySelector(`tr[data-trade-id="${id}"]`);
    if (rowEl) {
      rowEl.classList.add('row-removing');
      setTimeout(() => {
        trades = trades.filter(t => t.id !== id);
        saveToStorage();
      }, 280);
    } else {
      trades = trades.filter(t => t.id !== id);
      saveToStorage();
    }
  }
}

function renderSheet() {
  const tbody = document.getElementById('sheet-body');
  const badge = document.getElementById('total-rows-badge');

  const baseList = typeof getPeriodScopedTrades === 'function'
    ? getPeriodScopedTrades().scopedTrades
    : trades;

  const qPair = (document.getElementById('filter-pair')?.value || '').trim().toUpperCase();
  const qSession = document.getElementById('filter-session')?.value || 'ALL';
  const qStatus = document.getElementById('filter-status')?.value || 'ALL';

  const indexedTrades = baseList.map((t, i) => ({ ...t, origIndex: i + 1 }));
  const filtered = indexedTrades.filter(t => {
    const matchPair = !qPair || (t.pair || '').includes(qPair);
    const matchSess = qSession === 'ALL' || (t.session || 'Asia') === qSession;
    const matchStat = qStatus === 'ALL' || t.status === qStatus;
    return matchPair && matchSess && matchStat;
  });

  if (badge) {
    badge.textContent = filtered.length === baseList.length
      ? `${baseList.length} Posisi Tercatat`
      : `${filtered.length} dari ${baseList.length} Posisi`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="17" class="p-8 text-center text-slate-500 font-sans">
          ${baseList.length === 0
            ? 'Belum ada data transaksi pada periode ini.'
            : 'Tidak ada transaksi yang cocok dengan filter.'}
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((t) => {
    const sideBadge = t.side === 'BUY'
      ? '<span class="bg-emerald-950/80 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded text-[9px] font-bold">BUY</span>'
      : '<span class="bg-rose-950/80 text-rose-400 border border-rose-800 px-1.5 py-0.5 rounded text-[9px] font-bold">SELL</span>';

    let statusBadge = '';
    if (t.status === 'TP') statusBadge = '<span class="bg-emerald-600 text-slate-950 font-black px-2 py-0.5 rounded text-[9px]">TP</span>';
    else if (t.status === 'SL') statusBadge = '<span class="bg-rose-600 text-white font-black px-2 py-0.5 rounded text-[9px]">SL</span>';
    else if (t.status === 'SL+') statusBadge = '<span class="bg-yellow-500 text-slate-950 font-black px-1.5 py-0.5 rounded text-[9px]">SL+</span>';
    else statusBadge = '<span class="bg-slate-700 text-slate-300 font-bold px-1.5 py-0.5 rounded text-[9px]">BE</span>';

    const eqValue = typeof t.calculatedEquity === 'number' ? t.calculatedEquity : initialBalance;

    return `
      <tr data-trade-id="${t.id}" class="trade-row">
        <td class="p-2 text-center text-slate-500">${t.origIndex}</td>
        <td class="p-2 font-medium text-slate-300">${t.date}</td>
        <td class="p-2 text-center text-[10px] text-slate-400 font-sans">${t.session || 'Asia'}</td>
        <td class="p-2 text-center">${sideBadge}</td>
        <td class="p-2 text-right text-slate-200 font-bold">${t.lot}</td>
        <td class="p-2 font-bold text-amber-400">${t.pair}</td>
        <td class="p-2 text-center text-slate-400">${t.rr}</td>
        <td class="p-2 text-right text-slate-400">${t.risk ? t.risk.toLocaleString('id-ID') : '-'}</td>
        <td class="p-2 text-center">${statusBadge}</td>
        <td class="p-2 text-right font-bold text-emerald-400">${t.profit ? t.profit.toLocaleString('id-ID') : '-'}</td>
        <td class="p-2 text-right font-bold text-rose-400">${t.loss ? t.loss.toLocaleString('id-ID') : '-'}</td>
        <td class="p-2 text-right text-slate-300">${t.pips}</td>
        <td onclick="openDetailModal(${t.id})" class="p-2 text-slate-300 max-w-[200px] truncate cursor-pointer hover:text-amber-400 hover:bg-slate-800/80 transition" title="Klik untuk baca">
          <i class="fas fa-eye text-[9px] text-slate-500 mr-1"></i> ${t.reason}
        </td>
        <td onclick="openDetailModal(${t.id})" class="p-2 text-slate-400 max-w-[200px] truncate cursor-pointer hover:text-blue-400 hover:bg-slate-800/80 transition" title="Klik untuk baca">
          <i class="fas fa-eye text-[9px] text-slate-500 mr-1"></i> ${t.info}
        </td>
        <td class="p-2 text-right font-bold text-slate-100">Rp ${eqValue.toLocaleString('id-ID')}</td>
        <td class="p-2 text-center">
          ${t.doc ? `<a href="${t.doc}" target="_blank" class="text-blue-400 hover:underline"><i class="fas fa-arrow-up-right-from-square"></i></a>` : '-'}
        </td>
        <td class="p-2 text-center space-x-1">
          <button onclick="openModal(${t.id})" title="Edit" class="text-slate-500 hover:text-amber-400 p-1 transition"><i class="fas fa-pen-to-square"></i></button>
          <button onclick="deleteRow(${t.id})" title="Hapus" class="text-slate-500 hover:text-rose-400 p-1 transition"><i class="fas fa-trash-can"></i></button>
        </td>
      </tr>
    `;
  }).join('');
}

function exportCSV() {
  if (trades.length === 0) return alert('Tidak ada data untuk diekspor!');
  let csv = 'No,Tanggal,Sesi,Posisi,Lot,Instrumen,RR,Risk,Status,Profit,Loss,Pips,Reason,Information,Equity\n';
  trades.forEach((t, i) => {
    csv += `"${i+1}","${t.date}","${t.session||'Asia'}","${t.side}","${t.lot}","${t.pair}","${t.rr}","${t.risk}","${t.status}","${t.profit}","${t.loss}","${t.pips}","${t.reason}","${t.info}","${t.calculatedEquity}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `jurnal_analytics_${Date.now()}.csv`;
  a.click();
}
