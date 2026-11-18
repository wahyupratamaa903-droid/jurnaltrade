// ============================================================
// 1. AI CHART & MT5 SCREENSHOT SCANNER (VISION)
// ============================================================
function compressImageToBase64(file, maxWidth = 1100, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Gagal memproses gambar.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });
}

async function extractTextViaBrowserOcr(imageDataUrl) {
  if (!window.Tesseract) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('Gagal memuat mesin OCR.'));
      document.head.appendChild(s);
    });
  }
  const result = await window.Tesseract.recognize(imageDataUrl, 'eng');
  return (result?.data?.text || '').replace(/\s+/g, ' ').trim();
}

async function handleScreenshotScan(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const statusEl = document.getElementById('ai-autofill-status');
  const scanLabel = document.getElementById('ai-scan-btn-label');
  const origLabel = scanLabel ? scanLabel.innerHTML : '';

  if (scanLabel) scanLabel.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  if (statusEl) {
    statusEl.innerHTML = '<span class="text-cyan-300"><i class="fas fa-eye fa-beat mr-1"></i>AI sedang memindai screenshot MT4/MT5 / Chart Anda...</span>';
    statusEl.classList.remove('hidden');
  }

  try {
    const base64Img = await compressImageToBase64(file);
    const now = new Date();
    const todayFormatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    const defaultSess = typeof detectSession === 'function' ? detectSession() : 'Asia';

    const res = await fetch('/api/vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: base64Img,
        today: todayFormatted,
        defaultSession: defaultSess
      })
    });

    const data = await res.json();
    if (res.ok && data.content) {
      const cleaned = data.content.replace(/```json|```/gi, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);

      if (typeof applyParsedDataToForm === 'function') {
        applyParsedDataToForm(parsed);
      }

      if (statusEl) {
        statusEl.innerHTML = `<span class="text-emerald-400"><i class="fas fa-circle-check mr-1"></i>Screenshot berhasil dipindai oleh <strong>${data.provider}</strong>! Periksa kolom lalu klik Simpan.</span>`;
      }
      if (typeof showToast === 'function') showToast('Data screenshot berhasil diekstrak!');
      return;
    }

    // Fallback Otomatis: Baca teks gambar via Browser OCR -> proses dengan AI Auto-Fill
    if (statusEl) {
      statusEl.innerHTML = '<span class="text-amber-300"><i class="fas fa-spinner fa-spin mr-1"></i>Membaca angka & teks screenshot via OCR lokal...</span>';
    }
    const ocrText = await extractTextViaBrowserOcr(base64Img);
    if (!ocrText || ocrText.length < 4) {
      throw new Error('Teks pada gambar tidak terbaca jelas.');
    }

    const inputEl = document.getElementById('ai-autofill-input');
    if (inputEl) {
      inputEl.value = `[Hasil Scan Screenshot]: ${ocrText.slice(0, 380)}`;
    }
    if (typeof runAiAutoFill === 'function') {
      await runAiAutoFill();
    }
  } catch (err) {
    if (statusEl) {
      statusEl.innerHTML = `<span class="text-rose-400">Gagal scan gambar: ${err.message}</span>`;
    }
  } finally {
    if (scanLabel) scanLabel.innerHTML = origLabel;
    event.target.value = '';
  }
}

// ============================================================
// 2. HANDS-FREE VOICE JOURNAL (REKAM SUARA -> AUTO-FILL)
// ============================================================
let mediaRecorderInstance = null;
let audioChunksList = [];
let isRecordingVoice = false;

async function toggleVoiceJournalRecording() {
  const micBtn = document.getElementById('ai-voice-btn');
  const statusEl = document.getElementById('ai-autofill-status');
  const inputEl = document.getElementById('ai-autofill-input');

  if (isRecordingVoice && mediaRecorderInstance) {
    mediaRecorderInstance.stop();
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Browser perangkat Anda tidak mendukung perekaman mikrofon.');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunksList = [];
    const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
    mediaRecorderInstance = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);

    mediaRecorderInstance.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) audioChunksList.push(e.data);
    };

    mediaRecorderInstance.onstop = async () => {
      isRecordingVoice = false;
      stream.getTracks().forEach(t => t.stop());

      if (micBtn) {
        micBtn.className = 'px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-rose-400 font-bold text-[11px] shrink-0 transition';
        micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
      }

      if (statusEl) {
        statusEl.innerHTML = '<span class="text-amber-300"><i class="fas fa-spinner fa-spin mr-1"></i>Mengubah suara menjadi teks (Groq Whisper)...</span>';
        statusEl.classList.remove('hidden');
      }

      try {
        const audioBlob = new Blob(audioChunksList, { type: mediaRecorderInstance.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const res = await fetch('/api/voice', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'stt',
                audioBase64: reader.result,
                mimeType: audioBlob.type
              })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Gagal transkripsi suara.');

            if (inputEl && data.text) {
              inputEl.value = data.text;
              if (typeof runAiAutoFill === 'function') {
                await runAiAutoFill();
              }
            }
          } catch (err) {
            if (statusEl) statusEl.innerHTML = `<span class="text-rose-400">Error Suara: ${err.message}</span>`;
          }
        };
        reader.readAsDataURL(audioBlob);
      } catch (err) {
        if (statusEl) statusEl.innerHTML = `<span class="text-rose-400">Gagal memproses audio: ${err.message}</span>`;
      }
    };

    mediaRecorderInstance.start();
    isRecordingVoice = true;

    if (micBtn) {
      micBtn.className = 'px-2.5 py-1.5 rounded-lg bg-rose-600 text-white font-bold text-[11px] shrink-0 animate-pulse transition';
      micBtn.innerHTML = '<i class="fas fa-stop"></i>';
    }
    if (statusEl) {
      statusEl.innerHTML = '<span class="text-rose-300"><i class="fas fa-circle-dot fa-beat mr-1"></i>Merekam suara... Bicara lalu tekan tombol kotak merah untuk selesai.</span>';
      statusEl.classList.remove('hidden');
    }
  } catch (err) {
    alert('Izin mikrofon ditolak atau tidak tersedia: ' + err.message);
  }
}

// ============================================================
// 3. ELEVENLABS AUDIO BRIEFING + INSTANT DEVICE VOICE FALLBACK
// ============================================================
let currentTtsAudio = null;
let isSpeakingDevice = false;

function speakWithDeviceFallback(text, btn) {
  if (!('speechSynthesis' in window)) {
    if (btn) btn.innerHTML = '<i class="fas fa-volume-high mr-1"></i>Dengarkan Audio';
    if (typeof showToast === 'function') showToast('Perangkat tidak mendukung pemutar suara.', 'error');
    return;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text.slice(0, 600));
  utter.lang = 'id-ID';
  utter.rate = 1.02;
  utter.onstart = () => {
    isSpeakingDevice = true;
    if (btn) btn.innerHTML = '<i class="fas fa-stop mr-1 text-rose-400"></i>Hentikan Suara';
  };
  utter.onend = () => {
    isSpeakingDevice = false;
    if (btn) btn.innerHTML = '<i class="fas fa-volume-high mr-1"></i>Dengarkan Audio';
  };
  utter.onerror = () => {
    isSpeakingDevice = false;
    if (btn) btn.innerHTML = '<i class="fas fa-volume-high mr-1"></i>Dengarkan Audio';
  };
  window.speechSynthesis.speak(utter);
}

async function playAiCopilotAudio() {
  const outEl = document.getElementById('ai-analyst-output');
  const btn = document.getElementById('ai-tts-btn');
  if (!outEl) return;

  // Hentikan jika audio sedang diputar
  if ((currentTtsAudio && !currentTtsAudio.paused) || isSpeakingDevice) {
    if (currentTtsAudio) {
      currentTtsAudio.pause();
      currentTtsAudio = null;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    isSpeakingDevice = false;
    if (btn) btn.innerHTML = '<i class="fas fa-volume-high mr-1"></i>Dengarkan Audio';
    return;
  }

  const rawText = outEl.innerText
    .replace(/Dijawab oleh.*|Dengarkan Audio|Memuat Suara\.\.\.|Hentikan Suara/gi, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!rawText) return;

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Memuat Suara...';
  }

  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), 7500);

  try {
    const res = await fetch('/api/voice', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'tts', text: rawText })
    });
    clearTimeout(abortTimer);

    const data = await res.json();
    if (res.ok && data.audioBase64) {
      currentTtsAudio = new Audio(data.audioBase64);
      currentTtsAudio.onended = () => {
        currentTtsAudio = null;
        if (btn) btn.innerHTML = '<i class="fas fa-volume-high mr-1"></i>Dengarkan Audio';
      };
      await currentTtsAudio.play();
      if (btn) btn.innerHTML = '<i class="fas fa-stop mr-1 text-rose-400"></i>Hentikan Suara';
    } else {
      speakWithDeviceFallback(rawText, btn);
    }
  } catch (_) {
    clearTimeout(abortTimer);
    speakWithDeviceFallback(rawText, btn);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ============================================================
// 4. LIVE ECONOMIC CALENDAR & SENTIMENT (FIRECRAWL + AI)
// ============================================================
async function fetchLiveEconomicCalendar() {
  const pair = (document.getElementById('m-pair')?.value || 'XAUUSD').trim().toUpperCase() || 'XAUUSD';
  const box = document.getElementById('news-radar-result');
  const btn = document.getElementById('cal-radar-btn');

  const origBtn = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Kalender...';
  }
  if (box) {
    box.innerHTML = `<p class="text-[10px] text-amber-300 font-mono"><i class="fas fa-calendar-day fa-beat mr-1"></i>Mengambil jadwal berita High-Impact & sentimen pasar <strong>${pair}</strong> dari Forex Factory & Myfxbook...</p>`;
    box.classList.remove('hidden');
  }

  try {
    const res = await fetch('/api/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pair })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Calendar Error (${res.status})`);

    const sources = Array.isArray(data.sources) ? data.sources : [];
    if (sources.length === 0) {
      box.innerHTML = `<p class="text-[10px] text-slate-400">Tidak ditemukan jadwal rilis khusus saat ini. Cek langsung <a href="https://www.forexfactory.com/calendar" target="_blank" class="text-amber-400 underline">Forex Factory ↗</a>.</p>`;
      return;
    }

    const digest = sources.map((s, i) => `[${i + 1}] ${s.title} (${s.url}): ${s.content}`).join('\n');
    const aiRes = await callLlmWithFailover([
      {
        role: 'system',
        content: 'Kamu analis kalender ekonomi forex & gold. Ekstrak jadwal berita penting (High-Impact / Red Folder), jam rilis (konversi ke WIB jika ada), dan sentimen posisi Long/Short dari data berikut dalam bahasa Indonesia ringkas.'
      },
      {
        role: 'user',
        content: `Instrumen: ${pair}\nData Live (${sources[0].engine}):\n${digest}\n\nTampilkan dalam 3 poin padat:\n1. Jadwal Rilis Berita Penting Hari Ini\n2. Sentimen & Outlook Pasar\n3. Catatan Volatilitas untuk ${pair}`
      }
    ], false);

    const formatted = aiRes.content
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-100">$1</strong>')
      .replace(/\n/g, '<br>');

    box.innerHTML = `
      <div class="text-[11px] text-slate-300 leading-relaxed space-y-1.5">
        <div class="flex items-center justify-between text-[9px] font-mono text-amber-400 pb-1 border-b border-slate-800">
          <span><i class="fas fa-calendar-check mr-1"></i>Kalender Ekonomi & Sentimen (${sources[0].engine})</span>
          <span class="text-slate-400">${aiRes.provider}</span>
        </div>
        <div>${formatted}</div>
        <div class="pt-1.5 border-t border-slate-800/80 space-y-1">
          ${sources.slice(0, 3).map(s => `
            <a href="${s.url}" target="_blank" rel="noopener noreferrer" class="block text-[9px] font-mono text-blue-400 hover:underline truncate">
              ↗ ${s.title}
            </a>
          `).join('')}
        </div>
      </div>
    `;
  } catch (err) {
    if (box) box.innerHTML = `<p class="text-[10px] text-rose-400">Kendala Kalender Live: ${err.message}</p>`;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origBtn;
    }
  }
}
