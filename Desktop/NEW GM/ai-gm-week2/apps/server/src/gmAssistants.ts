// apps/server/src/gmAssistants.ts
import { Router } from "express";
import OpenAI from "openai";

const router = Router();
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const ASSISTANT_ID = process.env.ASSISTANT_GM_ID!;

router.post("/thread", async (_req, res) => {
  const thread = await client.beta.threads.create();
  res.json({ threadId: thread.id });
});

router.post("/message", async (req, res) => {
  const { threadId, content } = req.body ?? {};
  if (!threadId || !content) return res.status(400).json({ error: "threadId and content required" });
  await client.beta.threads.messages.create(threadId, { role: "user", content });
  res.json({ ok: true });
});

router.post("/run", async (req, res) => {
  const { threadId } = req.body ?? {};
  if (!threadId) return res.status(400).json({ error: "threadId required" });

  try {
    const run = await client.beta.threads.runs.create(threadId, {
      assistant_id: ASSISTANT_ID,
    });

    // Poll until done (with a simple timeout guard)
    const started = Date.now();
    let status = run.status;
    while (status === "queued" || status === "in_progress") {
      if (Date.now() - started > 60_000) {
        return res.status(504).json({ error: "run timeout" });
      }
      await new Promise(r => setTimeout(r, 800));
      const r2 = await client.beta.threads.runs.retrieve(threadId, run.id);
      status = r2.status;
    }

    if (status !== "completed") {
      return res.status(500).json({ error: `run status: ${status}` });
    }

    // 👇 Fetch several messages and pick the most recent ASSISTANT one
    const list = await client.beta.threads.messages.list(threadId, { order: "desc", limit: 10 });

    const assistantMsg = list.data.find(m => m.role === "assistant");
    let text = "";

    if (assistantMsg) {
      // collect text parts safely
      for (const part of assistantMsg.content) {
        if (part.type === "text") {
          text += (text ? "\n" : "") + part.text.value;
        }
      }
    }

    if (!text) {
      // return something helpful if empty
      return res.status(200).json({ reply: "(Brak odpowiedzi MG — sprawdź ASSISTANT_GM_ID i instrukcje asystenta.)" });
    }

    res.json({ reply: text });
  } catch (e: any) {
    console.error("[/api/gm/run] error:", e?.message || e);
    res.status(500).json({ error: "run error", detail: String(e?.message || e) });
  }
});

export default router;
