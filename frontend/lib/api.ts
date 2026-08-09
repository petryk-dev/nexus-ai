export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export type Role = "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface RagSource {
  filename: string;
  content: string;
  similarity: number;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface UIMessage {
  id: string;
  role: Role;
  content: string;
  streaming?: boolean;
  toolCalls?: ToolCall[];
  sources?: RagSource[];
}

type SseEvent =
  | { type: "chunk"; content: string }
  | { type: "tool"; name: string; args: Record<string, unknown> }
  | { type: "sources"; sources: RagSource[] }
  | { type: "done" }
  | { type: "error"; message: string };

interface StreamHandlers {
  onChunk?: (content: string) => void;
  onTool?: (name: string, args: Record<string, unknown>) => void;
  onSources?: (sources: RagSource[]) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
}

/**
 * Reads a fetch Response body as an SSE stream ("data: {...}\n\n" frames)
 * and dispatches parsed events to the provided handlers.
 */
async function consumeSseStream(response: Response, handlers: StreamHandlers) {
  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    handlers.onError?.(text || `Request failed with status ${response.status}`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() || "";

    for (const frame of frames) {
      const line = frame.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;

      const raw = line.slice("data: ".length);
      let event: SseEvent;
      try {
        event = JSON.parse(raw);
      } catch {
        continue;
      }

      if (event.type === "chunk") handlers.onChunk?.(event.content);
      else if (event.type === "tool") handlers.onTool?.(event.name, event.args);
      else if (event.type === "sources") handlers.onSources?.(event.sources);
      else if (event.type === "error") handlers.onError?.(event.message);
      else if (event.type === "done") handlers.onDone?.();
    }
  }
}

export async function streamChat(
  message: string,
  history: ChatMessage[],
  handlers: StreamHandlers
) {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
  await consumeSseStream(response, handlers);
}

export async function streamRagQuery(question: string, handlers: StreamHandlers) {
  const response = await fetch(`${API_URL}/api/rag/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  await consumeSseStream(response, handlers);
}

export async function uploadDocument(text: string, filename: string) {
  const response = await fetch(`${API_URL}/api/rag/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, filename }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(body.error || "Upload failed");
  }
  return response.json() as Promise<{ success: boolean; chunksCount: number }>;
}

export async function streamAgent(message: string, handlers: StreamHandlers) {
  const response = await fetch(`${API_URL}/api/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  await consumeSseStream(response, handlers);
}
