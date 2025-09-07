import { Router } from "express";
import OpenAI from "openai";
import { randomUUID } from "crypto";

const router = Router();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const GM_RULES = process.env.GM_RULES || "";

interface Conversation {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
}

const conversations = new Map<string, Conversation>();

router.post("/thread", (req, res) => {
  try {
    const { playerId } = req.body ?? {};
    const id = randomUUID();
    const convo: Conversation = { messages: [] };
    if (GM_RULES) {
      convo.messages.push({ role: "system", content: GM_RULES });
    }
    if (playerId) {
      convo.messages.push({
        role: "system",
        content: `Rozmawiasz z graczem ${playerId}. Zapamiętaj tego gracza i prowadź spójną rozmowę tylko z nim.`,
      });
    }
    conversations.set(id, convo);
    res.json({ threadId: id });
  } catch (e: any) {
    console.error("[/api/gm/thread] error:", e?.message || e);
    res.status(500).json({ error: "thread error", detail: String(e?.message || e) });
  }
});

router.post("/message", (req, res) => {
  try {
    const { threadId, content } = req.body ?? {};
    if (!threadId || !content) {
      return res.status(400).json({ error: "threadId and content required" });
    }
    const convo = conversations.get(threadId);
    if (!convo) {
      return res.status(404).json({ error: "unknown threadId" });
    }
    convo.messages.push({ role: "user", content });
    res.json({ ok: true });
  } catch (e: any) {
    console.error("[/api/gm/message] error:", e?.message || e);
    res.status(500).json({ error: "message error", detail: String(e?.message || e) });
  }
});

router.post("/run", async (req, res) => {
  try {
    const { threadId } = req.body ?? {};
    if (!threadId) {
      return res.status(400).json({ error: "threadId required" });
    }
    const convo = conversations.get(threadId);
    if (!convo) {
      return res.status(404).json({ error: "unknown threadId" });
    }
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: convo.messages,
    });
    const reply = completion.choices[0]?.message?.content?.trim();
    if (!reply) {
      return res.status(500).json({ error: "empty reply" });
    }
    convo.messages.push({ role: "assistant", content: reply });
    res.json({ reply });
  } catch (e: any) {
    console.error("[/api/gm/run] error:", e?.message || e);
    res.status(500).json({ error: "run error", detail: String(e?.message || e) });
  }
});

router.post("/speech", async (req, res) => {
  try {
    const { text } = req.body ?? {};
    const key = process.env.ELEVENLABS_KEY;
    const voice = process.env.VOICE_ID;

    if (!text) {
      return res.status(400).json({ error: "text required" });
    }
    if (!key || !voice) {
      console.warn("[gmAssistants] Missing ELEVENLABS_KEY or VOICE_ID");
      return res.status(500).json({ error: "tts not configured" });
    }

    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
      method: "POST",
      headers: {
        "xi-api-key": key,
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (!r.ok) {
      const err = await r.text();
      console.error("[/api/gm/speech] TTS failed:", r.status, err);
      return res.status(500).json({ error: "tts failed", detail: err });
    }

    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(buf);
  } catch (e: any) {
    console.error("[/api/gm/speech] error:", e?.message || e);
    res.status(500).json({ error: "tts error", detail: String(e?.message || e) });
  }
});

export default router;
