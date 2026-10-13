let currentStockId = 1;
let chartInstance = null;

function initChart() {
  const canvasEl = document.getElementById('stockPriceChart');
  if (!canvasEl) return;
  const ctx = canvasEl.getContext('2d');
  
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          type: 'line',
          label: 'Close Price (IDR)',
          data: [],
          borderColor: '#3b71ca',
          backgroundColor: 'rgba(59, 113, 202, 0.08)',
          borderWidth: 2,
          fill: true,
          tension: 0.15,
          yAxisID: 'yPrice',
          pointRadius: 2,
          pointHoverRadius: 5
        },
        {
          type: 'line',
          label: 'SMA 20',
          data: [],
          borderColor: '#fbbf24',
          borderWidth: 1.5,
          borderDash: [3, 3],
          pointRadius: 0,
          yAxisID: 'yPrice'
        },
        {
          type: 'line',
          label: 'SMA 50',
          data: [],
          borderColor: '#818cf8',
          borderWidth: 1.5,
          borderDash: [4, 4],
          pointRadius: 0,
          yAxisID: 'yPrice'
        },
        {
          type: 'bar',
          label: 'Volume',
          data: [],
          backgroundColor: 'rgba(40, 64, 114, 0.5)',
          hoverBackgroundColor: 'rgba(59, 113, 202, 0.7)',
          yAxisID: 'yVol',
          barPercentage: 0.55
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0d172e',
          titleColor: '#f1f5f9',
          bodyColor: '#cbd5e1',
          borderColor: '#1e3056',
          borderWidth: 1,
          titleFont: { family: 'Poppins', size: 11, weight: '600' },
          bodyFont: { family: 'Poppins', size: 10 },
          padding: 10,
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) label += ': ';
              if (context.dataset.yAxisID === 'yPrice') {
                label += 'Rp ' + Number(context.raw).toLocaleString('id-ID');
              } else {
                label += (Number(context.raw) / 1000000).toFixed(1) + ' Juta Lembar';
              }
              return label;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(30, 48, 86, 0.4)' },
          ticks: { color: '#7f93b5', font: { family: 'Poppins', size: 9 }, maxTicksLimit: 7 }
        },
        yPrice: {
          type: 'linear',
          position: 'left',
          grid: { color: 'rgba(30, 48, 86, 0.5)' },
          ticks: {
            color: '#94a3b8',
            font: { family: 'Poppins', size: 10 },
            callback: function(val) { return 'Rp ' + val.toLocaleString('id-ID'); }
          }
        },
        yVol: {
          type: 'linear',
          position: 'right',
          grid: { display: false },
          ticks: {
            color: '#64748b',
            font: { family: 'Poppins', size: 9 },
            callback: function(val) { return (val / 1000000).toFixed(0) + 'M'; }
          }
        }
      }
    }
  });
}

function toggleDataset(index) {
  if (!chartInstance) return;
  const meta = chartInstance.getDatasetMeta(index);
  meta.hidden = meta.hidden === null ? !chartInstance.data.datasets[index].hidden : null;
  chartInstance.update();

  if (index === 1) {
    document.getElementById('toggleSma20Btn').textContent = meta.hidden ? 'SMA 20: OFF' : 'SMA 20: ON';
  } else if (index === 2) {
    document.getElementById('toggleSma50Btn').textContent = meta.hidden ? 'SMA 50: OFF' : 'SMA 50: ON';
  }
}

function updateStockChart(stockId) {
  if (!chartInstance) return;

  const prices = stockPricesDatabase[stockId] || [];
  const labels = prices.map(p => p.price_date.slice(5));
  const closePrices = prices.map(p => p.close_price);
  const volumes = prices.map(p => p.volume);

  const sma20 = [];
  for (let i = 0; i < closePrices.length; i++) {
    if (i < 19) {
      sma20.push(null);
    } else {
      const slice = closePrices.slice(i - 19, i + 1);
      sma20.push(Math.round(slice.reduce((a, b) => a + b, 0) / 20));
    }
  }

  const sma50 = [];
  for (let i = 0; i < closePrices.length; i++) {
    if (i < 24) {
      sma50.push(null);
    } else {
      const slice = closePrices.slice(i - 24, i + 1);
      sma50.push(Math.round(slice.reduce((a, b) => a + b, 0) / slice.length));
    }
  }

  chartInstance.data.labels = labels;
  chartInstance.data.datasets[0].data = closePrices;
  chartInstance.data.datasets[1].data = sma20;
  chartInstance.data.datasets[2].data = sma50;
  chartInstance.data.datasets[3].data = volumes;
  chartInstance.update();

  if (prices.length > 0) {
    const last = prices[prices.length - 1];
    const prev = prices.length > 1 ? prices[prices.length - 2] : last;
    const delta = last.close_price - prev.close_price;
    const deltaPct = ((delta / prev.close_price) * 100).toFixed(2);

    document.getElementById('metricOpen').textContent = last.open_price.toLocaleString('id-ID');
    document.getElementById('metricHigh').textContent = last.high_price.toLocaleString('id-ID');
    document.getElementById('metricLow').textContent = last.low_price.toLocaleString('id-ID');
    document.getElementById('metricClose').textContent = last.close_price.toLocaleString('id-ID');
    document.getElementById('metricVolume').textContent = (last.volume / 1000000).toFixed(1) + 'M';
    document.getElementById('priceDateLatest').textContent = `Data Terkini: ${last.price_date}`;

    document.getElementById('headerLastPrice').textContent = `Rp ${last.close_price.toLocaleString('id-ID')}`;
    const deltaSign = delta >= 0 ? '+' : '';
    const deltaColor = delta >= 0 ? 'text-matte-bullish' : 'text-matte-bearish';
    document.getElementById('headerPriceDelta').className = `${deltaColor} font-semibold`;
    document.getElementById('headerPriceDelta').textContent = `${deltaSign}${delta.toLocaleString('id-ID')} (${deltaSign}${deltaPct}%)`;
  }
}

function renderStockDetails(stockId) {
  const stock = stocksDatabase.find(s => s.stock_id === stockId);
  if (!stock) return;

  currentStockId = stockId;
  document.getElementById('stockTickerHeader').textContent = stock.ticker;
  document.getElementById('stockCompanyName').textContent = stock.company_name;
  document.getElementById('stockSector').textContent = stock.sector;
  document.getElementById('stockExchange').textContent = stock.exchange;
  document.getElementById('stockCurrency').textContent = stock.currency;
  document.getElementById('stockIdTag').textContent = stock.stock_id;
  document.getElementById('stockUpdatedAt').textContent = stock.updated_at;

  renderTickerPills();
  updateStockChart(stockId);
  renderTechnicalIndicators(stockId);
  renderStockFundamentals(stockId);
  renderWatchlistButtonState(stockId);
  renderNews(stockId);
  renderLatestAiAnalysis(stockId);
  
  renderWatchlistsList();
}

function renderTickerPills() {
  const container = document.getElementById('quickTickerPills');
  container.innerHTML = '';

  stocksDatabase.forEach(stk => {
    const isActive = stk.stock_id === currentStockId;
    const btn = document.createElement('button');
    btn.className = `px-2.5 py-1 rounded-md text-xs font-medium transition ${
      isActive 
        ? 'bg-matte-accent text-white font-semibold' 
        : 'bg-matte-navy900 text-matte-textMuted hover:text-white border border-matte-border'
    }`;
    btn.textContent = stk.ticker;
    btn.onclick = () => renderStockDetails(stk.stock_id);
    container.appendChild(btn);
  });
}

function renderTechnicalIndicators(stockId) {
  const ind = technicalIndicatorsDatabase[stockId];
  if (!ind) return;

  document.getElementById('techIndicatorDate').textContent = `Date: ${ind.indicator_date}`;
  document.getElementById('techRsiValue').textContent = ind.rsi_14.toFixed(2);
  
  const rsiBar = document.getElementById('techRsiBar');
  rsiBar.style.width = `${Math.min(100, Math.max(0, ind.rsi_14))}%`;

  const rsiBadge = document.getElementById('techRsiBadge');
  if (ind.rsi_14 >= 70) {
    rsiBadge.className = "text-[10px] px-2 py-0.5 rounded font-medium bg-rose-950/60 text-rose-400 border border-rose-800";
    rsiBadge.textContent = "OVERBOUGHT (>70)";
  } else if (ind.rsi_14 <= 30) {
    rsiBadge.className = "text-[10px] px-2 py-0.5 rounded font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800";
    rsiBadge.textContent = "OVERSOLD (<30)";
  } else {
    rsiBadge.className = "text-[10px] px-2 py-0.5 rounded font-medium bg-matte-accentSoft text-matte-accent border border-matte-border";
    rsiBadge.textContent = "NEUTRAL (30 - 70)";
  }

  document.getElementById('techMacdValue').textContent = (ind.macd >= 0 ? '+' : '') + ind.macd.toFixed(2);
  document.getElementById('techMacdSignalValue').textContent = (ind.macd_signal >= 0 ? '+' : '') + ind.macd_signal.toFixed(2);
  document.getElementById('techSma20Value').textContent = `Rp ${ind.sma_20.toLocaleString('id-ID')}`;
  document.getElementById('techSma50Value').textContent = `Rp ${ind.sma_50.toLocaleString('id-ID')}`;

  const crossEl = document.getElementById('techCrossSignal');
  if (ind.sma_20 >= ind.sma_50) {
    crossEl.className = "text-matte-bullish font-semibold";
    crossEl.textContent = "BULLISH CROSS";
  } else {
    crossEl.className = "text-matte-bearish font-semibold";
    crossEl.textContent = "BEARISH CROSS";
  }
}

function formatTriliun(num) {
  return (num / 1000000000000).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' T';
}

function renderStockFundamentals(stockId) {
  const fund = stockFundamentalsDatabase[stockId];
  if (!fund) return;

  document.getElementById('fundPeriod').textContent = `Period: ${fund.period}`;
  document.getElementById('fundRevenue').textContent = `Rp ${formatTriliun(fund.revenue)}`;
  document.getElementById('fundNetIncome').textContent = `Rp ${formatTriliun(fund.net_income)}`;
  document.getElementById('fundTotalAssets').textContent = `Rp ${formatTriliun(fund.total_assets)}`;
  document.getElementById('fundTotalLiabilities').textContent = `Rp ${formatTriliun(fund.total_liabilities)}`;
  document.getElementById('fundTotalEquity').textContent = `Rp ${formatTriliun(fund.total_equity)}`;

  document.getElementById('fundEps').textContent = `Rp ${fund.eps.toLocaleString('id-ID')}`;
  document.getElementById('fundRoe').textContent = `${fund.roe.toFixed(2)}%`;
  document.getElementById('fundRoa').textContent = `${fund.roa.toFixed(2)}%`;
  document.getElementById('fundDer').textContent = `${fund.debt_to_equity.toFixed(2)}x`;
  document.getElementById('fundUpdatedAt').textContent = `Updated: ${fund.updated_at.slice(0, 10)}`;
}

function renderWatchlistsList() {
  const container = document.getElementById('watchlistItemsList');
  container.innerHTML = '';

  const countBadge = document.getElementById('watchlistCountBadge');
  countBadge.textContent = `${watchlistsDatabase.length} Saham`;

  if (watchlistsDatabase.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-xs text-matte-textMuted">Watchlist kosong. Tambahkan saham ke daftar pantau.</div>`;
    return;
  }

  watchlistsDatabase.forEach(item => {
    const stock = stocksDatabase.find(s => s.stock_id === item.stock_id);
    if (!stock) return;

    const prices = stockPricesDatabase[stock.stock_id] || [];
    const lastPrice = prices.length ? prices[prices.length - 1].close_price : 0;
    const isCurrent = stock.stock_id === currentStockId;

    const card = document.createElement('div');
    card.className = `p-2.5 rounded-lg border transition flex items-center justify-between cursor-pointer ${
      isCurrent 
        ? 'bg-matte-navy850 border-matte-accent' 
        : 'bg-matte-navy950 border-matte-border hover:border-matte-borderLight'
    }`;

    card.innerHTML = `
      <div class="flex items-center space-x-2.5" onclick="renderStockDetails(${stock.stock_id})">
        <span class="w-7 h-7 rounded bg-matte-navy800 border border-matte-border flex items-center justify-center font-bold text-xs text-matte-accent">
          ${stock.ticker.slice(0, 2)}
        </span>
        <div>
          <div class="flex items-center space-x-1.5">
            <span class="text-xs font-semibold text-white">${stock.ticker}</span>
            <span class="text-[9px] text-matte-textMuted">ID:${item.watchlist_id}</span>
          </div>
          <span class="text-[10px] text-matte-textMuted block truncate max-w-[120px]">${stock.company_name}</span>
        </div>
      </div>
      <div class="flex items-center space-x-2">
        <div class="text-right" onclick="renderStockDetails(${stock.stock_id})">
          <span class="text-xs font-semibold text-slate-100">Rp ${lastPrice.toLocaleString('id-ID')}</span>
          <span class="block text-[9px] text-matte-textMuted">${item.created_at.slice(0, 10)}</span>
        </div>
        <button onclick="event.stopPropagation(); removeStockFromWatchlist(${item.stock_id})" class="text-matte-textMuted hover:text-rose-400 p-1 rounded transition" title="Hapus dari Watchlist">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderWatchlistButtonState(stockId) {
  const exists = watchlistsDatabase.some(w => w.stock_id === stockId);
  const btn = document.getElementById('btnToggleWatchlist');
  const icon = document.getElementById('starIconWatchlist');
  const label = document.getElementById('watchlistBtnLabel');

  if (exists) {
    btn.classList.add('bg-amber-950/40', 'border-amber-700/60', 'text-amber-300');
    icon.classList.add('text-amber-400', 'fill-amber-400');
    icon.classList.remove('text-matte-textMuted');
    label.textContent = "Dalam Watchlist";
  } else {
    btn.classList.remove('bg-amber-950/40', 'border-amber-700/60', 'text-amber-300');
    icon.classList.remove('text-amber-400', 'fill-amber-400');
    icon.classList.add('text-matte-textMuted');
    label.textContent = "Tambah Watchlist";
  }
}

function toggleWatchlistForCurrentStock() {
  const existsIndex = watchlistsDatabase.findIndex(w => w.stock_id === currentStockId);
  const stock = stocksDatabase.find(s => s.stock_id === currentStockId);

  if (existsIndex >= 0) {
    watchlistsDatabase.splice(existsIndex, 1);
    showToast(`${stock.ticker} dihapus dari watchlist.`);
  } else {
    const newEntry = {
      watchlist_id: 100 + Math.floor(Math.random() * 899),
      user_id: activeUser.user_id,
      stock_id: currentStockId,
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
    };
    watchlistsDatabase.push(newEntry);
    showToast(`${stock.ticker} berhasil ditambahkan ke watchlist!`);
  }

  renderWatchlistsList();
  renderWatchlistButtonState(currentStockId);
}

function removeStockFromWatchlist(stockId) {
  const index = watchlistsDatabase.findIndex(w => w.stock_id === stockId);
  if (index >= 0) {
    const stock = stocksDatabase.find(s => s.stock_id === stockId);
    watchlistsDatabase.splice(index, 1);
    renderWatchlistsList();
    renderWatchlistButtonState(currentStockId);
    showToast(`${stock ? stock.ticker : 'Saham'} dihapus dari watchlist.`);
  }
}

function renderNews(stockId) {
  const container = document.getElementById('newsCardsGrid');
  container.innerHTML = '';

  const relevantNews = newsDatabase.filter(n => n.stock_id === stockId);
  const activeStock = stocksDatabase.find(s => s.stock_id === stockId);

  if (relevantNews.length === 0) {
    container.innerHTML = `<div class="col-span-3 text-center py-6 text-matte-textMuted text-xs">Belum ada berita terpublikasi untuk ticker ${activeStock ? activeStock.ticker : ''}.</div>`;
    return;
  }

  relevantNews.forEach(item => {
    const card = document.createElement('div');
    card.className = "card-matte-sub p-3.5 rounded-lg flex flex-col justify-between";
    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between text-[10px] text-matte-accent mb-1.5 font-medium">
          <span>${item.source}</span>
          <span class="text-matte-textMuted">${item.published_at.slice(0, 10)}</span>
        </div>
        <h4 class="text-xs font-semibold text-slate-100 hover:text-matte-accent transition mb-1 leading-snug">${item.title}</h4>
        <p class="text-[11px] text-matte-textMuted leading-relaxed line-clamp-2">${item.content}</p>
      </div>
      <div class="mt-3 pt-2 border-t border-matte-border flex items-center justify-between text-[10px]">
        <span class="text-matte-textMuted">ID: ${item.news_id}</span>
        <a href="${item.source_url}" target="_blank" class="text-matte-accent hover:underline flex items-center space-x-1">
          <span>Buka Sumber</span>
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
        </a>
      </div>
    `;
    container.appendChild(card);
  });
}

function triggerNewAiAnalysisSession() {
  const analysisType = document.getElementById('aiAnalysisTypeSelect').value;
  const modelName = document.getElementById('aiModelSelect').value;
  const stock = stocksDatabase.find(s => s.stock_id === currentStockId);
  const ind = technicalIndicatorsDatabase[currentStockId];
  const fund = stockFundamentalsDatabase[currentStockId];
  const prices = stockPricesDatabase[currentStockId] || [];
  const lastPrice = prices.length ? prices[prices.length - 1].close_price : 0;

  const loader = document.getElementById('aiLoadingIndicator');
  const content = document.getElementById('aiAnalysisResultContent');
  loader.classList.remove('hidden');
  content.classList.add('hidden');

  setTimeout(() => {
    loader.classList.add('hidden');
    content.classList.remove('hidden');

    const newSessionId = `SES-${Date.now().toString().slice(-4)}`;
    const newSession = {
      session_id: newSessionId,
      user_id: activeUser.user_id,
      stock_id: currentStockId,
      analysis_type: analysisType,
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
    };
    analysisSessionsDatabase.push(newSession);

    const contextObj = {
      ticker: stock.ticker,
      company: stock.company_name,
      current_price: lastPrice,
      analysis_type: analysisType,
      model: modelName,
      technical: { rsi_14: ind.rsi_14, macd: ind.macd, macd_signal: ind.macd_signal, sma_20: ind.sma_20, sma_50: ind.sma_50 },
      fundamental: { period: fund.period, roe: fund.roe, roa: fund.roa, der: fund.debt_to_equity, net_income_triliun: (fund.net_income / 1e12).toFixed(2) }
    };

    let conclusionText = "";
    if (analysisType === "Technical") {
      const trend = ind.rsi_14 > 50 ? "bullish continuation" : "bearish konsolidasi";
      conclusionText = `Analisis Teknikal (${stock.ticker}): Terdeteksi ${trend}. Nilai RSI 14 berada di posisi ${ind.rsi_14.toFixed(1)}, MACD ${ind.macd > ind.macd_signal ? 'berada di atas garis signal (Golden setup)' : 'berada di bawah garis signal'}. Support dinamis terdekat bertengger pada SMA 20 (Rp ${ind.sma_20.toLocaleString('id-ID')}).`;
    } else if (analysisType === "Fundamental") {
      conclusionText = `Analisis Fundamental (${stock.ticker} - ${fund.period}): Profitabilitas solid dengan return on equity (ROE) ${fund.roe}% dan ROA ${fund.roa}%. Tingkat solvabilitas DER terkendali di ${fund.debt_to_equity}x dengan laba bersih Rp ${(fund.net_income / 1e12).toFixed(2)} T.`;
    } else {
      conclusionText = `Sintesis Komprehensif (${stock.ticker}): Integrasi teknikal (RSI: ${ind.rsi_14.toFixed(1)}) dan ketahanan fundamental (ROE: ${fund.roe}%) menunjukkan sinyal akumulasi jangka menengah dengan rasio risk-to-reward yang defensif di bursa IDX.`;
    }

    const newAiAnalysis = {
      ai_analysis_id: `AI-${Date.now().toString().slice(-4)}`,
      session_id: newSessionId,
      model_name: modelName,
      context_data: JSON.stringify(contextObj, null, 2),
      result: conclusionText,
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
    };
    aiAnalysesDatabase.push(newAiAnalysis);

    renderLatestAiAnalysis(currentStockId);
    showToast(`Sesi Analisa ${analysisType} dibuat (${newSessionId})!`);
  }, 600);
}

function renderLatestAiAnalysis(stockId) {
  const sessions = analysisSessionsDatabase.filter(s => s.stock_id === stockId);
  const content = document.getElementById('aiAnalysisResultContent');
  const timestampEl = document.getElementById('aiAnalysisTimestamp');
  const rawJsonEl = document.getElementById('rawContextDataJson');
  const sessionIdTag = document.getElementById('aiSessionIdTag');
  const modelBadge = document.getElementById('aiModelBadge');

  if (sessions.length === 0) {
    content.innerHTML = `<p class="text-matte-textMuted text-center py-4">Belum ada sesi analisa untuk emiten ini. Klik tombol untuk memulai sesi baru.</p>`;
    timestampEl.textContent = "-";
    sessionIdTag.textContent = "-";
    rawJsonEl.textContent = "{}";
    return;
  }

  const latestSession = sessions[sessions.length - 1];
  const analysis = aiAnalysesDatabase.find(a => a.session_id === latestSession.session_id);

  if (analysis) {
    timestampEl.textContent = analysis.created_at;
    sessionIdTag.textContent = latestSession.session_id;
    modelBadge.textContent = analysis.model_name;
    rawJsonEl.textContent = analysis.context_data;
    content.innerHTML = `
      <div class="flex items-center space-x-2 text-[10px] text-matte-textMuted mb-1.5">
        <span class="px-1.5 py-0.5 rounded bg-matte-accentSoft text-matte-accent font-medium">${latestSession.analysis_type}</span>
        <span>Session: ${latestSession.session_id}</span>
      </div>
      <p class="text-slate-200 text-xs leading-relaxed">${analysis.result}</p>
    `;
  }
}

function renderUserProfileModal() {
  const container = document.getElementById('userModalContent');
  container.innerHTML = `
    <div class="space-y-2">
      <div class="flex justify-between py-1 border-b border-matte-border">
        <span class="text-matte-textMuted">user_id:</span>
        <span class="text-matte-accent font-bold">${activeUser.user_id}</span>
      </div>
      <div class="flex justify-between py-1 border-b border-matte-border">
        <span class="text-matte-textMuted">username:</span>
        <span class="text-slate-200">${activeUser.username}</span>
      </div>
      <div class="flex justify-between py-1 border-b border-matte-border">
        <span class="text-matte-textMuted">email:</span>
        <span class="text-slate-200">${activeUser.email}</span>
      </div>
      <div class="flex justify-between py-1 border-b border-matte-border">
        <span class="text-matte-textMuted">password_hash:</span>
        <span class="text-slate-400 font-mono text-[10px] truncate max-w-[200px]" title="${activeUser.password_hash}">${activeUser.password_hash}</span>
      </div>
      <div class="flex justify-between py-1 border-b border-matte-border">
        <span class="text-matte-textMuted">created_at:</span>
        <span class="text-slate-300">${activeUser.created_at}</span>
      </div>
      <div class="flex justify-between py-1 border-b border-matte-border">
        <span class="text-matte-textMuted">update_at:</span>
        <span class="text-slate-300">${activeUser.update_at}</span>
      </div>
      <div class="flex justify-between py-1">
        <span class="text-matte-textMuted">deleted_at:</span>
        <span class="text-slate-400">${activeUser.deleted_at === null ? 'NULL (Aktif)' : activeUser.deleted_at}</span>
      </div>
    </div>
  `;
}

function openUserProfileModal() {
  renderUserProfileModal();
  document.getElementById('userProfileModal').classList.remove('hidden');
}

function closeUserProfileModal() {
  document.getElementById('userProfileModal').classList.add('hidden');
}

function toggleContextDataModal() {
  document.getElementById('contextDataModal').classList.toggle('hidden');
}

function openErdModal() {
  document.getElementById('erdVerificationModal').classList.remove('hidden');
}

function closeErdModal() {
  document.getElementById('erdVerificationModal').classList.add('hidden');
}

function showToast(message) {
  const toast = document.getElementById('terminalToast');
  const msg = document.getElementById('toastMessage');
  msg.textContent = message;

  toast.classList.remove('translate-y-16', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');

  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-16', 'opacity-0');
  }, 2600);
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

// Eksekusi utama saat DOM siap
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('navUsername').textContent = activeUser.username;
  document.getElementById('navUserEmail').textContent = activeUser.email;
  document.getElementById('watchlistUserTag').textContent = activeUser.user_id;

  initChart();
  renderStockDetails(1);
  renderWatchlistsList();

  const searchInput = document.getElementById('stockSearchInput');
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim().toUpperCase();
    if (!query) return;

    const match = stocksDatabase.find(s => s.ticker.includes(query) || s.company_name.toUpperCase().includes(query));
    if (match && match.stock_id !== currentStockId) {
      renderStockDetails(match.stock_id);
    }
  });
});