import { ScrollArea } from "@/components/ui/scroll-area";

import type { TranscriptLine } from "@/lib/domain";

type TranscriptPaneProps = {
  lines: TranscriptLine[];
};

export function TranscriptPane({ lines }: TranscriptPaneProps) {
  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div>
        <h3 className="text-sm font-semibold">Live Transcript</h3>
        <p className="text-xs text-muted-foreground">
          Streaming snippets from all active calls.
        </p>
      </div>
      <ScrollArea className="h-[420px] pr-3">
        <div className="space-y-3">
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">Waiting for first transcript event...</p>
          ) : null}
          {lines.map((line) => (
            <div key={line.id} className="rounded-md bg-muted/50 p-3">
              <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {line.contactName} · <span className="capitalize">{line.speaker}</span>
                </span>
                <span>{new Date(line.createdAt).toLocaleTimeString()}</span>
              </div>
              <p className="text-sm leading-relaxed">{line.text}</p>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
