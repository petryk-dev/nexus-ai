const Groq = require("groq-sdk");

const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

// Note: LangSmith's wrapOpenAI() assumes a legacy client.completions.create
// method that groq-sdk doesn't implement, so it can't wrap this client
// directly. Tracing is instead applied at the route level via traceable()
// around each route's handler (see routes/chat.js, rag.js, agent.js).
const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Streams a chat completion and pipes text chunks to an Express response
 * as it arrives. Caller owns the response headers/lifecycle.
 */
async function streamChatCompletion({ messages, onChunk, tools, toolChoice }) {
  const stream = await client.chat.completions.create({
    model: MODEL,
    messages,
    stream: true,
    ...(tools ? { tools, tool_choice: toolChoice || "auto" } : {}),
  });

  let full = "";
  for await (const part of stream) {
    const delta = part.choices?.[0]?.delta?.content || "";
    if (delta) {
      full += delta;
      onChunk(delta);
    }
  }
  return full;
}

/**
 * Non-streaming completion, used where we need to inspect the full
 * response before deciding what to do next (e.g. tool-call detection).
 */
async function chatCompletion({ messages, tools, toolChoice }) {
  const response = await client.chat.completions.create({
    model: MODEL,
    messages,
    ...(tools ? { tools, tool_choice: toolChoice || "auto" } : {}),
  });
  return response.choices[0].message;
}

module.exports = { client, streamChatCompletion, chatCompletion, MODEL };
