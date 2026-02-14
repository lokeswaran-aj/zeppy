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
      <Card>
        <CardHeader>
          <CardTitle>No recommendations yet</CardTitle>
          <CardDescription>Run an investigation to generate ranked options.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {ranked.map((item, index) => (
        <Card key={item.callId}>
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                #{index + 1} · {item.contactName}
              </CardTitle>
              <div className="flex items-center gap-2">
                {bestCallId === item.callId ? <Badge>Best Match</Badge> : null}
                <Badge variant="secondary">Score {item.score}</Badge>
              </div>
            </div>
            <CardDescription>{item.phone}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{item.summary}</p>
            <div className="grid gap-1 text-muted-foreground md:grid-cols-3">
              <p>Price: {item.monthlyPrice ? `INR ${item.monthlyPrice}` : "N/A"}</p>
              <p>Availability: {item.availability ?? "N/A"}</p>
              <p>Location fit: {item.locationFit ?? "N/A"}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
