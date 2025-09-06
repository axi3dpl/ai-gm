import React from 'react'
import { createRoot } from 'react-dom/client'
import { supabase, signIn, signUp, signOut, fetchCampaigns, createCampaign, type Campaign } from './supabaseClient'
import GmChat from './GmChat'   // 👈 import the GM chat

type Screen = 'auth' | 'start' | 'new' | 'list' | 'gm'   // 👈 add gm

function AuthScreen({ onDone }: { onDone: () => void }) {
  // ... (unchanged)
}

function StartScreen({ onNew, onList, onLogout, onGM }:{
  onNew:()=>void; onList:()=>void; onLogout:()=>void; onGM:()=>void
}) {
  return (
    <div style={{ maxWidth: 640, margin: '64px auto', fontFamily: 'system-ui', display:'grid', gap: 12 }}>
      <h1>AI Game Master</h1>
      <button onClick={onNew}>Nowa kampania (formularz)</button>
      <button onClick={onGM}>Nowa kampania z MG 🤖</button>   {/* 👈 new button */}
      <button onClick={onList}>Kontynuuj</button>
      <button onClick={onLogout}>Wyloguj</button>
    </div>
  )
}

function NewCampaignForm({ onBack }:{ onBack:()=>void }) {
  // ... (unchanged)
}

function CampaignList({ onBack }:{ onBack:()=>void }) {
  // ... (unchanged)
}

function App(){
  const [screen, setScreen] = React.useState<Screen>('auth')
  const [ready, setReady] = React.useState(false)

  React.useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{
      setScreen(data.session?'start':'auth')
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session)=> 
      setScreen(session?'start':'auth')
    )
    return ()=>{ sub.subscription.unsubscribe() }
  },[])

  if(!ready) return <div style={{fontFamily:'system-ui', padding:24}}>Ładowanie…</div>
  if(screen==='auth') return <AuthScreen onDone={()=>setScreen('start')} />
  if(screen==='new') return <NewCampaignForm onBack={()=>setScreen('start')} />
  if(screen==='list') return <CampaignList onBack={()=>setScreen('start')} />
  if(screen==='gm') return <GmChat />   {/* 👈 show the GM chat */}

  return (
    <StartScreen
      onNew={()=>setScreen('new')}
      onList={()=>setScreen('list')}
      onLogout={async()=>{ await signOut(); setScreen('auth') }}
      onGM={()=>setScreen('gm')}   // 👈 navigate to GM chat
    />
  )
}

createRoot(document.getElementById('root')!).render(<App />)
