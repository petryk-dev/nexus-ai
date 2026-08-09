const express = require("express");
const { traceable } = require("langsmith/traceable");
const { streamChatCompletion } = require("../services/groq");
const { asyncHandler } = require("../middleware/errorHandler");

const router = express.Router();

const SYSTEM_PROMPT =
  "You are Nexus AI, a helpful, concise assistant.";

const runChat = traceable(
  async function chat({ message, history }, sseSend) {
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ];

    return streamChatCompletion({
      messages,
      onChunk: (chunk) => sseSend({ type: "chunk", content: chunk }),
    });
  },
  { name: "chat", project_name: process.env.LANGCHAIN_PROJECT }
);

// POST /api/chat
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { message, history = [] } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "\"message\" is required" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const sseSend = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

    try {
      await runChat({ message, history }, sseSend);
      sseSend({ type: "done" });
    } catch (err) {
      sseSend({ type: "error", message: "Failed to generate response" });
      console.error("[chat] stream error:", err);
    } finally {
      res.end();
    }
  })
);

module.exports = router;
