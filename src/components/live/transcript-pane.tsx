import { useEffect, useMemo, useRef } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";

import type { TranscriptLine } from "@/lib/domain";

type TranscriptPaneProps = {
  lines: TranscriptLine[];
  selectedCallId: string | null;
  selectedContactName?: string;
};

export function TranscriptPane({ lines, selectedCallId, selectedContactName }: TranscriptPaneProps) {
  const endOfMessagesRef = useRef<HTMLDivElement | null>(null);
  const selectedLines = useMemo(() => {
    if (!selectedCallId) {
      return [];
    }
    return lines.filter((line) => line.callId === selectedCallId);
  }, [lines, selectedCallId]);

  useEffect(() => {
    if (!selectedCallId) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      endOfMessagesRef.current?.scrollIntoView({
        block: "end",
        behavior: "auto",
      });
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [selectedCallId, selectedLines.length]);

  return (
    <div className="space-y-3 rounded-xl border border-border/80 bg-muted/20 p-4">
      <div>
        <h3 className="text-sm font-semibold">Live Conversation</h3>
        <p className="text-xs text-muted-foreground">
          {selectedCallId
            ? `Streaming ${selectedContactName ?? "selected contact"} in real time.`
            : "Select a call to view live conversation details."}
        </p>
      </div>
      <ScrollArea className="h-[420px] pr-3">
        <div className="space-y-3">
          {!selectedCallId ? (
            <p className="text-sm text-muted-foreground">
              Pick any call from the table above.
            </p>
          ) : null}
          {selectedCallId && selectedLines.length === 0 ? (
            <p className="text-sm text-muted-foreground">Waiting for first transcript event...</p>
          ) : null}
          {selectedLines.map((line) => {
            const role =
              line.speaker === "contact" ? "contact" : line.speaker === "agent" ? "agent" : "system";
            const timestamp = new Date(line.createdAt).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            });

            if (role === "system") {
              return (
                <div key={line.id} className="flex justify-center">
                  <div className="max-w-[92%] rounded-md border border-border/80 bg-secondary px-3 py-2 text-center">
                    <p className="text-[11px] text-muted-foreground">{timestamp}</p>
                    <p className="text-sm leading-relaxed text-secondary-foreground">{line.text}</p>
                  </div>
                </div>
              );
            }

            const isAgent = role === "agent";
            const align = isAgent ? "justify-end" : "justify-start";
            const bubble = isAgent ? "bg-primary text-primary-foreground" : "bg-muted text-foreground";
            const speakerLabel = isAgent ? "AI Agent" : selectedContactName ?? "Contact";

            return (
              <div key={line.id} className={`flex ${align}`}>
                <div className="max-w-[82%] space-y-1">
                  <div
                    className={`flex items-center gap-2 text-[11px] text-muted-foreground ${
                      isAgent ? "justify-end" : "justify-start"
                    }`}
                  >
                    <span>{speakerLabel}</span>
                    <span>{timestamp}</span>
                  </div>
                  <div className={`rounded-2xl border border-border/30 px-3 py-2 ${bubble}`}>
                    <p className="text-sm leading-relaxed">{line.text}</p>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={endOfMessagesRef} aria-hidden className="h-px w-full" />
        </div>
      </ScrollArea>
    </div>
  );
}
