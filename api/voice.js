function cleanEnv(val) {
  return (val || '').replace(/[\r\n\s]+/g, '').trim();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const action = body.action;

  // A. Speech-to-Text via Groq Whisper
  if (action === 'stt') {
    const groqKey = cleanEnv(process.env.GROQ_API_KEY);
    if (!groqKey) {
      return res.status(503).json({ error: 'GROQ_API_KEY belum diatur di Vercel.' });
    }

    const audioBase64 = body.audioBase64 || '';
    const mimeType = body.mimeType || 'audio/webm';
    const rawB64 = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;

    if (!rawB64) {
      return res.status(400).json({ error: 'Data rekaman suara kosong.' });
    }

    try {
      const buffer = Buffer.from(rawB64, 'base64');
      const ext = mimeType.includes('mp4') ? 'm4a' : (mimeType.includes('ogg') ? 'ogg' : 'webm');
      const formData = new FormData();
      const blob = new Blob([buffer], { type: mimeType });
      formData.append('file', blob, `voice_note.${ext}`);
      formData.append('model', 'whisper-large-v3-turbo');
      formData.append('language', 'id');

      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${groqKey}` },
        body: formData
      });

      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json({ error: data?.error?.message || 'Gagal transkripsi suara.' });
      }

      return res.status(200).json({ text: (data.text || '').trim() });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // B. Text-to-Speech via ElevenLabs dengan batas waktu 6 detik
  if (action === 'tts') {
    const elKey = cleanEnv(process.env.ELEVENLABS_API_KEY);
    if (!elKey) {
      return res.status(503).json({ error: 'ELEVENLABS_API_KEY_MISSING' });
    }

    const cleanText = String(body.text || '')
      .replace(/\|[-:]+\|/g, ' ')
      .replace(/[|*#_`~]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 600);

    if (!cleanText) {
      return res.status(400).json({ error: 'Teks kosong.' });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);

    try {
      const voiceId = 'pNInz6obpgDQGcFmaJgB';
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': elKey,
          'Accept': 'audio/mpeg'
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        })
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errTxt = await response.text();
        return res.status(response.status).json({ error: `ElevenLabs (${response.status}): ${errTxt.slice(0, 90)}` });
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64Audio = Buffer.from(arrayBuffer).toString('base64');
      return res.status(200).json({ audioBase64: `data:audio/mpeg;base64,${base64Audio}` });
    } catch (err) {
      clearTimeout(timer);
      return res.status(504).json({ error: 'Timeout / ElevenLabs tidak merespons.' });
    }
  }

  return res.status(400).json({ error: 'Action tidak dikenal.' });
};
