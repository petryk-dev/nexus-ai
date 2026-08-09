"use client";

interface StreamingMessageProps {
  content: string;
  isStreaming: boolean;
}

export default function StreamingMessage({ content, isStreaming }: StreamingMessageProps) {
  return (
    <span className="whitespace-pre-wrap break-words">
      {content}
      {isStreaming && (
        <span className="inline-block w-2 h-4 ml-0.5 bg-accent animate-pulse align-middle" />
      )}
    </span>
  );
}
