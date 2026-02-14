"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { RankingCards } from "@/components/results/ranking-cards";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { InvestigationResultsResponse } from "@/lib/events";

const PRIORITY_BADGE: Record<"high" | "medium" | "low", "destructive" | "secondary" | "outline"> = {
  high: "destructive",
  medium: "secondary",
  low: "outline",
};

export default function InvestigationResultsPage() {
  const params = useParams<{ id: string }>();
  const investigationId = params.id;
  const [data, setData] = useState<InvestigationResultsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!investigationId) {
      return;
    }

    const load = async () => {
      try {
        setError(null);
        const response = await fetch(`/api/investigations/${investigationId}/results`);
        if (!response.ok) {
          throw new Error("Results are not available yet.");
        }
        const payload = (await response.json()) as InvestigationResultsResponse;
        setData(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load results.");
      }
    };

    void load();
  }, [investigationId]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Decision Brief</h1>
        <p className="text-sm text-muted-foreground">
          Ranked outcomes and recommended next actions.
        </p>
      </header>

      {error ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>Executive Summary</CardTitle>
          <CardDescription>{data?.requirement ?? "Loading requirement..."}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {data?.recommendationSummary ?? "Analyzing completed calls and preparing ranked options..."}
          </p>
        </CardContent>
      </Card>

      <RankingCards ranked={data?.ranked ?? []} bestCallId={data?.bestCallId} />

      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>Next Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data?.actionItems?.length ? (
            data.actionItems.map((item) => (
              <div key={item.id} className="rounded-md border border-border p-3">
                <div className="mb-1 flex items-center gap-2">
                  <Badge variant={PRIORITY_BADGE[item.priority]}>{item.priority}</Badge>
                  <p className="font-medium">{item.title}</p>
                </div>
                <p className="text-sm text-muted-foreground">{item.detail}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No action items yet.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
