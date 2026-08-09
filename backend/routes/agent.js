const express = require("express");
const { traceable } = require("langsmith/traceable");
const { chatCompletion } = require("../services/groq");
const { embedText } = require("../services/embeddings");
const { similaritySearch } = require("../services/vectorSearch");
const { asyncHandler } = require("../middleware/errorHandler");

const router = express.Router();

const MAX_TOOL_ROUNDS = 5;

const AGENT_SYSTEM_PROMPT =
  "You are Nexus AI, an assistant with access to tools. Use tools when they " +
  "help answer the user's request, then give a clear final answer. Do not " +
  "mention tool names or internal mechanics in your final answer.";

// --- Tool implementations -------------------------------------------------

function getCurrentWeather(city) {
  // Mock data — deterministic per city so results are stable across calls.
  const conditions = ["Sunny", "Cloudy", "Rainy", "Windy", "Clear"];
  let hash = 0;
  for (const ch of city) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return {
    city,
    temperatureC: 10 + (hash % 25),
    condition: conditions[hash % conditions.length],
    humidity: 30 + (hash % 50),
  };
}

function calculateDate(daysFromNow) {
  const date = new Date();
  date.setDate(date.getDate() + Number(daysFromNow || 0));
  return { date: date.toISOString().split("T")[0], iso: date.toISOString() };
}

async function searchKnowledgeBase(query) {
  const embedding = await embedText(query);
  const results = await similaritySearch(embedding, 3);
  return results.map((r) => ({ content: r.content, filename: r.filename }));
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "getCurrentWeather",
      description: "Get the current weather for a city.",
      parameters: {
        type: "object",
        properties: { city: { type: "string", description: "City name" } },
        required: ["city"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculateDate",
      description: "Calculate the calendar date N days from today.",
      parameters: {
        type: "object",
        properties: {
          daysFromNow: { type: "number", description: "Number of days from today (can be negative)" },
        },
        required: ["daysFromNow"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "searchKnowledgeBase",
      description: "Search the uploaded document knowledge base for relevant information.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Search query" } },
        required: ["query"],
      },
    },
  },
];

async function executeTool(name, args) {
  switch (name) {
    case "getCurrentWeather":
      return getCurrentWeather(args.city);
    case "calculateDate":
      return calculateDate(args.daysFromNow);
    case "searchKnowledgeBase":
      return searchKnowledgeBase(args.query);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// --- Agent loop ------------------------------------------------------------

const runAgent = traceable(
  async function agent({ message }, sseSend) {
    const messages = [
      { role: "system", content: AGENT_SYSTEM_PROMPT },
      { role: "user", content: message },
    ];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await chatCompletion({ messages, tools: TOOLS });

      if (!response.tool_calls || response.tool_calls.length === 0) {
        return response.content || "";
      }

      messages.push({
        role: "assistant",
        content: response.content || null,
        tool_calls: response.tool_calls,
      });

      for (const toolCall of response.tool_calls) {
        const name = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments || "{}");
        sseSend({ type: "tool", name, args });

        let result;
        try {
          result = await executeTool(name, args);
        } catch (err) {
          result = { error: err.message };
        }

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
    }

    // Fallback if the model keeps calling tools past the round limit.
    const finalResponse = await chatCompletion({ messages });
    return finalResponse.content || "";
  },
  { name: "agent", project_name: process.env.LANGCHAIN_PROJECT }
);

// POST /api/agent
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { message } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "\"message\" is required" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const sseSend = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

    try {
      const answer = await runAgent({ message }, sseSend);
      // Emit the already-generated final answer as word chunks so the
      // frontend's word-by-word streaming UI works the same across modes.
      const words = answer.split(/(\s+)/).filter(Boolean);
      for (const word of words) {
        sseSend({ type: "chunk", content: word });
      }
      sseSend({ type: "done" });
    } catch (err) {
      sseSend({ type: "error", message: "Agent failed to complete the request" });
      console.error("[agent] error:", err);
    } finally {
      res.end();
    }
  })
);

module.exports = router;
