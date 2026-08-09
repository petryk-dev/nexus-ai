"use client";

import { useEffect, useRef } from "react";
import { UIMessage } from "@/lib/api";
import StreamingMessage from "./StreamingMessage";

interface MessageListProps {
  messages: UIMessage[];
}

export default function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
        Start the conversation below.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === "user"
                ? "bg-accent text-white rounded-br-sm"
                : "bg-panel border border-border text-white rounded-bl-sm"
            }`}
          >
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {msg.toolCalls.map((tc, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-1 rounded-full bg-accent/10 text-accent border border-accent/30"
                  >
                    🔧 Using tool: {tc.name}
                  </span>
                ))}
              </div>
            )}

            <StreamingMessage content={msg.content} isStreaming={!!msg.streaming} />

            {msg.sources && msg.sources.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border/60 space-y-1.5">
                <p className="text-xs text-zinc-400 font-medium">Sources</p>
                {msg.sources.map((s, i) => (
                  <div key={i} className="text-xs text-zinc-500">
                    <span className="text-zinc-300">{s.filename}</span>{" "}
                    <span>({(s.similarity * 100).toFixed(0)}% match)</span>
                    <p className="truncate">{s.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
