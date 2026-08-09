const express = require("express");
const { traceable } = require("langsmith/traceable");
const { streamChatCompletion } = require("../services/groq");
const { embedText, embedBatch, chunkText } = require("../services/embeddings");
const { insertDocuments, similaritySearch } = require("../services/vectorSearch");
const { asyncHandler } = require("../middleware/errorHandler");

const router = express.Router();

const RAG_SYSTEM_PROMPT =
  "You are Nexus AI. Answer the user's question using ONLY the provided " +
  "context. If the context doesn't contain the answer, say you don't know.";

// POST /api/rag/upload
router.post(
  "/upload",
  asyncHandler(async (req, res) => {
    const { text, filename } = req.body || {};
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "\"text\" is required" });
    }

    const chunks = chunkText(text, 500, 50);
    if (chunks.length === 0) {
      return res.status(400).json({ error: "No content to index" });
    }

    const embeddings = await embedBatch(chunks);
    const items = chunks.map((content, i) => ({ content, embedding: embeddings[i] }));
    await insertDocuments(items, filename || "untitled");

    res.json({ success: true, chunksCount: chunks.length });
  })
);

const runRagQuery = traceable(
  async function ragQuery({ question, sources }, sseSend) {
    const context = sources
      .map((s, i) => `[${i + 1}] ${s.content}`)
      .join("\n\n");

    const messages = [
      { role: "system", content: RAG_SYSTEM_PROMPT },
      { role: "user", content: `Context:\n${context}\n\nQuestion: ${question}` },
    ];

    return streamChatCompletion({
      messages,
      onChunk: (chunk) => sseSend({ type: "chunk", content: chunk }),
    });
  },
  { name: "rag_query", project_name: process.env.LANGCHAIN_PROJECT }
);

// POST /api/rag/query
router.post(
  "/query",
  asyncHandler(async (req, res) => {
    const { question } = req.body || {};
    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "\"question\" is required" });
    }

    const questionEmbedding = await embedText(question);
    const sources = await similaritySearch(questionEmbedding, 3);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const sseSend = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

    try {
      await runRagQuery({ question, sources }, sseSend);
      sseSend({
        type: "sources",
        sources: sources.map((s) => ({
          filename: s.filename,
          content: s.content,
          similarity: s.similarity,
        })),
      });
      sseSend({ type: "done" });
    } catch (err) {
      sseSend({ type: "error", message: "Failed to generate answer" });
      console.error("[rag/query] stream error:", err);
    } finally {
      res.end();
    }
  })
);

module.exports = router;
