"use client";

import { useState } from "react";
import ModeSelector, { Mode } from "@/components/ModeSelector";
import MessageList from "@/components/MessageList";
import ChatInput from "@/components/ChatInput";
import DocumentUpload from "@/components/DocumentUpload";
import { UIMessage, streamChat, streamRagQuery, streamAgent } from "@/lib/api";

type MessagesByMode = Record<Mode, UIMessage[]>;

const PLACEHOLDERS: Record<Mode, string> = {
  chat: "Ask me anything...",
  rag: "Ask a question about your uploaded documents...",
  agent: "Ask the agent to look something up or calculate a date...",
};

function newId() {
  return crypto.randomUUID();
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("chat");
  const [messagesByMode, setMessagesByMode] = useState<MessagesByMode>({
    chat: [],
    rag: [],
    agent: [],
  });
  const [isLoading, setIsLoading] = useState(false);

  const messages = messagesByMode[mode];

  const updateMessage = (targetMode: Mode, id: string, patch: Partial<UIMessage>) => {
    setMessagesByMode((prev) => ({
      ...prev,
      [targetMode]: prev[targetMode].map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
  };

  const appendChunk = (targetMode: Mode, id: string, chunk: string) => {
    setMessagesByMode((prev) => ({
      ...prev,
      [targetMode]: prev[targetMode].map((m) =>
        m.id === id ? { ...m, content: m.content + chunk } : m
      ),
    }));
  };

  const handleSend = async (text: string) => {
    const currentMode = mode;
    const userMessage: UIMessage = { id: newId(), role: "user", content: text };
    const assistantId = newId();
    const assistantMessage: UIMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      streaming: true,
    };

    const priorHistory = messagesByMode[currentMode].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessagesByMode((prev) => ({
      ...prev,
      [currentMode]: [...prev[currentMode], userMessage, assistantMessage],
    }));
    setIsLoading(true);

    const finish = () => updateMessage(currentMode, assistantId, { streaming: false });
    const fail = (message: string) =>
      updateMessage(currentMode, assistantId, {
        content: `⚠️ ${message}`,
        streaming: false,
      });

    try {
      if (currentMode === "chat") {
        await streamChat(text, priorHistory, {
          onChunk: (chunk) => appendChunk(currentMode, assistantId, chunk),
          onDone: finish,
          onError: fail,
        });
      } else if (currentMode === "rag") {
        await streamRagQuery(text, {
          onChunk: (chunk) => appendChunk(currentMode, assistantId, chunk),
          onSources: (sources) => updateMessage(currentMode, assistantId, { sources }),
          onDone: finish,
          onError: fail,
        });
      } else {
        await streamAgent(text, {
          onTool: (name, args) =>
            setMessagesByMode((prev) => ({
              ...prev,
              [currentMode]: prev[currentMode].map((m) =>
                m.id === assistantId
                  ? { ...m, toolCalls: [...(m.toolCalls || []), { name, args }] }
                  : m
              ),
            })),
          onChunk: (chunk) => appendChunk(currentMode, assistantId, chunk),
          onDone: finish,
          onError: fail,
        });
      }
    } catch (err) {
      fail(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex flex-col h-screen">
      <ModeSelector mode={mode} onChange={setMode} />
      {mode === "rag" && <DocumentUpload />}
      <MessageList messages={messages} />
      <ChatInput
        onSend={handleSend}
        disabled={isLoading}
        placeholder={PLACEHOLDERS[mode]}
      />
    </main>
  );
}
