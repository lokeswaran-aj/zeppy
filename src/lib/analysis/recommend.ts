import type { Call, Contact, ExtractedFinding } from "@prisma/client";

type CandidateCall = Pick<Call, "id" | "score"> & {
  contact: Pick<Contact, "name" | "phone">;
  extractedFinding: Pick<
    ExtractedFinding,
    "summary" | "monthlyPrice" | "availability" | "locationFit" | "confidence" | "rules"
  > | null;
};

export type RankedRecommendation = {
  callId: string;
  contactName: string;
  phone: string;
  score: number;
  summary: string;
  reasoning: string;
  monthlyPrice: number | null;
  availability: string | null;
  locationFit: string | null;
};

type BuildRecommendationsInput = {
  requirement: string;
  candidates: CandidateCall[];
};

export function buildRecommendations(input: BuildRecommendationsInput): RankedRecommendation[] {
  const budget = parseBudgetFromRequirement(input.requirement);

  const recommendations = input.candidates
    .filter((candidate) => candidate.extractedFinding !== null)
    .map((candidate) => {
      const finding = candidate.extractedFinding!;

      const baseScore = candidate.score ?? Math.round((finding.confidence ?? 0.5) * 100);
      let computedScore = baseScore;

      if (budget !== null && finding.monthlyPrice !== null) {
        if (finding.monthlyPrice <= budget) {
          computedScore += 10;
        } else if (finding.monthlyPrice <= budget * 1.1) {
          computedScore += 2;
        } else {
          computedScore -= 20;
        }
      }

      if (finding.locationFit && /good|strong|excellent|near|match/i.test(finding.locationFit)) {
        computedScore += 8;
      }

      if (finding.availability && /available|immediate|this week|today/i.test(finding.availability)) {
        computedScore += 6;
      }

      const finalScore = Math.max(0, Math.min(100, Math.round(computedScore)));
      const summary = finding.summary || "No summary available.";
      const reasoningParts = [
        budget !== null && finding.monthlyPrice !== null
          ? `Cost signal: INR ${finding.monthlyPrice} vs target INR ${budget}.`
          : finding.monthlyPrice !== null
            ? `Cost signal: INR ${finding.monthlyPrice}.`
            : "Cost signal: not confirmed.",
        finding.locationFit ? `Fit signal: ${finding.locationFit}.` : "Fit signal: unavailable.",
        finding.availability ? `Timeline signal: ${finding.availability}.` : "Timeline signal: not confirmed.",
      ];

      return {
        callId: candidate.id,
        contactName: candidate.contact.name,
        phone: candidate.contact.phone,
        score: finalScore,
        summary,
        reasoning: reasoningParts.join(" "),
        monthlyPrice: finding.monthlyPrice,
        availability: finding.availability,
        locationFit: finding.locationFit,
      };
    })
    .sort((a, b) => b.score - a.score);

  return recommendations;
}

export function buildRecommendationSummary(requirement: string, ranked: RankedRecommendation[]) {
  if (ranked.length === 0) {
    return "No completed call produced enough structured data to recommend an option yet.";
  }

  const top = ranked[0];
  const second = ranked[1];

  const lines = [
    `For requirement "${requirement}", ${top.contactName} is currently the strongest option with score ${top.score}.`,
    top.monthlyPrice
      ? `Current cost signal is around INR ${top.monthlyPrice}.`
      : "Cost signal is still being validated.",
    second
      ? `Backup option is ${second.contactName} (score ${second.score}).`
      : "No backup option scored high enough yet.",
  ];

  return lines.join(" ");
}

function parseBudgetFromRequirement(requirement: string) {
  const normalized = requirement.toLowerCase();
  const budgetPattern = /(?:under|below|less than|within)\s*(?:inr|rs\.?|₹)?\s*(\d+(?:\.\d+)?)\s*(k|lakh|lakhs)?/i;
  const match = normalized.match(budgetPattern);
  if (!match) {
    return null;
  }

  let value = Number(match[1]);
  if (Number.isNaN(value)) {
    return null;
  }

  const unit = match[2];
  if (unit === "k") {
    value *= 1000;
  }
  if (unit === "lakh" || unit === "lakhs") {
    value *= 100000;
  }

  return Math.round(value);
}
