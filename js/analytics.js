let equityChartInstance = null;

function calculateMetrics() {
  initialBalance = parseFloat(document.getElementById('initial-balance').value) || 0;
  localStorage.setItem(BALANCE_KEY, initialBalance.toString());

  const scope = typeof getPeriodScopedTrades === 'function'
    ? getPeriodScopedTrades()
    : { scopedTrades: trades, startEquity: initialBalance, isFiltered: false };

  const activeTrades = scope.scopedTrades;
  const startEq = scope.startEquity;

  let running = startEq;
  let peak = startEq;
  let maxDdAmount = 0;
  let maxDdPercent = 0;

  let totalGrossProfit = 0;
  let totalGrossLoss = 0;
  let winCount = 0;
  let lossCount = 0;

  const equityHistory = [startEq];
  const labels = [scope.isFiltered ? 'Awal Periode' : 'Modal Awal'];

  const pairStats = {};
  const sessionStats = {
    Asia: { wins: 0, total: 0, pnl: 0 },
    London: { wins: 0, total: 0, pnl: 0 },
    'New York': { wins: 0, total: 0, pnl: 0 }
  };

  activeTrades.forEach((t) => {
    const isWin = t.status === 'TP' || t.status === 'SL+';
    const isLoss = t.status === 'SL';

    if (isWin) {
      winCount++;
      totalGrossProfit += t.profit;
    }
    if (isLoss) {
      lossCount++;
      totalGrossLoss += t.loss;
    }

    const netTrade = (t.profit || 0) - (t.loss || 0);
    running += netTrade;
    t.calculatedEquity = running;

    if (running > peak) {
      peak = running;
    } else {
      const dd = peak - running;
      const ddPct = peak > 0 ? (dd / peak) * 100 : 0;
      if (ddPct > maxDdPercent) {
        maxDdPercent = ddPct;
        maxDdAmount = dd;
      }
    }

    if (!pairStats[t.pair]) {
      pairStats[t.pair] = { wins: 0, total: 0, pnl: 0 };
    }
    pairStats[t.pair].total++;
    pairStats[t.pair].pnl += netTrade;
    if (isWin) pairStats[t.pair].wins++;

    const sessKey = t.session || 'Asia';
    if (sessionStats[sessKey]) {
      sessionStats[sessKey].total++;
      sessionStats[sessKey].pnl += netTrade;
      if (isWin) sessionStats[sessKey].wins++;
    }

    labels.push(`${t.date} (${t.pair})`);
    equityHistory.push(running);
  });

  return {
    activeTrades,
    startEq,
    running,
    maxDdAmount,
    maxDdPercent,
    totalGrossProfit,
    totalGrossLoss,
    winCount,
    lossCount,
    equityHistory,
    labels,
    pairStats,
    sessionStats
  };
}

function updateChartsAndStats() {
  const m = calculateMetrics();
  const totalTrades = m.activeTrades.length;
  const winRate = totalTrades > 0 ? ((m.winCount / totalTrades) * 100).toFixed(1) : 0;
  const gain = m.startEq > 0 ? (((m.running - m.startEq) / m.startEq) * 100).toFixed(2) : 0;

  let profitFactor = '0.00';
  if (m.totalGrossLoss === 0 && m.totalGrossProfit > 0) profitFactor = 'MAX';
  else if (m.totalGrossLoss > 0) profitFactor = (m.totalGrossProfit / m.totalGrossLoss).toFixed(2);

  const avgWin = m.winCount > 0 ? m.totalGrossProfit / m.winCount : 0;
  const avgLoss = m.lossCount > 0 ? m.totalGrossLoss / m.lossCount : 0;
  let actualRR = '-';
  if (avgLoss > 0) actualRR = `1 : ${(avgWin / avgLoss).toFixed(2)}`;
  else if (avgWin > 0) actualRR = `1 : ∞`;

  let bestPair = '-';
  let bestPairPnL = 0;
  Object.keys(m.pairStats).forEach(p => {
    if (m.pairStats[p].pnl > bestPairPnL) {
      bestPairPnL = m.pairStats[p].pnl;
      const wr = ((m.pairStats[p].wins / m.pairStats[p].total) * 100).toFixed(0);
      bestPair = `${p} (${wr}% WR)`;
    }
  });

  let bestSession = '-';
  let bestSessionWR = 0;
  Object.keys(m.sessionStats).forEach(s => {
    if (m.sessionStats[s].total > 0) {
      const wr = (m.sessionStats[s].wins / m.sessionStats[s].total) * 100;
      if (wr >= bestSessionWR) {
        bestSessionWR = wr;
        bestSession = `${s} (${wr.toFixed(0)}%)`;
      }
    }
  });

  document.getElementById('current-equity').textContent = `Rp ${m.running.toLocaleString('id-ID')}`;
  document.getElementById('capital-gain').textContent = `${gain >= 0 ? '+' : ''}${gain}%`;
  document.getElementById('capital-gain').className = `font-black ${gain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
  document.getElementById('stat-winrate').textContent = `${winRate}%`;
  document.getElementById('stat-winloss-count').textContent = `${m.winCount}W - ${m.lossCount}L (${totalTrades} Posisi)`;
  document.getElementById('stat-mdd').textContent = `-${m.maxDdPercent.toFixed(2)}%`;
  document.getElementById('stat-mdd-nominal').textContent = `Max DD: Rp ${m.maxDdAmount.toLocaleString('id-ID')}`;
  document.getElementById('stat-profit-factor').textContent = profitFactor;
  document.getElementById('stat-actual-rr').textContent = actualRR;
  document.getElementById('stat-top-pair').textContent = bestPair;
  document.getElementById('stat-top-pair-sub').textContent = `Net: Rp ${bestPairPnL.toLocaleString('id-ID')}`;
  document.getElementById('stat-top-session').textContent = bestSession;
  document.getElementById('stat-top-session-sub').textContent = `Total: ${totalTrades} Trade`;

  renderPairList(m.pairStats);
  renderSessionList(m.sessionStats);
  if (typeof renderPsychologyStats === 'function') renderPsychologyStats(m.activeTrades);
  if (typeof evaluateDailyLossLimit === 'function') evaluateDailyLossLimit(m.running);
  renderChart(m.labels, m.equityHistory);
}

function updateAll() {
  updateChartsAndStats();
  renderSheet();
}

function renderPairList(pairStats) {
  const container = document.getElementById('pair-performance-list');
  const pairs = Object.keys(pairStats);
  if (pairs.length === 0) {
    container.innerHTML = '<p class="text-[10px] text-slate-500 py-2 text-center">Belum ada data pair pada periode ini</p>';
    return;
  }

  container.innerHTML = pairs.map(p => {
    const data = pairStats[p];
    const wr = ((data.wins / data.total) * 100).toFixed(0);
    const isPos = data.pnl >= 0;
    return `
      <div class="flex items-center justify-between bg-slate-950/60 border border-slate-800/80 px-2.5 py-1.5 rounded-lg text-[10px] font-mono">
        <div>
          <span class="font-bold text-amber-400">${p}</span>
          <span class="text-slate-500 ml-1.5">(${data.total} trade)</span>
        </div>
        <div class="text-right">
          <span class="text-blue-400 mr-2 font-bold">${wr}% WR</span>
          <span class="${isPos ? 'text-emerald-400' : 'text-rose-400'} font-black">${isPos ? '+' : ''}Rp ${data.pnl.toLocaleString('id-ID')}</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderSessionList(sessionStats) {
  const container = document.getElementById('session-performance-list');
  container.innerHTML = Object.keys(sessionStats).map(s => {
    const data = sessionStats[s];
    const wr = data.total > 0 ? ((data.wins / data.total) * 100).toFixed(0) : 0;
    const isPos = data.pnl >= 0;
    return `
      <div class="bg-slate-950/70 border border-slate-800 p-2 rounded-xl">
        <span class="text-[9px] text-slate-400 uppercase font-bold block">${s}</span>
        <p class="text-xs font-black text-slate-200 mt-0.5">${wr}% WR</p>
        <p class="text-[9px] font-mono ${isPos ? 'text-emerald-400' : 'text-rose-400'} mt-0.5">${isPos ? '+' : ''}${Math.round(data.pnl/1000)}k</p>
      </div>
    `;
  }).join('');
}

function buildEquityGradient(ctx, isPositive) {
  const gradient = ctx.createLinearGradient(0, 0, 0, 240);
  if (isPositive) {
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.26)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
  } else {
    gradient.addColorStop(0, 'rgba(244, 63, 94, 0.26)');
    gradient.addColorStop(1, 'rgba(244, 63, 94, 0.0)');
  }
  return gradient;
}

function renderChart(labels, dataPoints) {
  const ctx = document.getElementById('equityChart').getContext('2d');
  const ptRadius = dataPoints.length > 20 ? 1.5 : 3.5;
  const startVal = dataPoints[0] || 0;
  const lastVal = dataPoints[dataPoints.length - 1] || 0;
  const isPositive = lastVal >= startVal;

  const lineColor = isPositive ? '#10b981' : '#f43f5e';
  const fillGradient = buildEquityGradient(ctx, isPositive);
  const baselinePoints = labels.map(() => startVal);

  if (equityChartInstance) {
    equityChartInstance.data.labels = labels;
    equityChartInstance.data.datasets[0].data = dataPoints;
    equityChartInstance.data.datasets[0].borderColor = lineColor;
    equityChartInstance.data.datasets[0].pointBackgroundColor = lineColor;
    equityChartInstance.data.datasets[0].backgroundColor = fillGradient;
    equityChartInstance.data.datasets[0].pointRadius = ptRadius;
    if (equityChartInstance.data.datasets[1]) {
      equityChartInstance.data.datasets[1].data = baselinePoints;
    }
    equityChartInstance.update();
    return;
  }

  equityChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Ekuitas (Rp)',
          data: dataPoints,
          borderColor: lineColor,
          backgroundColor: fillGradient,
          borderWidth: 2.25,
          pointBackgroundColor: lineColor,
          pointBorderColor: '#060911',
          pointBorderWidth: 1.5,
          pointRadius: ptRadius,
          pointHoverRadius: 5,
          fill: true,
          tension: 0.28
        },
        {
          label: 'Garis Modal Awal',
          data: baselinePoints,
          borderColor: 'rgba(148, 163, 184, 0.32)',
          borderWidth: 1.2,
          borderDash: [4, 4],
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: false,
          tension: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(11, 17, 32, 0.95)',
          titleColor: '#94a3b8',
          bodyColor: '#f8fafc',
          borderColor: 'rgba(148, 163, 184, 0.25)',
          borderWidth: 1,
          padding: 10,
          filter: (item) => item.datasetIndex === 0,
          callbacks: {
            label: function(context) {
              const val = context.parsed.y;
              const diff = val - startVal;
              const diffStr = diff >= 0 ? `+Rp ${diff.toLocaleString('id-ID')}` : `-Rp ${Math.abs(diff).toLocaleString('id-ID')}`;
              return `Equity: Rp ${val.toLocaleString('id-ID')} (${diffStr})`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: { color: '#64748b', font: { size: 9, family: 'JetBrains Mono' }, maxTicksLimit: 6 }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: {
            color: '#64748b',
            font: { size: 9, family: 'JetBrains Mono' },
            callback: function(value) {
              return (value / 1000).toLocaleString('id-ID') + 'k';
            }
          }
        }
      }
    }
  });
}
