"use client";

import { useState } from "react";
import { uploadDocument } from "@/lib/api";

export default function DocumentUpload() {
  const [text, setText] = useState("");
  const [filename, setFilename] = useState("");
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [chunksCount, setChunksCount] = useState<number | null>(null);

  const handleUpload = async () => {
    if (!text.trim()) return;
    setStatus("uploading");
    try {
      const result = await uploadDocument(text, filename || "untitled.txt");
      setChunksCount(result.chunksCount);
      setStatus("done");
      setText("");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="border-b border-border bg-panel px-4 py-4 space-y-2">
      <p className="text-sm font-medium text-zinc-300">
        Upload a document to the knowledge base
      </p>
      <input
        value={filename}
        onChange={(e) => setFilename(e.target.value)}
        placeholder="Filename (optional)"
        className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-accent"
      />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste text here..."
        rows={4}
        className="w-full resize-none rounded-lg bg-background border border-border px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-accent"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={handleUpload}
          disabled={status === "uploading" || !text.trim()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-40 hover:bg-blue-600 transition-colors"
        >
          {status === "uploading" ? "Uploading..." : "Upload"}
        </button>
        {status === "done" && (
          <span className="text-xs text-green-400">Indexed {chunksCount} chunks</span>
        )}
        {status === "error" && (
          <span className="text-xs text-red-400">Upload failed. Try again.</span>
        )}
      </div>
    </div>
  );
}
