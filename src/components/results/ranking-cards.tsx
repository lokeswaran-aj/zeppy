import type { RecommendationItem } from "@/lib/domain";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type RankingCardsProps = {
  ranked: RecommendationItem[];
  bestCallId?: string | null;
};

export function RankingCards({ ranked, bestCallId }: RankingCardsProps) {
  if (ranked.length === 0) {
    return (
      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>No ranked options yet</CardTitle>
          <CardDescription>Recommendations appear after calls and extraction complete.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {ranked.map((item, index) => (
        <Card key={item.callId} className="border-border/70 shadow-sm">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                #{index + 1} · {item.contactName}
              </CardTitle>
              <div className="flex items-center gap-2">
                {bestCallId === item.callId ? <Badge>Top Match</Badge> : null}
                <Badge variant="secondary">Score {item.score}</Badge>
              </div>
            </div>
            <CardDescription>{item.phone}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-1">
              <p className="font-medium">Call Summary</p>
              <p className="text-muted-foreground">{item.summary}</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium">Findings</p>
              {item.findings?.length ? (
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  {item.findings.map((finding, findingIndex) => (
                    <li key={`${item.callId}-finding-${findingIndex}`}>{finding}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">No concrete findings were extracted for this call yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
