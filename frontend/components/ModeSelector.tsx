"use client";

export type Mode = "chat" | "rag" | "agent";

const MODES: { id: Mode; label: string }[] = [
  { id: "chat", label: "💬 Chat" },
  { id: "rag", label: "📚 RAG" },
  { id: "agent", label: "🤖 Agent" },
];

interface ModeSelectorProps {
  mode: Mode;
  onChange: (mode: Mode) => void;
}

export default function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  return (
    <div className="flex gap-1 border-b border-border bg-background px-4 pt-3">
      {MODES.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            mode === m.id
              ? "bg-panel text-white border border-border border-b-0"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
