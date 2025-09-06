import React from 'react'
import { createRoot } from 'react-dom/client'
import { supabase, signIn, signUp, signOut, fetchCampaigns, createCampaign, type Campaign } from './supabaseClient'
import GmChat from './GmChat'

type Screen = 'auth' | 'start' | 'new' | 'list' | 'gm'

function AuthScreen({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [mode, setMode] = React.useState<'login' | 'register'>('login')
  const [msg, setMsg] = React.useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMsg('')
    try {
      const fn = mode === 'login' ? signIn : signUp
      const { error } = await fn(email, password)
      if (error) throw error
      onDone()
    } catch (e: any) {
      setMsg(e.message || 'Error')
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '64px auto', fontFamily: 'system-ui' }}>
      <h1>Logowanie</h1>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
        <input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        <input placeholder="Hasło" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        <button type="submit">{mode === 'login' ? 'Zaloguj' : 'Zarejestruj'}</button>
        <button
          type="button"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? 'Nie masz konta? Zarejestruj' : 'Masz konto? Zaloguj'}
        </button>
      </form>
      {msg && <p style={{ color: 'crimson' }}>{msg}</p>}
    </div>
  )
}

interface StartScreenProps {
  onNew: () => void
  onList: () => void
  onLogout: () => void
  onGM: () => void
}

function StartScreen({ onNew, onList, onLogout, onGM }: StartScreenProps) {
  return (
    <div style={{ maxWidth: 640, margin: '64px auto', fontFamily: 'system-ui', display: 'grid', gap: 12 }}>
      <h1>AI Game Master</h1>
      <button onClick={onNew}>Nowa kampania (formularz)</button>
      <button onClick={onGM}>Nowa kampania z MG</button>
      <button onClick={onList}>Kontynuuj</button>
      <button onClick={onLogout}>Wyloguj</button>
    </div>
  )
}

function NewCampaignForm({ onBack }: { onBack: () => void }) {
  const [title, setTitle] = React.useState('Moja kampania')
  const [world, setWorld] = React.useState<'fantasy' | 'scifi' | 'horror' | 'cyberpunk'>('fantasy')
  const [msg, setMsg] = React.useState('')

  async function submit() {
    try {
      await createCampaign({ title, world })
      setMsg('Utworzono kampanię ✅')
    } catch (e: any) {
      setMsg(e.message || 'Błąd')
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '64px auto', fontFamily: 'system-ui', display: 'grid', gap: 12 }}>
      <h2>Nowa kampania</h2>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Tytuł" />
      <select value={world} onChange={e => setWorld(e.target.value as any)}>
        <option value="fantasy">Fantasy</option>
        <option value="scifi">Sci-Fi</option>
        <option value="horror">Horror</option>
        <option value="cyberpunk">Cyberpunk</option>
      </select>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={submit}>Zapisz</button>
        <button onClick={onBack}>Wróć</button>
      </div>
      {msg && <p>{msg}</p>}
    </div>
  )
}

function CampaignList({ onBack }: { onBack: () => void }) {
  const [items, setItems] = React.useState<Campaign[]>([])
  const [loading, setLoading] = React.useState(true)
  const [msg, setMsg] = React.useState('')

  React.useEffect(() => {
    ;(async () => {
      try {
        const d = await fetchCampaigns()
        setItems(d)
      } catch (e: any) {
        setMsg(e.message || 'Błąd')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div style={{ maxWidth: 720, margin: '64px auto', fontFamily: 'system-ui' }}>
      <h2>Twoje kampanie</h2>
      {loading && <p>Ładowanie…</p>}
      {msg && <p style={{ color: 'crimson' }}>{msg}</p>}
      <ul>
        {items.map(c => (
          <li key={c.id} style={{ marginBottom: 8 }}>
            <strong>{c.title}</strong> — {c.world}{' '}
            <em>({new Date(c.created_at).toLocaleString()})</em>
            <button
              style={{ marginLeft: 8 }}
              onClick={() => alert('Kontynuuj: ' + c.title + ' (placeholder)')}
            >
              Kontynuuj
            </button>
          </li>
        ))}
      </ul>
      <button onClick={onBack}>Wróć</button>
    </div>
  )
}

function App() {
  const [screen, setScreen] = React.useState<Screen>('auth')
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setScreen(data.session ? 'start' : 'auth')
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setScreen(session ? 'start' : 'auth')
    )
    return () => {
      sub.subscription.unsubscribe()
    }
  }, [])

  if (!ready) return <div style={{ fontFamily: 'system-ui', padding: 24 }}>Ładowanie…</div>
  if (screen === 'auth') return <AuthScreen onDone={() => setScreen('start')} />
  if (screen === 'new') return <NewCampaignForm onBack={() => setScreen('start')} />
  if (screen === 'list') return <CampaignList onBack={() => setScreen('start')} />
  if (screen === 'gm') return <GmChat />

  return (
    <StartScreen
      onNew={() => setScreen('new')}
      onList={() => setScreen('list')}
      onLogout={async () => {
        await signOut()
        setScreen('auth')
      }}
      onGM={() => setScreen('gm')}
    />
  )
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(<App />)
}
