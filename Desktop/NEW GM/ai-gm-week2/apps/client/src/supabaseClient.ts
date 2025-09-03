import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL as string
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string
export const supabase = createClient(url, anon)

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}
export async function signUp(email: string, password: string) {
  return supabase.auth.signUp({ email, password })
}
export async function signOut() { return supabase.auth.signOut() }

export type Campaign = {
  id: string; owner_id: string; title: string;
  world: 'fantasy'|'scifi'|'horror'|'cyberpunk'; synopsis: string|null; created_at: string;
}

export async function fetchCampaigns(): Promise<Campaign[]> {
  const { data, error } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false })
  if (error) throw error; return data as Campaign[]
}
export async function createCampaign(payload: { title: string; world: Campaign['world'] }) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase.from('campaigns')
    .insert({ title: payload.title, world: payload.world, owner_id: user.id })
    .select('*').single()
  if (error) throw error; return data as Campaign
}
