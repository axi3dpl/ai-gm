import React from 'react'

type Msg = { from: 'gm' | 'me'; text: string }

export default function GmChat() {
  const [threadId, setThreadId] = React.useState<string>()
  const [log, setLog] = React.useState<Msg[]>([])
  const [input, setInput] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const startedRef = React.useRef(false)

  const base = import.meta.env.VITE_API_BASE as string

  // create a new thread and kick off the conversation once
  React.useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    ;(async () => {
      // create thread
      const r = await fetch(`${base}/api/gm/thread`, { method: 'POST' })
      const { threadId } = await r.json()
      setThreadId(threadId)

      // start conversation
      await sendInternal(threadId, 'Start')
    })().catch(console.error)
  }, [base])

  async function sendInternal(tid: string, text: string) {
    setLog((l) => [...l, { from: 'me', text }])
    setBusy(true)
    try {
      // add user message
      await fetch(`${base}/api/gm/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: tid, content: text }),
      })

      // run assistant
      const r2 = await fetch(`${base}/api/gm/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: tid }),
      })
      const { reply } = await r2.json()
      setLog((l) => [...l, { from: 'gm', text: reply }])
    } finally {
      setBusy(false)
    }
  }

  async function onSend() {
    const text = input.trim()
    if (!text || !threadId || busy) return
    setInput('')
    await sendInternal(threadId, text)
  }

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: 16, fontFamily: 'system-ui' }}>
      <h2 style={{ marginBottom: 12 }}>AI Mistrz Gry — tworzenie fabuły</h2>

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
        <button disabled={busy || !input.trim() || !threadId} onClick={onSend}>
          Wyślij
        </button>
      </div>

      {busy && <p style={{ opacity: 0.7, marginTop: 8 }}>MG myśli…</p>}
    </div>
  )
}
