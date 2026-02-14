import { describe, expect, it } from "vitest";

import { buildRecommendationSummary, buildRecommendations } from "./recommend";

describe("buildRecommendations", () => {
  it("ranks candidates by score and budget fit", () => {
    const ranked = buildRecommendations({
      requirement: "Need PG near Koramangala under 15k",
      candidates: [
        {
          id: "call-1",
          score: 75,
          contact: {
            name: "Asha Homes",
            phone: "+919900001111",
          },
          extractedFinding: {
            summary: "Good location and immediate move-in.",
            monthlyPrice: 14000,
            availability: "Available this week",
            locationFit: "Good match near Koramangala",
            confidence: 0.9,
            rules: ["No pets"],
          },
        },
        {
          id: "call-2",
          score: 80,
          contact: {
            name: "City Stay",
            phone: "+919900002222",
          },
          extractedFinding: {
            summary: "Nice facilities but expensive.",
            monthlyPrice: 19000,
            availability: "Available",
            locationFit: "Good match",
            confidence: 0.8,
            rules: ["Curfew 10pm"],
          },
        },
      ],
    });

    expect(ranked).toHaveLength(2);
    expect(ranked[0]?.contactName).toBe("Asha Homes");
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? 0);
  });
});

describe("buildRecommendationSummary", () => {
  it("includes top option details", () => {
    const summary = buildRecommendationSummary("Need PG under 15k", [
      {
        callId: "call-1",
        contactName: "Asha Homes",
        phone: "+919900001111",
        score: 92,
        summary: "Strong option",
        reasoning: "Budget and location match",
        monthlyPrice: 14500,
        availability: "Immediate",
        locationFit: "Strong match",
      },
    ]);

    expect(summary).toContain("Asha Homes");
    expect(summary).toContain("score 92");
  });
});
