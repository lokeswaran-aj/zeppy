import { randomUUID } from "node:crypto";

import type { ActionItem } from "@/lib/domain";

import type { RankedRecommendation } from "./recommend";

type BuildActionItemsInput = {
  requirement: string;
  ranked: RankedRecommendation[];
};

export function buildActionItems(input: BuildActionItemsInput): ActionItem[] {
  if (input.ranked.length === 0) {
    return [
      {
        id: randomUUID(),
        priority: "high",
        title: "Add more qualified contacts",
        detail:
          "No call returned enough reliable information. Add more contacts and rerun the investigation.",
      },
      {
        id: randomUUID(),
        priority: "medium",
        title: "Relax one or two constraints",
        detail: `Re-evaluate requirement "${input.requirement}" for overly strict filters like budget or immediate move-in.`,
      },
    ];
  }

  const top = input.ranked[0];
  const second = input.ranked[1];

  const items: ActionItem[] = [
    {
      id: randomUUID(),
      priority: "high",
      title: `Follow up with ${top.contactName} to confirm key details`,
      detail: `Confirm final terms (${top.monthlyPrice ? `estimated price ~INR ${top.monthlyPrice}` : "pricing TBC"}), timeline/availability, and concrete next steps.`,
    },
    {
      id: randomUUID(),
      priority: "medium",
      title: "Request written proof of commitments",
      detail:
        "Ask for supporting details in writing (scope, constraints, inclusions/exclusions, and any additional costs or dependencies).",
    },
  ];

  if (second) {
    items.push({
      id: randomUUID(),
      priority: "low",
      title: `Keep ${second.contactName} as backup`,
      detail: "If the top option changes price/availability, follow up immediately with this backup option.",
    });
  }

  return items;
}
