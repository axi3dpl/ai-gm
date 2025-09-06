import React from 'react'
import { signOut } from './supabaseClient'
import GmChat from './GmChat'

export default function App() {
  // minimal screen just to test GM chat renders
  return (
    <div style={{ maxWidth: 720, margin: '40px auto', fontFamily: 'system-ui' }}>
      <header style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
        <h1 style={{ margin:0 }}>AI Game Master</h1>
        <button onClick={async ()=>{ try{ await signOut() }catch{} }}>Wyloguj</button>
      </header>
      <GmChat />
    </div>
  )
}
