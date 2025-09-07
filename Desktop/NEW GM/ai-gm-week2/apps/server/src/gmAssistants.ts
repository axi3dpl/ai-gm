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

// Minimal shapes for messages
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
    console.log("[/api/gm/thread] Creating new thread...");
    const thread = await client.beta.threads.create();
    console.log("[/api/gm/thread] Thread created:", thread.id);
    res.json({ threadId: thread.id });
  } catch (e: any) {
    console.error("[/api/gm/thread] error:", e?.message || e);
    res.status(500).json({ error: "thread error", detail: String(e?.message || e) });
  }
});

router.post("/message", async (req, res) => {
  try {
    const { threadId, content } = req.body ?? {};
    console.log("[/api/gm/message] Received:", { threadId, content });
    
    if (!threadId || !content) {
      console.error("[/api/gm/message] Missing required fields");
      return res.status(400).json({ error: "threadId and content required" });
    }
    
    // Use type assertion to handle SDK version differences
    const message = await (client.beta.threads.messages as any).create(threadId, {
      role: "user",
      content: content,
    });
    
    console.log("[/api/gm/message] Message created:", message.id);
    res.json({ ok: true });
  } catch (e: any) {
    console.error("[/api/gm/message] error:", e?.message || e);
    res.status(500).json({ error: "message error", detail: String(e?.message || e) });
  }
});

router.post("/run", async (req, res) => {
  try {
    const { threadId } = req.body ?? {};
    console.log("[/api/gm/run] Received request body:", req.body);
    console.log("[/api/gm/run] Extracted threadId:", threadId, "type:", typeof threadId);
    console.log("[/api/gm/run] Using ASSISTANT_ID:", ASSISTANT_ID);
    
    if (!threadId || typeof threadId !== 'string') {
      console.error("[/api/gm/run] Invalid threadId:", threadId);
      return res.status(400).json({ error: "Valid threadId required" });
    }

    if (!ASSISTANT_ID) {
      console.error("[/api/gm/run] Missing ASSISTANT_GM_ID in environment");
      return res.status(500).json({ error: "Assistant ID not configured" });
    }

    // Start run - use type assertion to handle SDK version differences
    console.log("[/api/gm/run] Creating run...");
    const run = await (client.beta.threads.runs as any).create(threadId, {
      assistant_id: ASSISTANT_ID,
    });

    console.log("[/api/gm/run] Run created:", run.id, "status:", run.status);

    // Poll until done (60s timeout)
    const startTs = Date.now();
    let status = run.status;

    while (status === "queued" || status === "in_progress") {
      if (Date.now() - startTs > 60_000) {
        console.error("[/api/gm/run] Run timeout");
        return res.status(504).json({ error: "run timeout" });
      }
      
      await sleep(800);
      
      // Use type assertion to handle SDK version differences
      const latest = await (client.beta.threads.runs as any).retrieve(threadId, run.id);
      status = latest.status;
      console.log("[/api/gm/run] Run status:", status);
    }

    if (status !== "completed") {
      console.error("[/api/gm/run] Run failed with status:", status);
      return res.status(500).json({ error: `run status: ${status}` });
    }

    // List messages - use type assertion to handle SDK version differences
    const list = await (client.beta.threads.messages as any).list(threadId, {
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
      console.warn("[/api/gm/run] No reply from assistant");
      return res.status(200).json({
        reply: "(Brak odpowiedzi MG — sprawdź ASSISTANT_GM_ID/Instructions oraz logi serwera, czy run zakończył się poprawnie.)",
      });
    }

    console.log("[/api/gm/run] Reply received, length:", reply.length);
    res.json({ reply });
  } catch (e: any) {
    console.error("[/api/gm/run] error:", e?.message || e);
    res.status(500).json({ error: "run error", detail: String(e?.message || e) });
  }
});

export default router;