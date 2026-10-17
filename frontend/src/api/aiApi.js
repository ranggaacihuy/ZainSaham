import api from './client';
import { INITIAL_AI_SESSIONS, STOCK_DATA, INITIAL_STOCKS } from './mockData';

const AI_STORAGE_KEY = 'zainsaham_ai_sessions';

function getLocalSessions() {
  const saved = localStorage.getItem(AI_STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // fallback
    }
  }
  localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(INITIAL_AI_SESSIONS));
  return INITIAL_AI_SESSIONS;
}

function saveLocalSessions(sessions) {
  localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(sessions));
}

// Generate realistic AI analysis text in 4 structured sections
function generateAiReport(ticker, type, version = 1) {
  const stock = STOCK_DATA[ticker] || STOCK_DATA['BBCA'];
  const lastPrice = stock.latestPrice.close_price;
  const ind = stock.indicators[stock.indicators.length - 1];

  if (type === 'teknikal') {
    return {
      ringkasan: `Analisis teknikal untuk ${ticker} (${stock.company_name}) per harga terakhir Rp ${lastPrice.toLocaleString('id-ID')}. Struktur tren jangka pendek menunjukkan pergerakan konsolidasi aktif dengan indikator RSI di level ${ind.rsi_14}.`,
      poin_positif: [
        `Indikator RSI (14) berada pada area ${ind.rsi_14 > 50 ? 'konstruktif (>50)' : 'akumulasi sehat'} menandakan stabilitas minat beli.`,
        `Garis MACD ${ind.macd > ind.macd_signal ? 'berada di atas garis signal (Golden Cross), mendukung momentum bullish' : 'bergerak mendatar mengindikasikan fase akumulasi'}.`,
        ind.sma_20 ? `Garis SMA 20 berada di level Rp ${ind.sma_20.toLocaleString('id-ID')} berfungsi sebagai level support dinamis terdekat.` : `Pola volume perdagangan meningkat saat lilin hijau terbentuk.`,
        `Tidak terdeteksi pola divergensi negatif yang mengkhawatirkan pada grafik harian.`,
      ],
      risiko: [
        `Resistensi terdekat berada di kisaran Rp ${(Math.round(lastPrice * 1.04)).toLocaleString('id-ID')}, di mana potensi aksi profit taking mungkin terjadi.`,
        `Jika harga menembus ke bawah support Rp ${(Math.round(lastPrice * 0.96)).toLocaleString('id-ID')}, tren pelemahan jangka pendek dapat berlanjut.`,
        `Volatilitas bursa global dapat memberikan dampak sentimen harian.`,
      ],
      kesimpulan: `Secara teknikal, ${ticker} berada dalam formasi yang cukup teratur dengan peluang apresiasi lanjutan apabila volume beli mampu bertahan di atas rata-rata 20 hari. Disiplin batasi risiko sesuai profil investasi.`,
    };
  }

  if (type === 'fundamental') {
    return {
      ringkasan: `Kondisi fundamental ${ticker} didukung oleh kekuatan neraca dan konsistensi perolehan laba usaha. Perseroan mempertahankan marjin keuntungan yang kompetitif dibanding rekan seindustri.`,
      poin_positif: [
        `Return on Equity (ROE) berada pada level menarik yang mengindikasikan efektivitas tinggi manajemen dalam mengelola modal pemegang saham.`,
        `Struktur permodalan sehat dengan rasio utang terhadap modal (DER) yang terkendali, memberikan ketahanan di era suku bunga tinggi.`,
        `Arus kas operasi tetap positif dan likuiditas kas mencukupi untuk mendukung komitmen dividen rutin.`,
        `Posisi pasar yang kokoh dalam industrinya memberikan keunggulan kompetitif (economic moat) yang kuat.`,
      ],
      risiko: [
        `Sensitivitas terhadap fluktuasi nilai tukar dan inflasi bahan baku operasional.`,
        `Pertumbuhan pendapatan tahun depan diproyeksikan moderat seiring normalisasi konsumsi domestik.`,
      ],
      kesimpulan: `Secara fundamental ${ticker} memiliki kualitas aset prima dengan valuasi wajar. Saham ini memiliki karakteristik defensif yang baik untuk portofolio jangka menengah dan panjang.`,
    };
  }

  if (type === 'sentimen') {
    return {
      ringkasan: `Evaluasi sentimen pasar dan pemberitaan terkini seputar ${ticker} bernada cenderung positif, ditopang kabar ekspansi bisnis, pembagian dividen, dan rilis kinerja keuangan kuartalan.`,
      poin_positif: [
        `Pemberitaan media massa terkemuka menyoroti keberhasilan strategi efisiensi dan inovasi operasional emiten.`,
        `Sentimen pasar merespons positif kepastian pembagian dividen bagi pemegang saham.`,
        `Ekspektasi konsensus analis di pasar modal mayoritas mempertahankan pandangan overweight/akumulasi.`,
      ],
      risiko: [
        `Sentimen makroekonomi eksternal seperti arah kebijakan moneter bank sentral global masih menimbulkan ketidakpastian sementara.`,
        `Aksi jual bersih (net foreign sell) temporer dapat memicu volatilitas jangka pendek.`,
      ],
      kesimpulan: `Sentimen pasar terhadap ${ticker} terpantau positif dan kondusif. Berita-berita fundamental baru menjadi pendorong psikologis bagi kepercayaan pelaku pasar.`,
    };
  }

  // Default: Menyeluruh
  return {
    ringkasan: `Analisis komprehensif 360° untuk ${ticker} (${stock.company_name}) menggabungkan evaluasi teknikal, kinerja rasio fundamental, serta sentimen berita pasar terbaru. Harga terakhir tercatat di Rp ${lastPrice.toLocaleString('id-ID')}.`,
    poin_positif: [
      `Teknikal: Harga berada di fase tren sehat dengan dukungan indikator RSI 14 di level ${ind.rsi_14} dan sinyal MACD positif.`,
      `Fundamental: ROE dan profitabilitas terjaga kokoh di atas rata-rata industri dengan struktur liabilitas terkendali.`,
      `Sentimen: Berita operasional dan aksi korporasi terkini memberikan katalis positif terhadap prospek emiten.`,
      `Likuiditas perdagangan harian sangat tinggi sehingga memudahkan keluar masuk dana investasi secara fleksibel.`,
    ],
    risiko: [
      `Resistensi teknikal krusial berada pada level psikologis terdekat Rp ${(Math.round(lastPrice * 1.05)).toLocaleString('id-ID')}.`,
      `Risiko ketidakpastian suku bunga global dan fluktuasi indeks regional.`,
      `Volume transaksi saat breakout perlu diawasi untuk memvalidasi kelanjutan tren.`,
    ],
    kesimpulan: `Secara menyeluruh, saham ${ticker} memperlihatkan kombinasi yang harmonis antara kesehatan finansial fundamental dan struktur grafik teknikal yang konstruktif. Sangat cocok dijadikan bahan pertimbangan strategis investor ritel.`,
  };
}

export const aiApi = {
  // GET /api/analysis-sessions
  async getSessions({ ticker = '', type = '', page = 1 } = {}) {
    try {
      const res = await api.get('/analysis-sessions', { params: { ticker, type, page } });
      if (res.data?.data) return res.data.data;
    } catch {
      // offline
    }

    let sessions = getLocalSessions();
    if (ticker) {
      sessions = sessions.filter((s) => s.ticker.toLowerCase().includes(ticker.toLowerCase()));
    }
    if (type && type !== 'Semua') {
      sessions = sessions.filter((s) => s.analysis_type.toLowerCase() === type.toLowerCase());
    }

    return sessions;
  },

  // GET /api/analysis-sessions/{id}
  async getSessionDetail(sessionId) {
    try {
      const res = await api.get(`/analysis-sessions/${sessionId}`);
      if (res.data?.data) return res.data.data;
    } catch {
      // offline
    }

    const sessions = getLocalSessions();
    const session = sessions.find((s) => s.session_id === Number(sessionId));
    if (!session) throw new Error('Sesi analisis tidak ditemukan');
    return session;
  },

  // POST /api/analysis-sessions (trigger AI analysis)
  async startAnalysis({ stockId, ticker, analysisType }) {
    try {
      const res = await api.post('/analysis-sessions', {
        user_id: 1,
        stock_id: stockId,
        analysis_type: analysisType,
      });
      if (res.data?.data) return res.data.data;
    } catch {
      // fallback to simulated generation
    }

    // Simulate AI synthesis process
    const resolvedTicker = ticker || (INITIAL_STOCKS.find((s) => s.stock_id === Number(stockId))?.ticker) || 'BBCA';
    const report = generateAiReport(resolvedTicker, analysisType, 1);

    const newSession = {
      session_id: Date.now(),
      user_id: 1,
      stock_id: stockId,
      ticker: resolvedTicker,
      analysis_type: analysisType,
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      analyses: [
        {
          ai_analysis_id: Date.now() + 1,
          session_id: Date.now(),
          version: 1,
          model_name: 'gemini-1.5-pro (Laravel AI SDK)',
          created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
          result: report,
        },
      ],
    };

    const current = getLocalSessions();
    current.unshift(newSession);
    saveLocalSessions(current);
    return newSession;
  },

  // POST /api/analysis-sessions/{id}/regenerate
  async regenerateAnalysis(sessionId) {
    try {
      const res = await api.post(`/analysis-sessions/${sessionId}/regenerate`);
      if (res.data?.data) return res.data.data;
    } catch {
      // fallback
    }

    const sessions = getLocalSessions();
    const session = sessions.find((s) => s.session_id === Number(sessionId));
    if (!session) throw new Error('Sesi analisis tidak ditemukan');

    const nextVer = (session.analyses?.length || 1) + 1;
    const newReport = generateAiReport(session.ticker, session.analysis_type, nextVer);

    const newAnalysis = {
      ai_analysis_id: Date.now(),
      session_id: session.session_id,
      version: nextVer,
      model_name: 'gemini-1.5-pro (Laravel AI SDK)',
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      result: newReport,
    };

    session.analyses.unshift(newAnalysis);
    saveLocalSessions(sessions);
    return session;
  },

  // DELETE /api/analysis-sessions/{id}
  async deleteSession(sessionId) {
    try {
      await api.delete(`/analysis-sessions/${sessionId}`);
    } catch {
      // offline
    }

    let sessions = getLocalSessions();
    sessions = sessions.filter((s) => s.session_id !== Number(sessionId));
    saveLocalSessions(sessions);
    return { success: true };
  },
};
