import React from 'react';

type Msg = { from: 'gm' | 'me'; text: string };

export default function GmChat() {
  const [threadId, setThreadId] = React.useState<string>();
  const [log, setLog] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string>('');

  const base = import.meta.env.VITE_API_BASE as string;

  // Try to auto-create a thread on mount (non-blocking)
  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${base}/api/gm/thread`, { method: 'POST' });
        if (!r.ok) throw new Error(`thread ${r.status}`);
        const { threadId } = await r.json();
        setThreadId(threadId);
        // kick off with "Start" once thread exists
        await sendInternal(threadId, 'Start');
      } catch (e: any) {
        // don't block UI; user can still type and we'll create thread on first send
        setError('Nie udało się połączyć z Mistrzem Gry. Spróbuj wysłać wiadomość ponownie.');
      }
    })();
  }, [base]);

  async function ensureThread(): Promise<string> {
    if (threadId) return threadId;
    const r = await fetch(`${base}/api/gm/thread`, { method: 'POST' });
    if (!r.ok) throw new Error(`thread ${r.status}`);
    const { threadId: tid } = await r.json();
    setThreadId(tid);
    return tid;
  }

  async function sendInternal(tid: string, text: string) {
    setLog((l) => [...l, { from: 'me', text }]);
    setBusy(true);
    setError('');
    try {
      // add user message
      const r1 = await fetch(`${base}/api/gm/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: tid, content: text }),
      });
      if (!r1.ok) throw new Error(`message ${r1.status}`);

      // run assistant
      const r2 = await fetch(`${base}/api/gm/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: tid }),
      });
      if (!r2.ok) throw new Error(`run ${r2.status}`);
      const { reply } = await r2.json();
      setLog((l) => [...l, { from: 'gm', text: reply }]);
    } catch (e: any) {
      setError('Problem z odpowiedzią MG. Sprawdź połączenie i spróbuj ponownie.');
    } finally {
      setBusy(false);
    }
  }

  async function onSend() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    try {
      const tid = await ensureThread();
      await sendInternal(tid, text);
    } catch (e: any) {
      setError('Nie mogę utworzyć rozmowy z MG. Sprawdź konfigurację.');
    }
  }

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: 16, fontFamily: 'system-ui' }}>
      <h2 style={{ marginBottom: 12 }}>AI Mistrz Gry — tworzenie fabuły</h2>

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
          onKeyDown={(e) => { if (e.key === 'Enter') onSend(); }}
          placeholder="Napisz do Mistrza Gry…"
          style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #374151', background: '#0b0f1a', color: '#fff' }}
        />
        {/* Enable as long as there is text and we're not busy (no longer blocked by missing thread) */}
        <button disabled={busy || !input.trim()} onClick={onSend}>Wyślij</button>
      </div>

      {busy && <p style={{ opacity: 0.7, marginTop: 8 }}>MG myśli…</p>}
    </div>
  );
}
