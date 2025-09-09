import React from 'react'
import { supabase, signIn, signUp, signOut, fetchCampaigns, createCampaign, type Campaign } from './supabaseClient'
import GmChat from './GmChat'

type Screen = 'auth' | 'start' | 'list' | 'gm'

function isScreen(s: string | null): s is Screen {
  return s === 'auth' || s === 'start' || s === 'list' || s === 'gm'
}

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
        <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input placeholder="Hasło" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit">{mode === 'login' ? 'Zaloguj' : 'Zarejestruj'}</button>
        <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Nie masz konta? Zarejestruj' : 'Masz konto? Zaloguj'}
        </button>
      </form>
      {msg && <p style={{ color: 'crimson' }}>{msg}</p>}
    </div>
  )
}

interface StartScreenProps {
  onList: () => void
  onLogout: () => void
  onGM: () => void
}

function StartScreen({ onList, onLogout, onGM }: StartScreenProps) {
  return (
    <div style={{ maxWidth: 640, margin: '64px auto', fontFamily: 'system-ui', display: 'grid', gap: 12 }}>
      <h1>AI Game Master</h1>
      <button onClick={onGM}>Nowa kampania</button>
      <button onClick={onList}>Kontynuuj</button>
      <button onClick={onLogout}>Wyloguj</button>
    </div>
  )
}

function CampaignList({ onBack, onOpen }: { onBack: () => void; onOpen: (id: string) => void }) {
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
        {items.map((c) => (
          <li key={c.id} style={{ marginBottom: 8 }}>
            <strong>{c.title}</strong> — {c.world} <em>({new Date(c.created_at).toLocaleString()})</em>
            <button style={{ marginLeft: 8 }} onClick={() => onOpen(c.id)}>
              Kontynuuj
            </button>
          </li>
        ))}
      </ul>
      <button onClick={onBack}>Wróć</button>
    </div>
  )
}


export default function App() {
  const [screen, setScreen] = React.useState<Screen>(() => {
    const saved = localStorage.getItem('screen')
    return isScreen(saved) ? saved : 'auth'
  })
  const [currentCampaignId, setCurrentCampaignId] = React.useState<string | null>(null)
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    localStorage.setItem('screen', screen)
  }, [screen])

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        const saved = localStorage.getItem('screen')
        setScreen(saved && isScreen(saved) && saved !== 'auth' ? saved : 'start')
      } else {
        setScreen('auth')
      }
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) {
        const saved = localStorage.getItem('screen')
        setScreen(saved && isScreen(saved) && saved !== 'auth' ? saved : 'start')
      } else {
        setScreen('auth')
      }
    })
    return () => {
      sub.subscription.unsubscribe()
    }
  }, [])

  if (!ready) return <div style={{ fontFamily: 'system-ui', padding: 24 }}>Ładowanie…</div>
  if (screen === 'auth') return <AuthScreen onDone={() => setScreen('start')} />
  if (screen === 'list')
    return (
      <CampaignList
        onBack={() => setScreen('start')}
        onOpen={(id) => {
          setCurrentCampaignId(id)
          setScreen('gm')
        }}
      />
    )
  if (screen === 'gm' && currentCampaignId)
    return (
      <GmChat
        campaignId={currentCampaignId}
        onBack={() => {
          setScreen('start')
        }}
      />
    )

  return (
    <StartScreen
      onList={() => setScreen('list')}
      onLogout={async () => {
        await signOut()
        setScreen('auth')
      }}
      onGM={async () => {
        try {
          const c = await createCampaign({
            title: `Kampania ${new Date().toLocaleString()}`,
            world: 'fantasy',
          })
          setCurrentCampaignId(c.id)
          setScreen('gm')
        } catch (e: any) {
          alert(e.message || 'Błąd tworzenia kampanii')
        }
      }}
    />
  )
}
