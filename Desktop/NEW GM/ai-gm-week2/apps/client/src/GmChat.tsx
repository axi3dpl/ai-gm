import React from 'react';

type Msg = { from: 'gm' | 'me'; text: string };

export default function GmChat({
  campaignId,
  setup,
  onBack,
}: {
  campaignId: string
  setup?: { players: number; mode: 'custom' | 'random' }
  onBack: () => void
}) {
  const threadKey = `gm_thread_id_${campaignId}`;
  const logKey = `gm_chat_log_${campaignId}`;

  const [threadId, setThreadId] = React.useState<string | undefined>(() =>
    localStorage.getItem(threadKey) || undefined
  );
  const [log, setLog] = React.useState<Msg[]>(() => {
    const saved = localStorage.getItem(logKey);
    return saved ? (JSON.parse(saved) as Msg[]) : [];
  });
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string>('');
  const recognitionRef = React.useRef<any>(null);
  const [listening, setListening] = React.useState(false);
  const [canVoice, setCanVoice] = React.useState(false);

  const base = import.meta.env.VITE_API_BASE as string;

  React.useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'pl-PL';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      onSend(text);
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    setCanVoice(true);
  }, []);

  async function speak(text: string) {
    try {
      const r = await fetch(`${base}/api/gm/speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!r.ok) throw new Error(`speech ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
    } catch (e) {
      console.error('[GmChat] TTS error:', e);
    }
  }

  // Try to auto-create a thread on mount (non-blocking)
  React.useEffect(() => {
    if (threadId) return;
    (async () => {
      try {
        console.log('[GmChat] Creating initial thread...');
        const r = await fetch(`${base}/api/gm/thread`, { method: 'POST' });
        if (!r.ok) throw new Error(`thread ${r.status}`);
        const { threadId: newThreadId } = await r.json();
        console.log('[GmChat] Thread created:', newThreadId);
        setThreadId(newThreadId);
        let intro = 'Start';
        if (setup) {
          intro = `Start kampanii dla ${setup.players} graczy. ${
            setup.mode === 'custom'
              ? 'Stworzymy własne postacie i zarys fabuły.'
              : 'Proszę wylosuj postacie i zarys fabuły.'
          }`;
        }
        await sendInternal(newThreadId, intro, { silent: true });
      } catch (e: any) {
        console.error('[GmChat] Failed to create thread:', e);
        setError('Nie udało się połączyć z Mistrzem Gry. Spróbuj wysłać wiadomość ponownie.');
      }
    })();
  }, [base, threadId, setup]);

  React.useEffect(() => {
    if (threadId) {
      localStorage.setItem(threadKey, threadId);
    }
  }, [threadId, threadKey]);

  React.useEffect(() => {
    localStorage.setItem(logKey, JSON.stringify(log));
  }, [log, logKey]);

  async function ensureThread(): Promise<string> {
    if (threadId) {
      console.log('[GmChat] Using existing thread:', threadId);
      return threadId;
    }
    console.log('[GmChat] Creating new thread...');
    const r = await fetch(`${base}/api/gm/thread`, { method: 'POST' });
    if (!r.ok) throw new Error(`thread ${r.status}`);
    const { threadId: newThreadId } = await r.json();
    console.log('[GmChat] New thread created:', newThreadId);
    setThreadId(newThreadId);
    return newThreadId;
  }

  async function sendInternal(
    currentThreadId: string,
    text: string,
    opts?: { silent?: boolean }
  ) {
    console.log('[GmChat] sendInternal called with:', { currentThreadId, text });
    if (!opts?.silent) {
      setLog((l) => [...l, { from: 'me', text }]);
    }
    setBusy(true);
    setError('');
    
    try {
      // add user message
      console.log('[GmChat] Adding message to thread:', currentThreadId);
      const r1 = await fetch(`${base}/api/gm/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: currentThreadId, content: text }),
      });
      if (!r1.ok) throw new Error(`message ${r1.status}`);

      // run assistant
      console.log('[GmChat] Running assistant on thread:', currentThreadId);
      const r2 = await fetch(`${base}/api/gm/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: currentThreadId }),
      });
      if (!r2.ok) {
        const errorText = await r2.text();
        console.error('[GmChat] Run failed:', r2.status, errorText);
        throw new Error(`run ${r2.status}: ${errorText}`);
      }
      const { reply } = await r2.json();
      setLog((l) => [...l, { from: 'gm', text: reply }]);
      speak(reply);
    } catch (e: any) {
      console.error('[GmChat] Error in sendInternal:', e);
      setError('Problem z odpowiedzią MG. Sprawdź połączenie i spróbuj ponownie.');
    } finally {
      setBusy(false);
    }
  }

  async function onSend(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || busy) return;
    if (!textOverride) setInput('');
    try {
      const currentThreadId = await ensureThread();
      await sendInternal(currentThreadId, text);
    } catch (e: any) {
      console.error('[GmChat] Error in onSend:', e);
      setError('Nie mogę utworzyć rozmowy z MG. Sprawdź konfigurację.');
    }
  }

  function toggleListening() {
    const rec = recognitionRef.current;
    if (!rec) {
      alert('Twoja przeglądarka nie obsługuje rozpoznawania mowy');
      return;
    }
    if (listening) {
      rec.stop();
    } else {
      setListening(true);
      rec.start();
    }
  }

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: 16, fontFamily: 'system-ui' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>AI Mistrz Gry — tworzenie fabuły</h2>
        <button onClick={onBack}>Zapisz i wyjdź</button>
      </div>
      
      {/* Debug info */}
      <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
        Thread ID: {threadId || 'none'}
      </div>

      {error && (
        <div style={{ background: '#3b0d0d', color: '#ffd7d7', padding: 10, borderRadius: 8, marginBottom: 8 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '12px 0' }}>
        {log.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.from === 'me' ? 'flex-end' : 'flex-start',
              background: m.from === 'me' ? '#1e3a8a' : '#111827',
              color: '#fff',
              padding: '10px 12px',
              borderRadius: 12,
              maxWidth: '85%',
              whiteSpace: 'pre-wrap',
            }}
          >
            {m.text}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSend()
          }}
          placeholder="Napisz do Mistrza Gry…"
          style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #374151', background: '#0b0f1a', color: '#fff' }}
        />
        {canVoice && (
          <button disabled={busy} onClick={toggleListening}>
            {listening ? '🎙️…' : '🎙️'}
          </button>
        )}
        <button disabled={busy || !input.trim()} onClick={() => onSend()}>Wyślij</button>
      </div>

      {busy && <p style={{ opacity: 0.7, marginTop: 8 }}>MG myśli…</p>}
    </div>
  );
}