import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function composePrompt(
  client: OpenAI,
  campaignId: string,
  userMessage: string
): Promise<string> {
  const { data: canonRow } = await supabase
    .from('canon')
    .select('state')
    .eq('campaign_id', campaignId)
    .single();
  const canon = canonRow?.state ?? {};

  const emb = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: userMessage,
  });
  const vector = emb.data[0].embedding;

  const { data: scenes } = await supabase.rpc('match_scene_summaries', {
    campaign_id: campaignId,
    query_embedding: vector,
    match_count: 8,
  });

  const { data: facts } = await supabase.rpc('match_facts', {
    campaign_id: campaignId,
    query_embedding: vector,
    match_count: 8,
  });

  const episodic = (scenes ?? []).map((s: any) => s.summary).join('\n');
  const factsText = (facts ?? []).map((f: any) => f.fact).join('\n');
  const memory = [episodic, factsText].filter(Boolean).join('\n');

  return `CANON/STATE:\n${JSON.stringify(canon)}\n\nMEMORY CONTEXT:\n${memory}\n\nUSER:\n${userMessage}`;
}

export async function updateMemories(
  client: OpenAI,
  campaignId: string,
  userMessage: string,
  assistantReply: string
) {
  const scene = `${userMessage}\n${assistantReply}`;

  const summaryResp = await client.responses.create({
    model: 'gpt-4o-mini',
    input: `Streść scenę w 1-2 zdaniach:\n${scene}`,
  });
  const summary = summaryResp.output_text.trim();

  const factsResp = await client.responses.create({
    model: 'gpt-4o-mini',
    input: `Wypisz najważniejsze fakty jako oddzielne zdania:\n${scene}`,
  });
  const facts = factsResp.output_text
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean);

  const sumEmb = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: summary,
  });
  await supabase.from('scene_summaries').insert({
    campaign_id: campaignId,
    summary,
    embedding: sumEmb.data[0].embedding,
  });

  for (const fact of facts) {
    const factEmb = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: fact,
    });
    await supabase.from('facts').insert({
      campaign_id: campaignId,
      fact,
      embedding: factEmb.data[0].embedding,
    });
  }

  const { data: canonRow } = await supabase
    .from('canon')
    .select('state')
    .eq('campaign_id', campaignId)
    .single();
  const prevCanon = canonRow?.state ?? {};

  const canonPrompt = `Zaktualizuj JSON stanu świata na podstawie sceny. Zwróć tylko JSON.\nStan:\n${JSON.stringify(
    prevCanon
  )}\nScena:\n${scene}`;
  const canonResp = await client.responses.create({
    model: 'gpt-4o-mini',
    input: canonPrompt,
  });

  let newCanon = prevCanon;
  try {
    newCanon = JSON.parse(canonResp.output_text);
  } catch {
    // ignore parse errors
  }

  await supabase.from('canon').upsert({
    campaign_id: campaignId,
    state: newCanon,
    updated_at: new Date().toISOString(),
  });
}

