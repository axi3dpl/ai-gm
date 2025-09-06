import { Router } from "express";
import OpenAI from "openai";

const router = Router();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const ASSISTANT_ID = process.env.ASSISTANT_GM_ID!;

if (!process.env.OPENAI_API_KEY) {
  console.warn("[gmAssistants] Missing OPENAI_API_KEY");
}
if (!ASSISTANT_ID) {
  console.warn("[gmAssistants] Missing ASSISTANT_GM_ID");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Minimal shape for messages we read back from the API
type MsgPart =
  | { type: "text"; text: { value: string } }
  | { type: string; [k: string]: any };

interface ThreadMessage {
  id: string;
  role: "user" | "assistant" | string;
  content: MsgPart[];
}

router.post("/thread", async (_req, res) => {
  try {
    const thread = await client.beta.threads.create();
    res.json({ threadId: thread.id });
  } catch (e: any) {
    console.error("[/api/gm/thread] error:", e?.message || e);
    res.status(500).json({ error: "thread error", detail: String(e?.message || e) });
  }
});

router.post("/message", async (req, res) => {
  try {
    const { threadId, content } = req.body ?? {};
    if (!threadId || !content) {
      return res.status(400).json({ error: "threadId and content required" });
    }
    await client.beta.threads.messages.create(threadId, {
      role: "user",
      content,
    });
    res.json({ ok: true });
  } catch (e: any) {
    console.error("[/api/gm/message] error:", e?.message || e);
    res.status(500).json({ error: "message error", detail: String(e?.message || e) });
  }
});

router.post("/run", async (req, res) => {
  const { threadId } = req.body ?? {};
  if (!threadId) return res.status(400).json({ error: "threadId required" });

  try {
    // Start a run on the assistant
    const run = await client.beta.threads.runs.create(threadId, {
      assistant_id: ASSISTANT_ID,
    });

    // Poll until the run finishes (with 60s timeout)
    const startTs = Date.now();
    let status = run.status;

    while (status === "queued" || status === "in_progress") {
      if (Date.now() - startTs > 60_000) {
        return res.status(504).json({ error: "run timeout" });
      }
      await sleep(800);
      const latest = await client.beta.threads.runs.retrieve(threadId, run.id);
      status = latest.status;
    }

    if (status !== "completed") {
      return res.status(500).json({ error: `run status: ${status}` });
    }

    // Fetch several recent messages and pick the newest *assistant* one
    const list = await client.beta.threads.messages.list(threadId, {
      order: "desc",
      limit: 20,
    });

    const assistantMsg = (list.data as ThreadMessage[]).find(
      (m: ThreadMessage) => m.role === "assistant"
    );

    let reply = "";
    if (assistantMsg) {
      for (const part of assistantMsg.content) {
        if (part.type === "text") {
          reply += (reply ? "\n" : "") + (part as Extract<MsgPart, { type: "text" }>).text.value;
        }
      }
    }

    if (!reply) {
      // Return a helpful hint if nothing was found
      return res.status(200).json({
        reply:
          "(Brak odpowiedzi MG. Sprawdź ASSISTANT_GM_ID/Instructions oraz logi serwera, czy run zakończył się poprawnie.)",
      });
    }

    res.json({ reply });
  } catch (e: any) {
    console.error("[/api/gm/run] error:", e?.message || e);
    res.status(500).json({ error: "run error", detail: String(e?.message || e) });
  }
});

export default router;
