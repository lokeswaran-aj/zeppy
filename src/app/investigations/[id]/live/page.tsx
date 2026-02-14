"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { ProgressTimeline } from "@/components/live/progress-timeline";
import { TranscriptPane } from "@/components/live/transcript-pane";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CallProgressItem, InvestigationStatus, TranscriptLine } from "@/lib/domain";
import type { SSEEventPayload } from "@/lib/events";

export default function InvestigationLivePage() {
  const params = useParams<{ id: string }>();
  const investigationId = params.id;
  const [status, setStatus] = useState<InvestigationStatus>("running");
  const [calls, setCalls] = useState<CallProgressItem[]>([]);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);

  useEffect(() => {
    if (!investigationId) {
      return;
    }
    const eventSource = new EventSource(`/api/investigations/${investigationId}/events`);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as SSEEventPayload;

        if (payload.type === "investigation.snapshot") {
          setStatus(payload.status);
          setCalls(payload.calls);
          setLines(payload.transcripts);
        }

        if (payload.type === "call.status") {
          setCalls((current) => {
            const hasExisting = current.some((call) => call.id === payload.call.id);
            if (!hasExisting) {
              return [...current, payload.call];
            }
            return current.map((call) => (call.id === payload.call.id ? payload.call : call));
          });
        }

        if (payload.type === "call.transcript") {
          setLines((current) => [...current, payload.transcript]);
        }

        if (payload.type === "investigation.completed") {
          setStatus("completed");
        }

        if (payload.type === "investigation.failed") {
          setStatus("failed");
        }
      } catch {
        // Ignore malformed SSE payloads.
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [investigationId]);

  const completedCalls = useMemo(
    () => calls.filter((call) => call.status === "completed" || call.status === "failed").length,
    [calls],
  );
  const resolvedSelectedCallId = useMemo(() => {
    if (selectedCallId && calls.some((call) => call.id === selectedCallId)) {
      return selectedCallId;
    }
    return calls[0]?.id ?? null;
  }, [calls, selectedCallId]);
  const selectedCall = useMemo(
    () => calls.find((call) => call.id === resolvedSelectedCallId) ?? null,
    [calls, resolvedSelectedCallId],
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Live Ops</h1>
          <p className="text-sm text-muted-foreground">
            Monitor call progress and live conversations in real time.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={status === "failed" ? "destructive" : "secondary"}>{status}</Badge>
          <Button asChild disabled={status !== "completed"}>
            <Link href={`/investigations/${investigationId}/results`}>Open Results</Link>
          </Button>
        </div>
      </header>

      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>Call Execution ({completedCalls}/{calls.length} finished)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ProgressTimeline
            calls={calls}
            selectedCallId={resolvedSelectedCallId}
            onSelectCall={(callId) => setSelectedCallId(callId)}
          />
        </CardContent>
      </Card>

      <TranscriptPane
        lines={lines}
        selectedCallId={resolvedSelectedCallId}
        selectedContactName={selectedCall?.contactName}
      />
    </main>
  );
}
